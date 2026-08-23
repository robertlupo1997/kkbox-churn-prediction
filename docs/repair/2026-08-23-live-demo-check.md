# Live demo check — Hugging Face Space — 2026-08-23 ~19:30 UTC

Target: https://huggingface.co/spaces/robertlupo1997/kkbox-churn-prediction
Direct app host: https://robertlupo1997-kkbox-churn-prediction.hf.space

All commands were plain `curl` from this machine; outputs verbatim below.

## Result: the Space is UP, but serves the documented-broken behavior and stale metrics

| Probe | Status | Observed |
|---|---|---|
| Landing page (huggingface.co) | 200 | 36,047 bytes HTML |
| App root `/` | 200 | React SPA, title `KKBox Churn Analysis Pro \| Portfolio`, served by `server: uvicorn` behind HF proxy |
| `GET /api/health` | 200 | `{"status":"healthy","model_loaded":true,"features_loaded":true}` — note LIMITATIONS §16: this endpoint reports healthy unconditionally |
| `GET /api/members` | 200 | `{"members":[],"total":0,"limit":100,"offset":0}` — **empty member cache**, exactly the §2 clean-clone symptom |
| `POST /api/predictions/single` (real msno from eval/app_features.csv) | 404 | `{"detail":"Member 7yNW7DjZm54Syzx/Rc5sjG8oESwPNMV4xqevwK6/MWw= not found"}` — §2 predicted exactly this |
| `GET /api/metrics` | 200 | `{"model_name":"xgboost","log_loss":0.41340251510455955,"auc":0.964237080730037,...}` |
| `GET /api/features/importance` | 200 | top feature `auto_renew_ratio_30d` |
| `GET /api/metrics/calibration` | 200* | body is `{"detail":"Not Found"}` despite HTTP 200; route exists in current repo code |

## Key discrepancy: the Space's numbers do not match the repository

The live `/api/metrics` reports **AUC 0.9642**, log loss 0.41340, Brier 0.03560.
The checked-in artifact `models/training_metrics.json` (source of the settled README figures)
reports AUC **0.9696**. The deployed Space therefore runs an older/different build than the
repository it is cited as proof of. It also still serves XGBoost raw scores with no calibration,
consistent with LIMITATIONS §3/§4.

Verbatim:

```
$ curl -sS https://robertlupo1997-kkbox-churn-prediction.hf.space/api/health
{"status":"healthy","model_loaded":true,"features_loaded":true}

$ curl -sS https://robertlupo1997-kkbox-churn-prediction.hf.space/api/members
{"members":[],"total":0,"limit":100,"offset":0}

$ curl -sS -X POST -H "Content-Type: application/json" \
    -d '{"msno":"7yNW7DjZm54Syzx/Rc5sjG8oESwPNMV4xqevwK6/MWw="}' \
    https://robertlupo1997-kkbox-churn-prediction.hf.space/api/predictions/single
{"detail":"Member 7yNW7DjZm54Syzx/Rc5sjG8oESwPNMV4xqevwK6/MWw= not found"}

$ curl -sS https://robertlupo1997-kkbox-churn-prediction.hf.space/api/metrics
{"model_name":"xgboost","log_loss":0.41340251510455955,"auc":0.964237080730037,
"brier_score":0.03560055180046916,"ece":null,"training_samples":1929125,
"validation_samples":970960}
```

## Reading

The Space being up proves deployment works, not that the product works: every prediction-facing
route returns empty/not-found on the live instance, which matches the serving-contract break in
LIMITATIONS §2. Redeploying the Space from a fixed build is outside this repository run.
