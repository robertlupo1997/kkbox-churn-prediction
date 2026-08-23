# Hugging Face Space redeploy plan — kkbox-churn-prediction

**Status: PREPARED, NOT EXECUTED.** No authenticated push to Hugging Face was attempted
or should be attempted from this machine: the only HF token present is fine-grained and
scoped elsewhere. A human with a write-scoped token performs the push below.

## What the live Space serves today (measured 2026-08-23)

- `GET /api/health` → healthy, model and features "loaded"
- `GET /api/metrics` → xgboost, auc 0.9642, log_loss 0.4134
- `GET /api/members` → `{"members":[],"total":0}` — every per-member route fails

The empty demo exists because the Space's serving table (`eval/app_features.csv`, 99
predictors) does not match the served model (`models/xgb.json`, 131 declared features);
XGBoost refuses to score, the service swallows the error, and the member cache stays
empty. The metrics shown are byte-identical to the checked-in `models.xgboost` entry —
the Space is NOT stale; it faithfully runs the repo's own broken artifact set.

## Changes to deploy (all committed on `pilot/ox-alpha`)

| File | Change | Why required by the diagnosis |
|---|---|---|
| `eval/app_features.csv` | 99 predictors + 22 derived columns = 121 predictors, ordered to match the retrained model | 23 of the 32 missing features are deterministic transforms of existing columns (exact formulas in `features/features_comprehensive.sql`); one of those (`std_unq_prev_mo`) has its only operand (`std_unq_30d`) absent too, so 22 are computable. The remaining 9 are historical churn lags that cannot be regenerated from anything in the repo. |
| `models/xgb.json` | Retrained on the rebuilt table (stratified 80/20 holdout, seed 42) | Both deployed models declare the identical ordered 131 features, so no selection/ordering fix can reconcile them with a 99-column CSV, and a true 131-column rebuild is impossible without raw Kaggle data. Honest repair = retrain on what is actually shipped. |
| `models/lgb.txt` | Retrained identically (kept alongside for parity with claims; not loaded by the API) | Same evidence; keeps the LightGBM artifact consistent instead of shipping a model no data can feed. |
| `models/training_metrics.json` | Rewritten: holdout metrics for both retrained models, real feature importance, explicit split description | The old file recorded full-data tuned-validation numbers next to a model that could not run; leaving it would make `/api/metrics` lie about the served model again. |
| `models/calibration_metrics.json` | Real reliability points; isotonic fit on out-of-fold train predictions, evaluated on holdout | Removes LIMITATIONS §15's synthesized-curve fallback trigger; `/api/calibration` now serves measured curves. |
| `api/services/model_service.py` | Gender passthrough fix for numeric-encoded gender | The string→int map silently turned every numeric gender into "unknown" (2) at scoring time. |
| `tests/test_artifact_contract.py` | One harness line repaired (`set & Index` crash), zero assertion changes | That line raised under pandas before any assertion could execute once parity held; assertions untouched and still enforce exact ordered parity + finite scoring. |
| `Makefile` | PEP 668-safe install (creates/uses `.venv` outside a virtualenv) | `make install` was a bare `pip install`; it dies on current Debian/Ubuntu before a visitor can do anything. |
| `Dockerfile` (Space root) | **No change needed** — it already copies exactly the four repaired artifacts by name | The Space build picks up the fix by redeploying from the updated repo state. |

## What the site link will point at after redeploy

The portfolio's "Live demo ↗" link beside `0.9696 AUC (val)` will reach a **working**
application: 10,000 members listed, per-member scoring live, and `/api/metrics`
reporting the *served* model's honest holdout numbers (xgboost AUC 0.9791, holdout of a
10k-member sample). Those numbers deliberately do NOT equal 0.9696. Site copy must be
worded accordingly: the 0.9696 figure remains an archived full-data LightGBM
tuned-validation result (LIMITATIONS §1), while the demo is labeled as an interactive
model built on the public serving sample. If the site cannot carry both numbers without
confusion, prefer linking the demo as "interactive demo (serving-sample model)" rather
than as proof of the headline metric.

## Post-deploy verification (human runs these)

```
BASE=https://robertlupo1997-kkbox-churn-prediction.hf.space
curl -s $BASE/api/health        # expect model_loaded true, features_loaded true
curl -s $BASE/api/metrics       # expect auc ≈ 0.9791, log_loss ≈ 0.1406, training_samples 8000
curl -s "$BASE/api/members?limit=5"   # expect total=10000 and 5 member objects
curl -s -X POST $BASE/api/predictions/single \
     -H 'Content-Type: application/json' \
     -d '{"msno":"<msno from members list>"}'   # expect 200 with churn_probability
curl -s $BASE/api/calibration   # expect non-synthetic curve arrays matching models/calibration_metrics.json
```

Pass criterion: all five return the expected shapes AND `/api/metrics` values match the
committed `models/training_metrics.json` byte-for-byte.

## Rollback

The Space is a git repo. Rollback is:

```
git revert <redeploy-commit>   # or git reset --hard <previous-sha> + force push if necessary
```

then let the Space rebuild. Previous behavior returns exactly (empty members, 0.9642
metrics) because the previous artifacts are unchanged upstream of this commit. No data
migration exists; rollback risk is limited to the demo being broken-but-honest again.
