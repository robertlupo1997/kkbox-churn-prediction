# Evidence — post-review fixes: SHAP/calibration reconciliation, saturation clip, honest header
Date: 2026-08-24. Addresses the three defects verified in
`coord/inbox/2026-08-23-worktree-collision-kkbox-pilot.md` ("FOR THE WAVE-3 WORKER").

## Fix 1 — /api/shap now names the probability its attribution explains

The served `risk_score` is isotonic-calibrated; SHAP is additive in the raw margin. The shap
payload now carries `probability_explained` (pre-calibration, verified equal to an independent
booster recomputation to 1e-9) plus an `explains` disclosure string. The client's
`checkShapReconciles` reconciles against THAT field (tolerance unchanged at 1e-3; a missing
field is a rejection reason), and MemberLookup renders one line disclosing that attribution
explains the uncalibrated output while the ticket shows the calibrated score.

Two root causes found and fixed on the way:

1. **`import shap` silently degraded to the fabricated proxy** whenever the host environment
   selected an interactive matplotlib backend (MPLBACKEND inherited from a jupyter parent).
   `shap_service` now forces `MPLBACKEND=Agg` before importing — a serving process is always
   headless. Before this fix, MY OWN probe doc's "note key" evidence was the proxy path, as the
   reviewer suspected.
2. **`explain_prediction` still remapped numeric gender to "unknown"** — the exact bug commit
   09b6be0 fixed in the scoring path but never ported. It made explanations miss the scored
   margin by 0.12–0.20 log-odds for members whose gender mattered.

Verification (fresh boot, real TreeExplainer path, `is_approximate=false` asserted per call):

```
1. 20/20 REAL explanations reconcile vs probability_explained; worst residual 5.70e-06
3. slash+plus msno transport OK; real shap residual=1.26e-06
```

## Fix 2 — no saturated probabilities

Isotonic saturates at the ends by construction; `predict()` now clips into [1e-4, 1-1e-4].

```
2. 50-member sample served range [0.000100, 0.989324], saturated count=0
```

Each sampled score also equals `clip(np.interp(raw_booster_prob, knots), 1e-4, 1-1e-4)` exactly.

## Fix 3 — header honesty

The app banner no longer juxtaposes "0.9696 / 131 FEATURES / 916K ROWS / 6 MODELS" (all archived
full-data figures) with the demo surface. It now reads:

```
Archived Tuned-Val AUC 0.9696 — no served model | Served model: 121 Features
| Browsable: 1,995 Holdout Members | Sample of 10K Rows
```

Frontend rebuilt (`vite build` passes); `npx tsc --noEmit` reports only the pre-existing
App.tsx Routes-key type error present at HEAD c8b60e0.

## Suite at this HEAD

```
8 failed, 74 passed
```

Identical red set to the documented baseline (tests/test_labels.py x6,
tests/test_feature_windows.py x2). No test weakened, skipped, or deleted.
