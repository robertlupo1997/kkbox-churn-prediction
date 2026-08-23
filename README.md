---
title: KKBOX Churn Prediction
emoji: "🎵"
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# KKBOX Churn Prediction

> A churn modelling project on the WSDM KKBOX Churn Prediction Challenge: SQL/DuckDB point-in-time
> feature engineering, gradient-boosted models evaluated on a later time window, a FastAPI service,
> and a React dashboard driven by exported JSON.

**Read [LIMITATIONS.md](LIMITATIONS.md) before evaluating the numbers below.** It states plainly what
this repository does not do and what is not currently reproducible from a clean clone.

![Dashboard Preview](assets/dashboard.gif)

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/frontend-React_19-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/api-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![LightGBM](https://img.shields.io/badge/model-LightGBM-green.svg)](https://lightgbm.readthedocs.io/)

## Demo

Run the stack locally:

```bash
make app  # Starts API on :8000, Dashboard on :3000
```

A Hugging Face Spaces URL is also published at
[robertlupo1997/kkbox-churn-prediction](https://huggingface.co/spaces/robertlupo1997/kkbox-churn-prediction).
Checked on 2026-08-23: the Space loads and answers, but its member cache is empty, prediction
routes return "not found", and it surfaces the XGBoost tuned-validation AUC (0.9642) rather than
the LightGBM headline above — see
[`docs/repair/2026-08-23-live-demo-check.md`](docs/repair/2026-08-23-live-demo-check.md).

The dashboard runs from checked-in exported JSON and 200 sample members. Its live-API code path does
not currently match the FastAPI routes, and individual explanations shown in the UI are generated
placeholders, not model SHAP values. See [LIMITATIONS.md](LIMITATIONS.md).

## Recorded Results

The figures below are **historical full-population tuned-validation numbers** recovered from git
history into `models/archive/` when the serving artifacts were rebuilt on 2026-08-23. All of them
come from the **March 2017 window, which was also the window Optuna maximised AUC over during
hyperparameter selection** (`src/hyperparameter_tuning.py`, `train_temporal.py`). They are therefore
tuned-validation numbers, not held-out test numbers, and they **describe no served model**. **This
repository contains no untouched test window.** Values are quoted exactly as stored in the archived
artifacts (the often-cited roundings 0.9696 / 0.1127 / 0.0331 derive from these). The currently
served model has its own separate metrics in `models/training_metrics.json`.

| Metric | Baseline | Best recorded | Source |
|--------|----------|---------------|--------|
| AUC (LightGBM, uncalibrated) | 0.8690087735213405 (logistic regression) | 0.9695664691945679 | `models/archive/full-data-training_metrics.json` |
| Log loss (LightGBM, after isotonic calibration) | 0.41297890834500645 before | 0.11270724473096795 | `models/archive/full-data-calibration_metrics.json` |
| Brier score (LightGBM, after isotonic calibration) | 0.12552498527058062 before | 0.03311632255290847 | `models/archive/full-data-calibration_metrics.json` |

The calibration figures were computed on a random split of that same already-tuned March population
(`src/calibrate_and_evaluate.py`), so they are not independent of the tuning either.

Recorded dataset sizes: 1,929,125 training rows across two 2017 monthly windows and 970,960
validation rows in the later window (`models/archive/full-data-training_metrics.json`; the served
model trains on 10,000 rows - see `models/training_metrics.json`). These are row counts; a member
can appear in more than one monthly window, and no distinct-member count is recorded.

**That overlap is itself a leakage channel for the recorded AUC.** Because the same `msno` can appear
in both the training and validation snapshots, the score partly reflects the model recognising members
it has already seen rather than generalising to new ones. The split is temporal, not by member, and
nothing in this repository measures how much of the recorded AUC that overlap accounts for. A
member-disjoint split would be needed to separate the two, and it has not been run.

Accuracy, precision, and recall are not reported here: no artifact in the repository contains them
and the predictions needed to recompute them are not checked in.

No comparison against the competition winners is made. The repository holds no winner evaluation
artifact, and the cited paper file is a Git LFS pointer in this checkout.

## What Is Actually Built

- **Point-in-time feature SQL** (`features/features_comprehensive.sql`) that bounds transactions and
  user logs on both sides of the observation window before aggregating, so features for a cutoff
  date use only data available at that date.
- **Temporal-safety tests** (`tests/test_temporal_safety.py`, `tests/test_feature_windows.py`) that
  fabricate events on both sides of a cutoff and assert exact aggregate values, including 89/91-day
  and 29/31-day boundary cases. These tests execute the SQL they check.
- **Model training over a time-ordered split** (`train_temporal.py`): two earlier monthly windows for
  training, a later window for validation. This is a single fixed out-of-time split, not
  cross-validation.
- **Isotonic calibration** code and recorded before/after metrics (`src/calibrate_and_evaluate.py`).
- **A FastAPI service** (`api/`) with routes for members, predictions, metrics, feature importance,
  calibration curves, and SHAP explanations.
- **A React dashboard** rendering exported JSON artifacts.

## The Problem

KKBOX is a music streaming service. The [Kaggle competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
asks which subscribers will fail to renew. A user churns if they do not renew within 30 days after
membership expiration.

High AUC alone is not enough for retention targeting: the model must also output probabilities whose
magnitudes mean something, which is why calibration is evaluated separately here.

## Pipeline Shape

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE ENGINEERING                          │
│  Transactions (7/14/30/60/90d)  User logs (7/14/30/60/90d)      │
│  Historical churn lags (generated to separate CSVs)             │
│         ↓                                                       │
│  131 features in the recorded training artifact                 │
│  (see LIMITATIONS.md: the joined training set that produced     │
│   those 131 columns is not reproducible from the current code)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MODEL TRAINING                             │
│  ARCHIVED tuned-validation figures (no served model; exact      │
│  values in models/archive/): LightGBM ~0.9696 │ XGBoost ~0.9642 │
│  50/50 blend ~0.9680                                            │
│         ↓                                                       │
│  Isotonic calibration → log loss ~0.1127, Brier ~0.0331         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SERVING (as checked in)                    │
│  FastAPI loads models/xgb.json — the XGBoost booster, raw and   │
│  uncalibrated. LightGBM had the better recorded AUC but is not  │
│  the artifact the API serves, and no calibrator is loaded.      │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: Full Stack

```bash
git clone https://github.com/robertlupo1997/kkbox-churn-prediction.git
cd kkbox-churn-prediction
make app

# Dashboard at http://localhost:3000
# API at http://localhost:8000/api/health
```

The dashboard serves its checked-in sample data. Member prediction through the API works from a
clean clone as of 2026-08-23: `eval/app_features.csv` and `models/xgb.json` agree on an exact
ordered feature list (`tests/test_artifact_contract.py` enforces this), and the served models are
retrained on the shipped sample via `scripts/rebuild_serving_artifacts.py`. Remaining caveats:
the Docker Compose frontend API URL is supplied at runtime although Vite substitutes it at build
time, and the served model's metrics describe a 10k-member serving-sample holdout, not the
full-data tuned-validation numbers quoted elsewhere. See [LIMITATIONS.md](LIMITATIONS.md).

### Option 2: ML Pipeline Only

```bash
pip install -r requirements.txt

make test      # See LIMITATIONS.md: this target masks suite failures
make features  # Generate features
make models    # Train models
make calibrate # Calibrate predictions
```

`make features` followed by `make models` does not currently run end to end; the feature builder
emits duplicate `is_churn` columns that the trainer cannot consume (`src/backtest.py`,
`train_temporal.py`).

### Option 3: Frontend Development

```bash
cd brutalist-aesthetic-kkbox-churn-analysis-pro
npm install
npm run dev    # http://localhost:3000
```

## Project Structure

```
kkbox-churn-prediction/
├── src/                          # ML Pipeline
│   ├── features_processor.py     # Feature engineering
│   ├── models.py                 # Model training
│   ├── calibration.py            # Isotonic calibration
│   ├── temporal_cv.py            # Temporal validation helpers
│   └── backtest.py               # Backtest driver (evaluation step not wired up)
├── api/                          # FastAPI Backend
│   ├── main.py                   # App entry point
│   ├── routers/                  # API endpoints
│   └── services/                 # Model loading, rules
├── brutalist-aesthetic-.../      # React Dashboard (renders exported JSON)
├── features/                     # SQL feature definitions
├── models/                       # Trained model artifacts and metric JSON
├── eval/                         # Evaluation outputs
└── tests/                        # Test suite
```

## Dashboard Pages

| Page | What it shows |
|------|---------------|
| **Dashboard** | KPI cards computed from exported aggregates, risk distribution, member table, CSV export |
| **Member Lookup** | Search across the 200 checked-in sample members; the factor waterfall is an illustrative placeholder, not model SHAP output |
| **Model Performance** | Recorded AUC/log loss, calibration curves, lift and gains charts from exported JSON |
| **Feature Importance** | Grouped XGBoost importance, plus an explicitly synthetic beeswarm generated from global importance |
| **Retention Savings Projection** | Gross revenue retained under user-supplied assumptions; no campaign cost, uplift, or experiment evidence |

## API Endpoints

```
GET  /api/health              # Liveness: reports whether model and feature files loaded
GET  /api/members             # Cached members (empty unless compatible features are supplied)
GET  /api/members/{id}        # Member features, risk fields, rule-selected action
POST /api/predictions/single  # Single cached prediction
POST /api/predictions         # Batch cached predictions (max 1000)
GET  /api/metrics             # Recorded model metrics
GET  /api/features/importance # Feature importance list
GET  /api/calibration         # Calibration curve points
GET  /api/shap/{member_id}    # SHAP values, or an explicitly flagged approximation
```

See [api/README.md](api/README.md) for request and response shapes and for what does not work with
the checked-in defaults.

## Feature Engineering

The feature set spans transaction, listening, demographic, trend, and historical-churn families
across 7/14/30/60/90-day windows. Several features are labelled "winner-inspired" in source comments,
referencing [Bryan Gregory's 1st place solution](https://arxiv.org/abs/1802.03396); the repository
does not carry a traceable feature-to-source derivation, and the paper file is an LFS pointer here.

### Top Recorded Features (XGBoost importance)

| Feature | Importance | Description |
|---------|------------|-------------|
| `auto_renew_ratio_30d` | 1.000 | Ratio of auto-renew transactions (30 days) |
| `auto_renew_ratio_60d` | 0.222 | Ratio of auto-renew transactions (60 days) |
| `cancel_count_30d` | 0.107 | Number of cancellations (30 days) |
| `latest_auto_renew` | 0.055 | Whether latest transaction was auto-renewed |
| `tx_count_60d` | 0.037 | Transaction count (60 days) |

The recorded model artifact names 131 features. Per-category counts are not published here: the
previously stated breakdown summed to 125, and no code in the repository classifies features by
category, so any breakdown would have to be regenerated from a documented rule.

Demographic inputs are included in the model: city, cleaned age, encoded gender, and registration
channel all appear in the recorded feature importance. See the bias section of
[MODEL_CARD.md](MODEL_CARD.md).

## Calibration

Both training paths obtain positive-class probability estimates, and the served booster uses a
`binary:logistic` objective. In the archived full-data evaluation the raw estimates were poorly
calibrated and isotonic regression improved them substantially:

| Metric (LightGBM) | Before | After | Source |
|-------------------|--------|-------|--------|
| Log loss | 0.41297890834500645 | 0.11270724473096795 | `models/archive/full-data-calibration_metrics.json` |
| Brier score | 0.12552498527058062 | 0.03311632255290847 | `models/archive/full-data-calibration_metrics.json` |
| AUC | 0.9699632964687438 | 0.9703411520587144 | `models/archive/full-data-calibration_metrics.json` |

These are historical figures describing no served model. The archived artifact stores no ECE or
reliability curves alongside them, so the *degree* of remaining calibration error is unmeasured
there; the serving-sample calibration artifact (`models/calibration_metrics.json`) does store
measured reliability points. The API does not apply any calibrator: it returns raw XGBoost scores.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **ML** | XGBoost, LightGBM, CatBoost, scikit-learn, SHAP |
| **Data** | DuckDB, pandas, numpy, Optuna |
| **API** | FastAPI, uvicorn, Pydantic |
| **Frontend** | React 19, TypeScript, Vite, Recharts, Tailwind |
| **Infrastructure** | Docker, GitHub Actions, Hugging Face Spaces |

The GitHub Actions workflows exist but are not gating: lint failures are non-blocking, only two test
files run, and the calibration, integration, and backtest steps use `continue-on-error`.

## Notes on Metrics

AUC measures ranking — are churners scored above non-churners? Log loss and Brier score measure
whether the predicted magnitudes are usable as probabilities. They move independently: a model can
rank well and still emit badly scaled scores, which is what the before/after calibration table above
shows. Isotonic regression is not free of ranking effects; it can introduce ties, and the recorded
AUC did shift.

See [LEARNERS_GUIDE.md](LEARNERS_GUIDE.md) for the working notes.

## References

- [WSDM KKBox Churn Prediction Challenge](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Bryan Gregory's 1st Place Solution (arXiv:1802.03396)](https://arxiv.org/abs/1802.03396)
- [Isotonic Calibration](https://scikit-learn.org/stable/modules/calibration.html)

---

**A portfolio project covering feature engineering, model training, calibration, API development, and
an interactive dashboard.** Its current gaps are enumerated in [LIMITATIONS.md](LIMITATIONS.md) and the
open fix-or-delete decisions in [DECISIONS-PENDING.md](DECISIONS-PENDING.md).
