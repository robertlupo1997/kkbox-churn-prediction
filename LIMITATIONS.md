# Limitations

This is the honest inventory of what this project does **not** do, what is unverified, and what it
would take to verify each item. Every entry cites the file that establishes it, so you can check any
claim here in under a minute.

If a statement anywhere else in this repository conflicts with this file, this file is correct.

---

## 1. The headline metrics are tuned-validation numbers, not held-out results

**What is claimed elsewhere:** LightGBM AUC 0.9696, calibrated log loss 0.1127, Brier 0.0331.
(Exact stored values: 0.9695664691945679 AUC in
`models/archive/full-data-training_metrics.json`; 0.11270724473096795 log loss and
0.03311632255290847 Brier in `models/archive/full-data-calibration_metrics.json` - both recovered
from git history on 2026-08-23 after the serving artifacts were rebuilt.)

**What is true:** those numbers are real — they are in `models/training_metrics.json` and
`models/calibration_metrics.json`. But they were measured on the March 2017 window, and that same
window was the objective Optuna maximised during hyperparameter search
(`src/hyperparameter_tuning.py`). `train_temporal.py` then fits the final models and reports
performance on that same window. `src/calibrate_and_evaluate.py` fits and evaluates the isotonic
calibrator on a random split of that same already-tuned population.

So the March window was used for model selection, final reporting, and calibration evaluation. **No
window in this repository was withheld from every decision.** The reported figures are therefore
optimistic by an unmeasured amount, and no uncertainty interval is computed anywhere.

**To verify:** build a fourth monthly window (April 2017 features and labels), never look at it
during tuning or calibration, score the frozen model against it once, and report that number
alongside the tuned one.

## 2. Scoring works, but on a retrained serving-sample model (repaired 2026-08-23)

The original defect: `models/xgb.json` declared **131 named features** while
`eval/app_features.csv` carried only **99 predictors**, so XGBoost refused to score and
the API served an empty member cache (`/api/members` returned zero members,
`POST /api/predictions/single` 404ed). Both deployed models (`xgb.json`, `lgb.txt`)
wanted the identical 131 features; 23 of the missing 32 were deterministic transforms of
columns already in the CSV, but 9 were historical churn lags that cannot be regenerated
(section 6).

**Repair:** `scripts/rebuild_serving_artifacts.py` derives those 22 computable columns
with the exact SQL formulas, retrains XGBoost and LightGBM on the shipped 10,000-member
sample (holdout = members whose `sha256(msno)[:8]/2^32 < 0.2`, deterministic from the msno
and persisted in `eval/serving_split.json`; it was a seed-42 stratified random split before
the 2026-08-23 wave-3 repair, which could not be reproduced from committed inputs), and
rewrites the serving CSV plus both metrics files so every recorded number describes exactly
what is served.
`tests/test_artifact_contract.py` now passes with its assertions untouched.

**New honest limitations of the serving artifacts:**

- The serving models are trained on a 10,000-member February-2017-cutoff sample, NOT on
  the full Kaggle training set. Their metrics (xgboost holdout `auc` 0.9765) are measured
  on an in-sample holdout and are **not comparable** to the archived
  full-data tuned-validation numbers in section 1.
- Since the wave-3 repair, the browsable/searchable demo surface serves ONLY the persisted
  holdout population (`eval/serving_split.json`, 1,995 of 10,000 members). Before that
  repair, 80% of the members shown were training split members whose scores were
  systematically optimistic; that exposure is gone from the API, but the underlying sample
  is still an in-sample holdout of a small serving sample, not an external test set.
- The 9 historical churn-lag features remain absent from every artifact here;
  reproducing them still requires the raw transaction history (section 6).

## 3. The API never applies calibration

Serving loads only an XGBoost booster and returns its raw output
(`api/services/model_service.py`). The function that looks like calibration loading reads the metrics
JSON, not a calibrator. No prediction path transforms scores, and no calibrator artifact exists in
`models/`. The calibrated log loss and Brier figures describe an offline LightGBM evaluation, not
anything the API returns.

## 4. The best recorded result (LightGBM) is not what the API loads

Still true structurally: the API loads `models/xgb.json` and describes itself as XGBoost;
`models/lgb.txt` sits beside it unserved. Additionally, `models/xgboost.json` is a stale archived booster left over from before the
2026-08-23 repair; nothing loads it (the API reads `MODEL_PATH = models/xgb.json`, and the
Space Dockerfile ships only `xgb.json`, `training_metrics.json`,
`calibration_metrics.json`, and `eval/app_features.csv`). It does not match the served
model and its contents must not be cited as describing anything live. Since the
2026-08-23 repair,
`models/training_metrics.json` records honest holdout metrics for BOTH retrained models
(lightgbm holdout AUC 0.9799 vs xgboost 0.9765 on the serving sample), so the metrics
endpoint no longer contradicts the served model. What remains is a presentation gap:
portfolio copy citing the archived full-data LightGBM tuned-validation AUC of 0.9696 must
not be presented as describing the demo's served model. See
`docs/repair/space-redeploy-plan.md`.

## 5. The rolling backtest produces nothing

`evaluate_window()` is defined in `src/backtest.py:199` and **is never called**. `main()` builds
features, merges labels, writes per-window CSVs, leaves its `rows` list empty, and then writes that
empty list to `eval/backtests.csv`. The committed `eval/backtests.csv` is **zero bytes**.

Any reference to "rolling backtests" as a produced result is unsupported. The `make backtest` and
`make backtest-ci` targets run this code path.

## 6. The 131-feature training set cannot be regenerated from the current pipeline

`src/historical_features.py` writes historical churn lag features to separate CSVs
(`eval/historical_features_*.csv`). No code joins those into `features/features_comprehensive.sql`
output or into the backtest output. `run_full_pipeline.py` runs the generator and then independently
runs the backtest SQL; the two never meet.

Yet `models/training_metrics.json` records 131 features, and the checked-in model artifacts name
historical lag columns. The dataset that produced the headline model is **absent from the repository
and not reproducible by the shown orchestration**. (Since 2026-08-23 the *serving* artifacts are
reproducible via `scripts/rebuild_serving_artifacts.py`, but only on the shipped 10k sample; the
original full-data 131-feature training set remains unreproducible.)

## 7. The current feature builder cannot feed the trainer

`features/features_comprehensive.sql` selects `is_churn` from the train placeholder.
`src/backtest.py` then merges a labels dataframe that also has `is_churn`, with no suffix handling,
producing `is_churn_x` / `is_churn_y`. `train_temporal.py` requires a literal `is_churn` column. The
`make features` → `make models` path should fail before model fitting.

## 8. The 30-day label boundary is implemented two different ways

- `src/labels.py` uses `DATE_DIFF(...) <= window_days`: renewal on day 30 counts as **retained**.
- `src/backtest.py` uses `DATE_DIFF(...) < window_days`: the same member is **churned**.

A project built around the official 30-day rule cannot have two answers at the boundary. See
[DECISIONS-PENDING.md](DECISIONS-PENDING.md).

## 9. Categorical encoding is not stable across splits

`prepare_features()` in `train_temporal.py` fits a fresh `LabelEncoder` on whatever dataframe it is
given, and it is called separately for train and validation. Category code 0 can therefore denote
different underlying values in the two sets. `src/stacking.py` and `src/hyperparameter_tuning.py`
repeat the pattern. The effect on the reported metrics has not been measured.

## 10. The stacked ensemble's out-of-fold scheme is not time-safe

`src/stacking.py` concatenates the January and February snapshots and then generates out-of-fold
predictions with `StratifiedKFold(shuffle=True)`. Later snapshots — and potentially another row for
the same member — can land in folds used to predict earlier snapshots. Whatever the stacked ensemble
metrics mean, they do not carry the temporal guarantee the rest of the project is built around.

## 11. The dashboard is a static presentation, not an integrated application

- **Route mismatch.** The frontend health check requests `/health`; the backend exposes
  `/api/health`. Member prediction requests `GET /api/predict/{id}`; the backend exposes
  `POST /api/predictions/single`. (`services/apiService.ts`, `api/main.py`,
  `api/routers/predictions.py`.)
- **Mock explanations.** `MemberLookup.tsx` falls back to generated factors both when offline and
  when the API call fails. With the checked-in artifacts, that is always.
- **Synthetic beeswarm.** `ShapBeeswarm.tsx` generates every point with `Math.random()` from global
  feature importance. It contains no sample-level SHAP values.
- **Placeholder member data.** `scripts/export_dashboard_data.py` hard-codes city to 1, tenure and
  active days to 0, and infers auto-renew from the risk score.
- **Docker Compose cannot wire it up as written.** `VITE_API_URL=http://api:8000` is supplied as a
  runtime service environment value, but Vite substitutes client variables during the earlier image
  build, so the compiled client keeps its localhost default. Even moved into the build, a browser
  outside the Compose network could not resolve the internal `api` hostname.

## 12. Business impact figures are assumptions, not measurements

The savings projection multiplies a user-entered churn reduction by one month of ARPU and 12. It
omits intervention cost, treatment reach, incremental lift, uncertainty, and cannibalization, and it
assumes the entered reduction is causally achieved. The precision-recall panel's "business impact"
uses hard-coded $5 per contact, $149 per save, and a 30% save rate.

No experiment, holdout campaign, or uplift model exists in this repository. Nothing here establishes
that acting on these scores would produce incremental revenue.

## 13. The retention rules are largely inert

Most feature names configured in `rules.yaml` (`secs_30d`, `auto_renew_latest`, `cancels_total`,
`plan_days_latest`, `activity_decay_ratio`) do not exist in the 131-feature model. The matcher in
`api/services/rules_service.py` also ignores the configured `feature_impact` entirely. In practice
most members receive generic score-tier copy. No campaign evaluation of any rule exists.

## 14. `top_risk_factors` is not member-level

Member precomputation assigns the same three globally important features to every member
(`api/services/model_service.py`). Despite the field name, these are not per-member drivers.

## 15. Calibration data is now real, but the API still never applies the calibrator

Repaired 2026-08-23: `models/calibration_metrics.json` now carries real reliability-diagram
points (isotonic fit on out-of-fold training predictions, evaluated on the holdout), so
`GET /api/calibration` serves measured curves instead of synthesized ones. Still true:
no prediction path transforms scores through the calibrator (section 3), and the fields
named `ece_before` / `ece_after` in that route are still Brier scores, not ECE. No ECE is
computed anywhere in this repository.

## 16. The health check can call a broken system healthy

`/api/health` returns `status="healthy"` unconditionally and exposes only booleans for whether the
model and feature files loaded. `docker-compose.yml` checks only for HTTP 200. Missing predictions,
a feature mismatch, and an empty member cache all pass this check.

## 17. ~~`make test` hides suite failures~~ — FIXED 2026-08-23

The `|| python3 tests/test_temporal_safety.py` fallback was removed from both `test` and `test-ci`
in the Makefile, and `requirements.txt` now installs the API dependencies (`fastapi`,
`pydantic-settings`, `uvicorn`, `httpx`) that `tests/api_tests/test_endpoints.py` needs to even be
collected. A fresh `make install && make test` no longer silently substitutes a single passing file
for the suite; failures surface with their real exit code. What still fails is described in §19.

## 18. CI is green by construction around the riskiest stages

In `.github/workflows/ci.yml`: ruff and black failures are `continue-on-error`; the test step runs
only `tests/test_temporal_safety.py` and `tests/test_new_modules.py`, excluding the label,
comprehensive-window, calibration, and API tests; and the calibration, integration, and backtest
steps are all `continue-on-error`. A green badge does not indicate the pipeline works.

## 19. The test suite does not pass

Measured on 2026-08-23 from a clean clone (`git clone` of this repository into an empty directory,
fresh virtualenv, `pip install -r requirements.txt`):

- The suite runs to completion (no collection error since `requirements.txt` now includes the API
  dependencies): **10 failed, 70 passed** (`make install && make test` measured on the fixed
tree; `make test` exits 2).
- Failures sit in `tests/test_labels.py` (6), `tests/test_feature_windows.py` (2), and
  `tests/test_artifact_contract.py` (2, the serving-contract mismatch documented in §2).
- On 2026-08-09 the count was 16 failures plus a collection error, measured before the API
  dependencies were installable from `requirements.txt`; several label/window tests were evidently
  repaired between those dates, and today's numbers are the current baseline.

Because the Makefile fallback is gone (§17), these failures now abort `make test` with a non-zero
exit instead of being hidden.

## 20. Much of the test suite asserts existence, not behavior

`tests/test_calibration_modules.py` largely asserts that classes and functions import or have
methods. `tests/api_tests/test_endpoints.py` skips its assertions when the member list is empty
(which it is) and accepts SHAP failures as expected outcomes. The genuinely strong tests are
`tests/test_temporal_safety.py` and `tests/test_feature_windows.py`, which execute the SQL and assert
exact aggregate values across cutoff boundaries.

## 21. `ship.sh` does not run

It passes `--cutoff` while the label CLI defines `--cutoff-date`; it reads
`improvement.brier_delta` and `improvement.ece_delta` while the committed calibration artifact
contains `improvement.brier` and no ECE at all; and it invokes `scripts/update_readme.py`, which is
not at that path.

## 22. Assets referenced in docs are LFS pointers here

`eval/calibration_reliability_diagram.png`, `eval/calibration_distributions.png`,
`eval/calibration_isotonic_mapping.png`, and `1802.03396v1.pdf` are Git LFS pointer files (~130
bytes each) in this checkout, not the images and paper themselves. Any claim resting on the contents
of the cited paper cannot be checked from this clone.

## 23. Multiple overlapping implementations, no authoritative path

`train_models.py` calls `src/models.py`; the path that produced the reported result is
`train_temporal.py`; orchestration lives in `run_full_pipeline.py`; and calibration is implemented
twice, in `src/calibration.py` and `src/calibrate_and_evaluate.py`. A reader cannot tell from the
repository which path is canonical.

## 24. Things that were never evaluated at all

None of the following has a supporting artifact anywhere in this repository. They are listed so that
nobody mistakes their absence for a passing result:

- Accuracy, precision, or recall at any threshold
- Expected calibration error (ECE) or a reliability diagram with bin counts
- Per-segment performance
- Any fairness or disparate-impact analysis, despite city, age, gender, and registration channel
  being model inputs
- API latency, throughput, or a load test
- Drift monitoring output (`scripts/psi_scores.py` exists; no PSI result is recorded)
- Robustness to activity gaps, pricing changes, or platform-wide behavior shifts
- Any comparison against the competition winners' actual solutions

## 25. The documented pipeline path overwrites the cited metric artifact

Measured 2026-08-23 from a clean clone: `make features && make models` runs on synthetic data and
rewrites `models/training_metrics.json` in place (212 lines changed), replacing the artifact the
README and this file cite with synthetic-data numbers (1,000 samples, 9 features, XGBoost AUC
0.4716). A visitor who follows the documented pipeline destroys the very evidence the
documentation points at. The model binaries were byte-identical after the run, but the metric
artifact was not.

---

## What would make this repository defensible

In rough order of value per hour:

1. **An artifact-contract test.** Load the configured model and `eval/app_features.csv`, assert exact
   ordered feature-name parity, score ten rows, assert finite probabilities. Run it in blocking CI.
   Right now it would fail — and a visible failing contract is far better than a hidden one.
2. **Remove the `|| python3 tests/test_temporal_safety.py` fallback** from the Makefile test targets,
   and add FastAPI to the install target so the full suite can actually run.
3. **One untouched window.** Build April 2017, never tune on it, score once, and report that number
   next to the tuned one.
4. **Pick one label boundary** and make both implementations agree, with a test at day 30.
5. **Wire the historical lag features into the feature pipeline**, or state clearly that the shipped
   model uses a dataset built by a path no longer in the repository.

See [DECISIONS-PENDING.md](DECISIONS-PENDING.md) for the claims that were deleted rather than fixed,
and what fixing each would take.
