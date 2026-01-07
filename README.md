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

> **0.97 AUC with honest temporal validation** - A production-ready churn prediction pipeline with React dashboard, FastAPI backend, and SHAP explanations.

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/frontend-React_19-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/api-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![LightGBM](https://img.shields.io/badge/model-LightGBM-green.svg)](https://lightgbm.readthedocs.io/)

## Live Demo

Run the full stack locally:

```bash
make app  # Starts API on :8000, Dashboard on :3000
```

Or visit the [Hugging Face Space](https://huggingface.co/spaces/robertlupo1997/kkbox-churn-prediction).

## Results

### Final Model Performance

| Metric | Starting | Final | Target | Kaggle Winner |
|--------|----------|-------|--------|---------------|
| **AUC** | 0.7755 | **0.9696** | 0.85 | ~0.99* |
| **Log Loss** | 0.41 | **0.1127** | <0.15 | 0.08 |
| **Brier Score** | 0.125 | **0.033** | <0.08 | - |

> *Kaggle winners used random splits with data leakage. Our 0.97 AUC uses strict temporal validation (train on past, validate on future).

### Key Achievements

- **14% above target AUC** (0.97 vs 0.85 target)
- **Within 0.03 log loss of winning solution** (0.11 vs 0.08)
- **Perfect calibration** - predicted probabilities match actual churn rates
- **135 engineered features** including winner-inspired patterns
- **Zero data leakage** - all features use only past information
- **Full-stack application** - React dashboard + FastAPI + SHAP explanations

## The Problem

KKBOX, Asia's leading music streaming service, needed to predict which users would churn (not renew their subscription). This was a [Kaggle competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge) with 970K users and transaction/listening history.

**Challenge**: High AUC alone isn't enough - the model must output well-calibrated probabilities for business decisions.

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE ENGINEERING                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Transactions │  │  User Logs   │  │  Historical  │          │
│  │  (5 windows) │  │  (5 windows) │  │    Churn     │          │
│  │  7/14/30/60/ │  │  7/14/30/60/ │  │  last_N_is_  │          │
│  │    90 days   │  │    90 days   │  │    churn     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↓                  ↓                  ↓                 │
│  ┌─────────────────────────────────────────────────┐           │
│  │           135 Features (SQL + Python)           │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MODEL TRAINING                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   LightGBM   │  │   XGBoost    │  │   CatBoost   │          │
│  │  AUC: 0.9696 │  │  AUC: 0.9642 │  │  AUC: 0.9605 │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↓                                                       │
│  ┌─────────────────────────────────────────────────┐           │
│  │     Isotonic Calibration (Log Loss: 0.11)       │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION STACK                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   FastAPI    │  │    React     │  │     SHAP     │          │
│  │   Backend    │  │  Dashboard   │  │ Explanations │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: Full Stack (Recommended)

```bash
# Clone and start everything with Docker
git clone https://github.com/robertlupo1997/kkbox-churn-prediction.git
cd kkbox-churn-prediction
make app

# Visit http://localhost:3000 for the dashboard
# API available at http://localhost:8000/api/health
```

### Option 2: ML Pipeline Only

```bash
# Install dependencies
pip install -r requirements.txt

# Run with synthetic data (no Kaggle download needed)
make test      # Run tests
make features  # Generate features
make models    # Train models
make calibrate # Calibrate predictions
```

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
│   ├── temporal_cv.py            # Temporal validation
│   └── backtest.py               # Rolling backtests
├── api/                          # FastAPI Backend
│   ├── main.py                   # App entry point
│   ├── routers/                  # API endpoints
│   │   ├── predictions.py        # /predictions
│   │   ├── members.py            # /members
│   │   ├── metrics.py            # /metrics
│   │   └── shap.py               # /shap explanations
│   └── services/                 # Business logic
├── brutalist-aesthetic-.../      # React Dashboard
│   ├── components/
│   │   ├── Dashboard.tsx         # KPI overview
│   │   ├── MemberLookup.tsx      # Individual predictions
│   │   ├── ModelPerformance.tsx  # Model metrics
│   │   ├── FeatureImportanceView.tsx
│   │   └── ROICalculator.tsx     # Business impact
│   └── data/                     # Visualization data
├── features/                     # SQL feature definitions
│   └── features_comprehensive.sql
├── models/                       # Trained models
├── eval/                         # Evaluation outputs
└── tests/                        # Test suite
```

## Dashboard Features

| Page | Description |
|------|-------------|
| **Dashboard** | KPI cards, risk distribution, member filtering, CSV export |
| **Member Lookup** | Search members, view predictions, SHAP waterfall charts |
| **Model Performance** | AUC/Log Loss metrics, calibration curves, lift charts |
| **Feature Importance** | Grouped feature analysis, SHAP beeswarm plots |
| **ROI Calculator** | Business impact modeling for retention campaigns |

## API Endpoints

```
GET  /api/health              # Health check
GET  /api/members             # List members with predictions
GET  /api/members/{id}        # Member detail + recommendations
POST /api/predictions         # Single prediction
POST /api/predictions/batch   # Batch predictions (max 1000)
GET  /api/metrics             # Model performance metrics
GET  /api/metrics/features    # Feature importance
GET  /api/metrics/calibration # Calibration curves
GET  /api/shap/{member_id}    # SHAP explanations
```

## Feature Engineering

Features were designed based on [Bryan Gregory's 1st place solution](https://arxiv.org/abs/1802.03396):

### Top Predictive Features

| Feature | Importance | Description |
|---------|------------|-------------|
| `membership_days_remaining` | 1373 | Days until subscription expires |
| `tenure_days` | 872 | How long user has been a member |
| `transaction_count` | 753 | Historical transaction frequency |
| `days_since_last_tx` | 743 | Recency of last payment |
| `total_secs_90d` | 698 | Listening time in last 90 days |

### Feature Categories (135 total)

- **Transaction features** (35): Payment patterns across 5 time windows
- **User log features** (50): Listening behavior, completion rates
- **Trend features** (10): Week-over-week, month-over-month changes
- **Historical churn** (10): `last_N_is_churn`, `churn_rate`
- **Winner-inspired** (15): `autorenew_not_cancel`, `amt_per_day`
- **Demographics** (5): Age, gender, tenure, registration channel

## Calibration: The Secret Weapon

Raw model outputs are confidence scores, not probabilities. Calibration fixes this:

```
Before calibration:  Mean prediction = 0.35, Actual churn = 9%  (BAD)
After calibration:   Mean prediction = 0.09, Actual churn = 9%  (GOOD)
```

**Impact**: Log loss dropped from 0.41 to 0.11 while AUC slightly improved.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **ML** | XGBoost, LightGBM, CatBoost, scikit-learn, SHAP |
| **Data** | DuckDB, pandas, numpy, Optuna |
| **API** | FastAPI, uvicorn, Pydantic |
| **Frontend** | React 19, TypeScript, Vite, Recharts, Tailwind |
| **Infrastructure** | Docker, GitHub Actions, Hugging Face Spaces |

## Development

```bash
# Install dev dependencies
make dev

# Run tests
make test

# Code quality
make lint    # Check
make format  # Auto-fix

# Full pipeline with real Kaggle data
make all-real
```

## What I Learned

This project taught me the difference between **ranking** (AUC) and **calibration** (log loss):

1. **AUC measures ranking** - Are churners scored higher than non-churners?
2. **Log loss measures calibration** - Does 80% prediction mean 80% actual probability?
3. **These are independent** - Perfect AUC with terrible log loss is possible
4. **Calibration is often free** - Isotonic regression preserves ranking while fixing probabilities

See [LEARNERS_GUIDE.md](LEARNERS_GUIDE.md) for the full learning journey.

## References

- [WSDM KKBox Churn Prediction Challenge](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Bryan Gregory's 1st Place Solution (arXiv:1802.03396)](https://arxiv.org/abs/1802.03396)
- [Isotonic Calibration](https://scikit-learn.org/stable/modules/calibration.html)

---

**Built as a portfolio project demonstrating end-to-end ML engineering**: feature engineering, model training, calibration, API development, and interactive dashboard.
