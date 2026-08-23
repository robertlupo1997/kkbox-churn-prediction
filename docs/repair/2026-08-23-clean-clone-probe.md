# Clean-clone reproducibility probe — 2026-08-23

Method: `git clone --branch pilot/ox-alpha` of this repository into an empty temp directory,
fresh `python3 -m venv` (Python 3.12.3), then the documented path. Two passes: baseline at
commit 2af2fe2, and verification after the fixes in 87c96e7.

## Baseline (2af2fe2)

| Step | Command | Result |
|---|---|---|
| Install | `make install` | exit 0; installs requirements.txt only — **no FastAPI/uvicorn/pydantic-settings/httpx** |
| API import | `python -c "import api.main"` | `ModuleNotFoundError: No module named 'fastapi'` |
| Full suite | `python -m pytest tests/ -c pytest.ini` | exit 2 — collection error: `tests/api_tests/test_endpoints.py` imports fastapi |
| Suite minus api_tests | `pytest tests/ --ignore=tests/api_tests` | exit 1 — **8 failed, 69 passed** (6 in test_labels.py, 2 in test_feature_windows.py) |
| `make test` (documented entry) | `make test` | **exit 0** — fallback ran only tests/test_temporal_safety.py and reported "All temporal safety tests passed!" while the suite had a collection error + 8 failures |
| Features | `make features` | exit 0 (synthetic data, 1000 rows / 12 features) |
| Models | `make models` | exit 0 on synthetic data (AUC 0.4716); **overwrote `models/training_metrics.json`** (git shows the file modified) |
| Artifact contract | load `models/xgb.json` vs `eval/app_features.csv` | model declares **131** named features; CSV has 102 columns = **99 predictors**; **32 model features absent from CSV**, 0 extra; ordered parity false |

Exact missing-feature probe output:

```
model features: 131
app_features.csv columns: 102 -> predictors: 99
in model but not CSV: 32 ['autorenew_not_cancel', 'discount', 'amt_per_day',
'canc_per_payment_days', 'unq_trend_14v30', 'listening_trend_ratio', 'secs_cv_30d',
'days_since_tx_per_plan', 'last_trx_gt1_no_cancel', 'ul_last2wk_vs_month_unq_ratio', ...]
in CSV but not model: 0 []
ordered parity: False
```

## After fixes (87c96e7), fresh clone + fresh venv

| Step | Command | Result |
|---|---|---|
| Install | `make install` | exit 0 — now includes fastapi, pydantic-settings, uvicorn, httpx |
| API import | `from api.main import app` | OK (`KKBOX Churn API`) |
| Documented test entry | `make install && make test` | exit 2 — failures now visible: **10 failed, 70 passed** |

Failure breakdown after fixes: 6 `tests/test_labels.py`, 2 `tests/test_feature_windows.py`,
2 `tests/test_artifact_contract.py` (the serving contract of LIMITATIONS §2, deliberately visible).

## Still broken for a visitor (not cheaply fixable here)

- Serving mismatch (LIMITATIONS §2): the API cannot produce real predictions from checked-in
  artifacts; member cache stays empty. Fix requires rebuilding the serving dataset or retraining.
- `make app` requires Docker and, per LIMITATIONS §11, docker-compose cannot wire frontend to
  backend as written.
- The real-data pipeline (`make backtest`, historical lag features) needs ~30 GB of Kaggle data;
  untested here by design.
