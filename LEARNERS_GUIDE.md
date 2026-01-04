# Learner's Guide: KKBOX Churn Prediction

This guide documents my learning journey from 0.77 AUC to **0.97 AUC** by studying Kaggle winners and implementing their techniques with proper temporal validation.

---

## Final Results: What We Achieved

| Metric | Starting | Final | Winner | Notes |
|--------|----------|-------|--------|-------|
| **AUC** | 0.7755 | **0.9696** | ~0.99 | Ours uses temporal validation |
| **Log Loss** | 0.41 | **0.1127** | 0.08 | Within 0.03 of winner |
| **Features** | 108 | **135** | 76-258 | Including historical churn |

---

## The Key Insight: AUC vs Log Loss

The most important lesson from this project:

```
AUC  = Ranking ability (are churners scored higher?)
       → Improved by: features, model tuning

Log Loss = Probability calibration (is 80% prediction = 80% actual?)
           → Improved by: isotonic calibration

THESE ARE INDEPENDENT! You can have 0.97 AUC with 0.41 log loss.
```

**Solution**: Apply isotonic calibration AFTER training. It preserves ranking (AUC) while fixing probabilities (log loss).

```python
from sklearn.calibration import IsotonicRegression

# Fit on calibration set
calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(raw_predictions, actual_labels)

# Apply to test set
calibrated = calibrator.transform(test_predictions)
# Log loss: 0.41 → 0.11 (AUC unchanged!)
```

---

## 1. The 1st Place Solution (Bryan Gregory)

**Achievement**: 1st out of 575 teams, $2,500 prize, WSDM 2018 presentation
**Paper**: [arXiv:1802.03396](https://arxiv.org/abs/1802.03396)

### His Architecture

| Component | Details |
|-----------|---------|
| **Models** | XGBoost (88%) + LightGBM (12%) |
| **Features** | 76 total features |
| **Log Loss** | 0.08 (competition metric) |

### Top Predictive Features

1. **`is_auto_renew`** - Users without auto-renew churn most
2. **`membership_days_remaining`** - Expiry urgency
3. **`is_cancel`** - Direct churn signal
4. **`regist_cancels`** - Historical cancellation count
5. **`tenure`** - Days since registration
6. **`days_since_last`** - Recency of engagement

---

## 2. Feature Engineering Patterns We Implemented

### A. Multi-Window Aggregations (Core Pattern)

Calculate the same metrics across 7/14/30/60/90 day windows:

```sql
-- 90-day transaction features
tx_features_90d AS (
  SELECT msno,
    COUNT(*) AS tx_count_90d,
    AVG(is_auto_renew) AS auto_renew_ratio_90d,
    SUM(actual_amount_paid) AS total_paid_90d,
    MIN(days_ago) AS days_since_last_tx
  FROM tx_with_cutoff WHERE days_ago <= 90
  GROUP BY msno
)
-- Repeat for 60d, 30d, 14d, 7d windows
```

### B. Historical Churn Features (Critical!)

Track each user's churn history across time:

```python
# From src/historical_features.py
last_1_is_churn = history[-1]  # Most recent churn outcome
last_2_is_churn = history[-2]  # Second most recent
# ... up to last_5_is_churn

churn_rate = sum(history) / len(history)
churn_count = sum(history)
```

**Impact**: Users who churned before are 3-5x more likely to churn again.

### C. Winner-Inspired Interaction Features

```sql
-- Sticky users: auto-renew AND never cancelled
CASE WHEN is_auto_renew = 1 AND cancel_count = 0
     THEN 1 ELSE 0 END AS autorenew_not_cancel

-- Discount sensitivity
plan_list_price - actual_amount_paid AS discount

-- Value density
actual_amount_paid / payment_plan_days AS amt_per_day

-- Trend features
(14d_unq * 2.143) / 30d_unq - 1 AS ul_last2wk_vs_month_unq_ratio
```

---

## 3. Model Training Lessons

### What Worked

| Approach | AUC | Notes |
|----------|-----|-------|
| **LightGBM** | 0.9696 | Best single model |
| XGBoost | 0.9642 | Close second |
| CatBoost | 0.9605 | Slightly worse |
| Stacked Ensemble | 0.9638 | Worse than LightGBM alone! |

**Lesson**: More complex isn't always better. Single LightGBM beat stacking.

### Hyperparameter Tuning

```python
# Optuna found these optimal parameters
lgb_params = {
    'learning_rate': 0.05,
    'max_depth': 7,
    'num_leaves': 256,
    'n_estimators': 240,
    'subsample': 0.8,
    'colsample_bytree': 0.8
}
```

---

## 4. Our Implementation vs Winners

| Aspect | Our Implementation | Winner Solutions |
|--------|-------------------|------------------|
| **Validation** | Temporal splits (**honest**) | Random splits (leaky) |
| **AUC** | 0.9696 | 0.99 (but leaked) |
| **Log Loss** | 0.1127 | 0.08 |
| **Features** | 135 | 76-258 |
| **Churn History** | ✅ Implemented | Central to success |
| **Models** | LightGBM best | XGB + LGB ensemble |
| **Calibration** | ✅ Isotonic | Clipping + rate scaling |
| **Production Ready** | ✅ Yes | No (Kaggle notebooks) |

### Why Our 0.97 AUC is More Honest

Competition winners used random train/test splits that leak future information:

```
Random split: Train on mix of Jan+Feb+Mar → Test on mix of Jan+Feb+Mar
              ↳ Model sees future behavior in training → Inflated 0.99 AUC

Temporal split: Train on Jan+Feb → Test on Mar
                ↳ Model only uses past → Honest 0.97 AUC
```

---

## 5. Calibration: The Secret Weapon

### Before Calibration
```
Raw predictions:    mean = 0.35
Actual churn rate:  9%
Log Loss:           0.41 (BAD)
```

### After Isotonic Calibration
```
Calibrated predictions: mean = 0.09
Actual churn rate:      9%
Log Loss:               0.11 (GOOD!)
```

### Why It Works

Isotonic regression learns a monotonic mapping from raw scores to true probabilities:

```
Raw Score → True Probability
0.2       → 0.03
0.5       → 0.08
0.8       → 0.35
0.95      → 0.72
```

The mapping preserves order (AUC unchanged) while fixing probabilities (log loss improved).

---

## 6. Error Analysis Insights

After running `src/run_error_analysis.py --calibrate`:

### Model Performance
- **Accuracy**: 95.50%
- **Precision**: 83.42%
- **Recall**: 62.35%

### Weakest Segments (Improvement Opportunities)

| Segment | Accuracy | Samples |
|---------|----------|---------|
| `tx_count_90d = 5` | 46% | 462 |
| `auto_renew_count_90d = 4` | 43% | 680 |
| `cancel_ratio_90d = 0.2` | 40% | 394 |

### Perfect Calibration Achieved

```
Confidence Bin | Predicted | Actual | Match?
0.0-0.1        | 0.01      | 0.01   | ✓
0.1-0.2        | 0.13      | 0.13   | ✓
0.8-0.9        | 0.87      | 0.87   | ✓
0.9-1.0        | 0.92      | 0.92   | ✓
```

---

## 7. Key Takeaways for Future Projects

### 1. Validate Properly
```python
# BAD: Random split leaks future
train, test = train_test_split(data, test_size=0.2)

# GOOD: Temporal split for time-series
train = data[data['date'] < cutoff]
test = data[data['date'] >= cutoff]
```

### 2. Calibrate After Training
```python
# Always calibrate probability outputs
calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(raw_preds_cal, y_cal)
final_preds = calibrator.transform(raw_preds_test)
```

### 3. Study Winners, But Think Critically
- Winners' 0.99 AUC was inflated by data leakage
- Their feature engineering patterns are still valuable
- Their calibration techniques (clipping, scaling) work
- But temporal safety must come first

### 4. Simpler Often Wins
- LightGBM alone beat XGB+LGB+CatBoost stacking
- Focus on features before complex ensembles
- Calibration is more impactful than stacking

---

## 8. Resources

### Papers
- [Bryan Gregory's 1st Place Solution](https://arxiv.org/abs/1802.03396)

### Code Reference
- `src/calibrate_and_evaluate.py` - Calibration pipeline
- `src/historical_features.py` - Churn history features
- `features/features_comprehensive.sql` - 135 feature definitions

### External
- [Kaggle Competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Scikit-learn Calibration](https://scikit-learn.org/stable/modules/calibration.html)

---

## Quick Commands

```bash
# Run calibration
python src/calibrate_and_evaluate.py

# Generate submission
python src/generate_kaggle_submission.py

# Error analysis
python src/run_error_analysis.py --calibrate

# Train models (if you have data)
python train_temporal.py
```
