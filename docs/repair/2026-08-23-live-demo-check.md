# Live demo check — Hugging Face Space — 2026-08-23 ~19:30 UTC

Target: https://huggingface.co/spaces/robertlupo1997/kkbox-churn-prediction
Direct app host: https://robertlupo1997-kkbox-churn-prediction.hf.space

All commands were plain `curl` from this machine; outputs verbatim below.

## Result: the Space is UP, but serves the documented-broken behavior and the non-headline model's metrics

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

## Key observation: the Space serves the repository's XGBoost numbers, not the headline model

The live `/api/metrics` reports **AUC 0.964237080730037** and log loss **0.41340251510455955**.
These are byte-identical to the `xgboost` entry in the **current, checked-in**
`models/training_metrics.json` — so there is no evidence of build staleness; the Space matches this
repository's artifacts. (Its reported `brier_score` 0.03560055180046916 does differ from the
artifact's uncalibrated xgboost `brier` 0.12455760073094979.)

What the discrepancy actually is: the Space surfaces the **XGBoost tuned-validation AUC (0.9642)**
while the portfolio headline cites **LightGBM AUC 0.9696** — a same-artifact, different-model
presentation inconsistency, consistent with LIMITATIONS §4 ("the API serves a different model from
the one the results describe"), not with an outdated deployment. The Space also serves raw scores
with no calibration applied, per LIMITATIONS §3.

*Correction (2026-08-23, post-review):* an earlier version of this section inferred that the Space
runs "an older/different build" of the repository. That inference was wrong — the auc and log_loss
values match the current checked-in artifact exactly, as shown above.

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
