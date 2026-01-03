# KKBOX Churn Prediction - Model Improvement Handoff

**Date**: 2026-01-02
**Goal**: Improve AUC from 0.7755 to 0.85+ using winner's approach

## Session Summary

Implementing the 6-phase improvement plan from `thoughts/shared/plans/2025-12-28-kkbox-model-improvement.md`.

## Completed Work

### Phase 1: Label Generation Fix ✅

**Problem**: Labels showed 100% churn rate for March/April windows

**Root Causes Discovered**:
1. `transactions_v2.csv` is a SUPPLEMENT, not replacement - must combine with `transactions.csv` (v1)
2. Transaction data ends 2017-03-31, so March/April expirations have no renewal data
3. Missing critical filter: `transaction_date < target_month` (from winner's labeler_v5.py)

**Solution Applied**:
- Updated `src/backtest.py:labels_for_expire_month()` to combine v1+v2 transactions
- Added `get_labels_for_window()` that uses official `train_v2.csv` labels for Feb 2017
- Feb 2017 window now works: **970,960 users, 9% churn rate**

### Key Data Insights

```
transactions.csv (v1):  21M rows, ends 2017-02-28, has 1M+ Feb expirations
transactions_v2.csv:    1.4M rows, ends 2017-03-31, only 350 Feb expirations
train_v2.csv:           970,960 users with Feb 2017 expirations, 9% churn
```

**Why Feb 2017 is the Only Valid Validation Window**:
- Need data 30 days AFTER expiration to check renewals
- Feb expirations → check March renewals ✓
- March/April expirations → no renewal data available ✗

## Completed This Session

### Phase 2: Historical Churn Features ✅

**Script**: `src/historical_features.py` (vectorized version)
**Status**: COMPLETED - `eval/historical_features_201702.csv` created (984,123 rows)

The script computed for each user:
- `last_1_is_churn` through `last_5_is_churn`: Did user churn in last N periods?
- `churn_count`, `churn_rate`, `transaction_count`: Aggregate stats
- `months_since_last_churn`: Recency feature

**Output Files**:
- `eval/churn_history_all.csv` - Churn labels for all months (2016-01 through 2017-03)
- `eval/historical_features_201702.csv` - Historical features for Feb 2017 users

**To Check Status**:
```bash
# Check if output files exist
dir eval\historical_features_*.csv
dir eval\churn_history_all.csv

# If script failed, re-run:
python src/historical_features.py --target-months 201702
```

## Remaining Work

### Phase 2 Completion (After Historical Features Generated)

```python
# Merge historical features with main features
import pandas as pd
features = pd.read_csv('eval/features_2017-01-2017-02.csv')
hist = pd.read_csv('eval/historical_features_201702.csv')
merged = features.merge(hist, on='msno', how='left')
for col in hist.columns:
    if col != 'msno':
        merged[col] = merged[col].fillna(-1)
merged.to_csv('eval/features_2017-01-2017-02.csv', index=False)
print(f'Merged: {len(merged)} rows, {len(merged.columns)} columns')
```

Then retrain and verify: `python train_temporal.py`

### Phase 3: Add Remaining Winner Features

Update `features/features_comprehensive.sql` with:
- `ul_last2wk_vs_month_unq_ratio` - Listening trend (top feature)
- `listening_mo1_mo2_trend` - Month-over-month trend
- `activity_density_*` - Activity consistency
- `discount_ratio`, `expiry_urgency` - Payment patterns

See plan file for SQL templates.

### Phase 4: Hyperparameter Tuning

Create `src/hyperparameter_tuning.py`:
- Use Optuna for Bayesian optimization
- Tune XGBoost and LightGBM
- Save to `models/best_hyperparameters.json`

Template in plan file, section "Phase 4".

### Phase 5: Stacked Ensemble

Create `src/stacking.py`:
- XGB + LGB + CatBoost base models
- Out-of-fold predictions for meta-learner
- LogisticRegression as meta-model

Template in plan file, section "Phase 5".

### Phase 6: Integration

Create `run_full_pipeline.py` for end-to-end execution.

## Key Files Modified This Session

| File | Change |
|------|--------|
| `src/backtest.py` | Fixed label generation, added v1+v2 combination, `get_labels_for_window()` |
| `src/historical_features.py` | Created - vectorized historical feature generation |
| `eval/features_2017-01-2017-02.csv` | Regenerated with official labels |

## The Winner's Key Insight

From Bryan Gregory's winning solution (paper: `1802.03396v1.pdf`, code: `example/Kaggle/KKBOX churn/code/labeler_v5.py`):

> **Historical churn is the #1 predictor.** Users who churned before are likely to churn again.

The `last_1_is_churn` feature alone provides massive lift. The winner tracked churn history chronologically:
```python
msno2churn[current_msno].append(is_churn)  # Accumulate history
last_1_is_churn = msno2churn[current_msno][-1]  # Most recent
```

## Current Model Baseline

- **XGBoost AUC**: 0.7755
- **Features**: 108 columns
- **Target**: 0.85+ AUC

## Quick Resume Commands

```bash
# 1. Check historical features status
dir eval\historical_features_201702.csv

# 2. If missing, generate them
python src/historical_features.py --target-months 201702

# 3. Merge with main features (see Python code above)

# 4. Retrain and evaluate
python train_temporal.py

# 5. Continue with Phase 3+ per plan
```

## Reference Files

- **Implementation Plan**: `thoughts/shared/plans/2025-12-28-kkbox-model-improvement.md`
- **Winner's Labeler**: `example/Kaggle/KKBOX churn/code/labeler_v5.py`
- **Winner's Paper**: `1802.03396v1.pdf`
- **Feature Patterns**: `LEARNERS_GUIDE.md`
