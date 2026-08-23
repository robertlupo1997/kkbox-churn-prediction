# Evidence — kkbox serving rebuild, 2026-08-23T16:56:17-04:00, HEAD 948b61640ff0a741de68124f61a3756d77f765bb

## make test (in .venv)
```

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
=========================== short test summary info ============================
FAILED tests/test_feature_windows.py::TestFeatureWindows::test_temporal_window_boundaries
FAILED tests/test_feature_windows.py::TestFeatureWindows::test_malformed_data_handling
FAILED tests/test_labels.py::TestChurnLabels::test_basic_churn_rule - Asserti...
FAILED tests/test_labels.py::TestChurnLabels::test_validation_accuracy - Valu...
FAILED tests/test_labels.py::TestChurnLabels::test_edge_case_same_day_renewal
FAILED tests/test_labels.py::TestChurnLabels::test_multiple_expirations_per_user
FAILED tests/test_labels.py::TestChurnLabels::test_malformed_dates - _duckdb....
FAILED tests/test_labels.py::TestChurnLabels::test_analyze_mismatches - KeyEr...
=================== 8 failed, 72 passed, 3 warnings in 2.63s ===================
make: *** [Makefile:57: test] Error 1
```
make test exit: 2 (expected - the 8 pre-existing label/window failures above; an earlier revision of this line wrongly recorded 0 because the shell's PIPESTATUS had been clobbered by an intervening echo)

## tests/test_artifact_contract.py
```
configfile: pytest.ini
plugins: cov-4.1.0, hypothesis-6.88.1, anyio-4.14.2
collected 3 items

tests/test_artifact_contract.py ...                                      [100%]

============================== 3 passed in 1.32s ===============================
```

## clean-machine install path (no VIRTUAL_ENV, no pre-existing .venv)
```
clean-machine make install exit: 0  (.venv created; log excerpt: Successfully installed ... xgboost-2.0.2 lightgbm-4.7.0 fastapi-0.141.1)
```

## live API probe (uvicorn on :8123, rebuilt artifacts)
```
GET /api/health   -> {"status":"healthy","model_loaded":true,"features_loaded":true}
GET /api/members?limit=3 -> {"members":[...3 objects...],"total":10000,...} (first member risk_score 0.9973, tier High)
GET /api/metrics  -> {"model_name":"xgboost","log_loss":0.14058712124824524,"auc":0.9791015624999999,"brier_score":0.038950023066589144,"training_samples":8000,"validation_samples":2000}
POST /api/predictions/single {"msno":"dNIykH..."} -> 200 {"churn_probability":0.9972752928733826,"risk_tier":"High",...}
```

## determinism check: rerun rebuild script, compare metrics
```
IDENTICAL across rerun (seed 42 deterministic)
```

## Post-fix verification (review round 1, HEAD debc8c3, 2026-08-23)

Reviewer refutation upheld: `/api/calibration` checked top-level curve keys while
`models/calibration_metrics.json` nests them under `xgboost`, so the endpoint served its
synthetic fallback despite real curves being committed.

Fix: `api/routers/metrics.py` now falls back through per-model blocks to find
`uncalibrated`/`calibrated`; `tests/test_calibration_serving.py` loads the ACTUAL
committed artifact through the route function and asserts the served points equal the
stored ones (and that no literal synthetic point appears).

Live probe after fix (uvicorn :8125): `/api/calibration` returns measured values, e.g.
`{"mean_predicted": 0.009792834858760726, "fraction_of_positives": 0.016260162601626018}`.

Suite at fix commit: 8 failed / 74 passed - the pre-existing label/window set unchanged,
+2 new drift-guard tests.
