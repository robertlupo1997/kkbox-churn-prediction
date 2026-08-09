# Limitations

This is the honest inventory of what this project does **not** do, what is unverified, and what it
would take to verify each item. Every entry cites the file that establishes it, so you can check any
claim here in under a minute.

If a statement anywhere else in this repository conflicts with this file, this file is correct.

---

## 1. The headline metrics are tuned-validation numbers, not held-out results

**What is claimed elsewhere:** LightGBM AUC 0.9696, calibrated log loss 0.1127, Brier 0.0331.

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

## 2. Scoring does not work from a clean clone

`api/config.py` loads `models/xgb.json`, which declares **131 named features**. The checked-in
`eval/app_features.csv` has 102 columns, of which 3 are metadata (`msno`, `is_churn`, `cutoff_ts`),
leaving **99 predictors**. `api/services/model_service.py` builds a `DMatrix` straight from those
columns, so XGBoost raises a feature-name mismatch.

The service catches that and falls back to a precomputed predictions file
(`eval/stacked_ensemble_predictions.csv`), which is **not committed** and is git-ignored
(`.gitignore:83`). The member cache therefore stays empty. Consequences:

- `GET /api/members` returns an empty list
- `POST /api/predictions/single` returns 404
- `POST /api/predictions` marks every member not found
- `GET /api/shap/{msno}` returns the flagged importance-based approximation, never true SHAP

**To verify a fix:** add a test that loads the configured model and feature file, asserts exact
ordered feature-name parity, scores ten rows, and asserts finite probabilities.

## 3. The API never applies calibration

Serving loads only an XGBoost booster and returns its raw output
(`api/services/model_service.py`). The function that looks like calibration loading reads the metrics
JSON, not a calibrator. No prediction path transforms scores, and no calibrator artifact exists in
`models/`. The calibrated log loss and Brier figures describe an offline LightGBM evaluation, not
anything the API returns.

## 4. The API serves a different model from the one the results describe

The best recorded result is LightGBM. The API loads `models/xgb.json` and describes itself as
XGBoost (`api/config.py`, `api/main.py`). Both models are checked in; only the XGBoost one is wired
to the service.

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
and not reproducible by the shown orchestration**.

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

## 15. The calibration endpoint fabricates its curve

When curve arrays are absent from the metrics file — and they are absent from the committed
`models/calibration_metrics.json` — `api/routers/metrics.py` **synthesizes** near-diagonal
before/after points rather than returning nothing. The same route populates fields named
`ece_before` / `ece_after` with Brier scores. No ECE is computed anywhere in this repository, and no
reliability data backs any calibration-quality statement.

## 16. The health check can call a broken system healthy

`/api/health` returns `status="healthy"` unconditionally and exposes only booleans for whether the
model and feature files loaded. `docker-compose.yml` checks only for HTTP 200. Missing predictions,
a feature mismatch, and an empty member cache all pass this check.

## 17. `make test` hides suite failures

```make
test:
	python3 -m pytest tests/ -v --tb=short -c pytest.ini 2>/dev/null || python3 tests/test_temporal_safety.py
```

If any collection error or test failure occurs, stderr is discarded and Make runs a single file
instead. If that one file passes, `make test` reports success. `test-ci` has the same fallback.

The advertised install target also omits API dependencies (`requirements.txt` has no FastAPI), while
`tests/api_tests/test_endpoints.py` imports FastAPI — so a fresh `make install && make test` takes
the fallback path.

## 18. CI is green by construction around the riskiest stages

In `.github/workflows/ci.yml`: ruff and black failures are `continue-on-error`; the test step runs
only `tests/test_temporal_safety.py` and `tests/test_new_modules.py`, excluding the label,
comprehensive-window, calibration, and API tests; and the calibration, integration, and backtest
steps are all `continue-on-error`. A green badge does not indicate the pipeline works.

## 19. The test suite does not pass

Measured on 2026-08-09 in this checkout:

- `python -m pytest tests/` **fails at collection**: `tests/api_tests/test_endpoints.py` imports
  FastAPI, which `requirements.txt` does not install.
- `python -m pytest tests/ --ignore=tests/api_tests` runs, and **16 tests fail** — across
  `tests/test_labels.py`, `tests/test_feature_windows.py`, and `tests/test_calibration_modules.py`.

Because `make test` swallows this and falls back to a single file (see §17 above), the failures are
not visible through the advertised entry point.

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
