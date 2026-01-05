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

> **0.97 AUC with honest temporal validation** - A production-ready churn prediction pipeline achieving near-winner performance without data leakage.

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![LightGBM](https://img.shields.io/badge/model-LightGBM-green.svg)](https://lightgbm.readthedocs.io/)
[![Calibrated](https://img.shields.io/badge/calibration-isotonic-orange.svg)](src/calibrate_and_evaluate.py)

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

```python
# Calibration in action
from sklearn.calibration import IsotonicRegression

calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(raw_predictions, actual_labels)
calibrated = calibrator.transform(test_predictions)
```

## Quick Start

```bash
# Clone repository
git clone https://github.com/robertlupo1997/kkbox-churn-prediction.git
cd kkbox-churn-prediction

# Install dependencies
pip install -r requirements.txt

# Run calibration (uses pre-trained models)
python src/calibrate_and_evaluate.py

# Generate predictions
python src/generate_kaggle_submission.py

# Run error analysis
python src/run_error_analysis.py --calibrate
```

## Project Structure

```
kkbox-churn-prediction/
├── src/
│   ├── calibrate_and_evaluate.py  # Isotonic calibration pipeline
│   ├── generate_kaggle_submission.py  # Submission generation
│   ├── run_error_analysis.py      # Model diagnostics
│   ├── hyperparameter_tuning.py   # Optuna optimization
│   ├── stacking.py                # Ensemble methods
│   └── error_analysis.py          # Segment analysis
├── features/
│   └── features_comprehensive.sql # 135 feature definitions
├── models/
│   ├── lightgbm.pkl              # Best model (0.97 AUC)
│   ├── calibrator_lightgbm.pkl   # Isotonic calibrator
│   └── calibration_metrics.json  # Performance metrics
├── LEARNERS_GUIDE.md             # How winners solved this
└── MODEL_CARD.md                 # Model documentation
```

## What I Learned

This project taught me the difference between **ranking** (AUC) and **calibration** (log loss):

1. **AUC measures ranking** - Are churners scored higher than non-churners?
2. **Log loss measures calibration** - Does 80% prediction mean 80% actual probability?
3. **These are independent** - Perfect AUC with terrible log loss is possible
4. **Calibration is often free** - Isotonic regression preserves ranking while fixing probabilities

See [LEARNERS_GUIDE.md](LEARNERS_GUIDE.md) for the full learning journey.

## Technical Highlights

- **Temporal validation**: Train on Jan-Feb 2017, validate on Mar 2017
- **No data leakage**: All features strictly use past information
- **Hyperparameter tuning**: Optuna with 50 trials per model
- **Ensemble exploration**: Stacking tested but single LightGBM performed best
- **Business-ready**: Error analysis identifies high-value intervention segments

## References

- [WSDM KKBox Churn Prediction Challenge](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Bryan Gregory's 1st Place Solution (arXiv:1802.03396)](https://arxiv.org/abs/1802.03396)
- [Isotonic Calibration](https://scikit-learn.org/stable/modules/calibration.html)

---

**Built as a portfolio project demonstrating end-to-end ML engineering**: feature engineering, model training, calibration, and business-ready deployment.
