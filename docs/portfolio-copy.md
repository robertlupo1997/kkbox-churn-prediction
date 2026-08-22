# Portfolio Copy: KKBOX Churn Prediction

> Every figure below is sourced from a checked-in artifact. Read [LIMITATIONS.md](../LIMITATIONS.md)
> before reusing this copy anywhere; it states what is unverified.

## Headline Options

**Option A (Technical)**
> End-to-End ML Pipeline for Music Streaming Churn Prediction

**Option B (Results-focused)**
> Predicting Customer Churn at 0.9696 AUC on a Time-Ordered Split — a Tuned-Validation
> Figure, Not Held-Out

**Option C (Full-stack emphasis)**
> Churn Prediction End to End: From Feature Engineering to Interactive Dashboard

---

## Project Summary (Short)

A machine learning project predicting subscriber churn for KKBOX, a music streaming service, using
the WSDM Kaggle competition data. Models are trained on two 2017 monthly windows and evaluated on a
later window, reaching a recorded 0.9696 AUC — measured on the same window used for hyperparameter
tuning, so it is a tuned-validation figure rather than a held-out one. The feature SQL builds
point-in-time aggregates over transaction and listening history; the recorded model uses 131
features. The repository also contains a FastAPI service and a React dashboard that renders exported
JSON.

---

## Project Summary (Extended)

Churn erodes recurring subscription revenue, which is what makes retention targeting worth modelling.
This project tackles the KKBOX churn prediction challenge end to end — from raw transaction logs to
an interactive dashboard for exploring predictions.

The core problem: predict which users will not renew within 30 days of expiration. The approach
combines behavioral signals (listening patterns, skip rates, session frequency) with transaction
history (payment methods, discount usage, renewal patterns) across 7/14/30/60/90-day windows, all
bounded at the observation cutoff so that no post-cutoff data enters a feature.

Evaluation uses a single time-ordered split: two earlier monthly windows to train, one later window
to validate. That removes one common source of optimism, but the same later window was also used for
hyperparameter selection, so the repository contains no untouched test set. Real deployment would
require a clean holdout and validation on current data.

---

## Key Metrics

All measured on the March 2017 window, which Optuna also tuned on. Not held-out figures.

| Metric | Value | Source |
|--------|-------|--------|
| **AUC-ROC (LightGBM)** | 0.9696 | `models/training_metrics.json` |
| **Log Loss (calibrated)** | 0.1127 | `models/calibration_metrics.json` |
| **Brier Score (calibrated)** | 0.0331 | `models/calibration_metrics.json` |
| **Features in recorded model** | 131 | `models/training_metrics.json` |
| **Training rows** | 1,929,125 across two monthly windows | `models/training_metrics.json` |
| **Evaluation** | One fixed later window; also the tuning window | `train_temporal.py` |

---

## Technical Highlights

### Feature Engineering
- 131 features in the recorded model, spanning 7/14/30/60/90-day windows
- Transaction patterns: payment frequency, discount usage, cancellation history
- Listening behavior: session duration, completion rates, unique tracks
- Trend features: week-over-week and month-over-month changes
- Historical churn lag features (generated separately; not joined by the current pipeline)

### Model Pipeline
- XGBoost and LightGBM, plus a 50/50 blend (0.9680 recorded AUC) and a stacked ensemble (0.9638)
- Isotonic calibration cut recorded log loss from 0.4130 to 0.1127 and Brier from 0.1255 to 0.0331;
  recorded AUC shifted slightly, so ranking was not exactly preserved
- One fixed out-of-time split (two earlier windows train, one later window validate) — not
  cross-validation
- `scripts/psi_scores.py` provides a Population Stability Index starting point; drift monitoring is
  not wired into any pipeline

### Dashboard and API
- FastAPI backend exposing member, prediction, metric, importance, calibration and SHAP routes.
  Latency has not been benchmarked; there is no load test or timing artifact in the repository.
- React/TypeScript frontend with interactive visualizations, driven by exported JSON
- SHAP explanation code exists server-side; the dashboard's per-member factors are illustrative
  placeholders, and prediction responses carry no SHAP fields
- Retention savings projection: gross revenue retained under user-supplied assumptions. Campaign
  cost, incremental uplift, and treatment reach are not modelled, so it is not an ROI calculation.

---

## Tech Stack

```
ML Pipeline:      Python, XGBoost, LightGBM, scikit-learn, DuckDB
API:              FastAPI, Pydantic, uvicorn
Frontend:         React 19, TypeScript, Tailwind CSS, Recharts
Interpretability: SHAP
Infrastructure:   Docker, GitHub Actions (workflows present but non-gating)
```

---

## What This Project Demonstrates

1. **Point-in-time feature construction** — Every window aggregate is bounded on both sides of the
   observation cutoff in SQL, and unit tests fabricate post-cutoff events to prove they are excluded.

2. **Calibration treated as a separate problem from ranking** — Raw scores are transformed into
   calibrated probability estimates with isotonic regression, with before/after metrics recorded
   rather than asserted.

3. **Containerized delivery** — Docker configuration, an automated test suite, and a `make app`
   command for local startup.

4. **Explainability code paths** — A SHAP endpoint that returns model SHAP values, or an explicitly
   flagged importance-based approximation when true SHAP is unavailable.

---

## Challenges Worked On

- **Leakage testing**: unit tests fabricate "future" events on both sides of the cutoff and assert
  exact aggregate values, including 89/91-day and 29/31-day boundaries
- **Class imbalance**: roughly 9% churn rate, which is what makes calibration matter here
- **Scale**: DuckDB/SQL feature engineering written to run over the full KKBOX transaction and
  listening files. Byte volume and runtime are not recorded in any execution log in the repository.
- **Interpretability**: SHAP integration with an explicit approximation fallback

---

## Links

- **GitHub**: [View Source Code →](https://github.com/robertlupo1997/kkbox-churn-prediction)
- **Live Demo**: [Hugging Face Spaces](https://huggingface.co/spaces/robertlupo1997/kkbox-churn-prediction)
