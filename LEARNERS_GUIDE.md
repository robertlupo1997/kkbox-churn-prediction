# Learner's Guide: KKBOX Churn Prediction Excellence

This guide synthesizes insights from the **1st place winner (Bryan Gregory)** and top Kaggle solutions to help you understand what separates production-ready systems from competition-winning approaches.

---

## Quick Reference: Example Solutions to Study

```
example/
├── Kaggle/KKBOX churn/code/    # InfiniteWing - XGB+LGB+CatBoost stacking
├── WSDM_2018/                   # RyuJiseung - Clean feature engineering
├── KKBOX/                       # jsroa15 - 94% ROC AUC with Random Forest
└── KKBOX_CHURN_PREDICTION/      # dhecloud - Excellent data_processing.py
```

---

## 1. The 1st Place Solution (Bryan Gregory)

**Achievement**: 1st out of 575 teams, $2,500 prize, WSDM 2018 presentation

### Key Architecture
| Component | Details |
|-----------|---------|
| **Models** | XGBoost (88%) + LightGBM (12%) |
| **Features** | 76 total features |
| **Tools** | T-SQL for ETL, Python/sklearn for modeling |
| **Paper** | [arXiv:1802.03396](https://arxiv.org/abs/1802.03396) |

### Top 10 Most Important Features
1. **`is_auto_renew`** - #1 predictor (users without auto-renew churn most)
2. **`payment_method_id`** - Payment consistency matters
3. **`is_cancel`** - Direct churn signal
4. **`regist_cancels`** - Historical cancellation count
5. **`regist_trans`** - Total transactions
6. **`revenue`** - Customer lifetime value
7. **`tenure`** - Days since registration
8. **`days_since_last`** - Recency of engagement
9. **`membership_duration`** - Current plan length
10. **`discount`** - Price sensitivity indicator

### His Temporal Feature Strategy
```
Window aggregations: 30 / 60 / 90 days
├── counts_30/60/90      - Activity frequency
├── num_unq_30/60/90     - Song diversity
├── total_secs_30/60/90  - Engagement depth
└── Trend ratios         - Behavior change detection
```

---

## 2. Feature Engineering Patterns from Winners

### A. Transaction Features (Critical)

```python
# From dhecloud/KKBOX_CHURN_PREDICTION/data_processing.py
df['membership_duration'] = (df['expiration_date'] - df['transaction_date']).dt.days
df['discount'] = df['plan_list_price'] - df['actual_amount_paid']
df['is_discount'] = (df['discount'] > 0).astype(int)
df['amt_per_day'] = df['actual_amount_paid'] / df['payment_plan_days']

# Interaction features (highly predictive!)
df['autorenew_&_not_cancel'] = ((df['is_auto_renew'] == 1) & (df['is_cancel'] == 0)).astype(int)
df['notAutorenew_&_cancel'] = ((df['is_auto_renew'] == 0) & (df['is_cancel'] == 1)).astype(int)
```

### B. Historical Churn Features (We're Missing These!)

```python
# From InfiniteWing labeler_v5.py - Track user's churn history
last_1_is_churn = msno2churn[msno][-1] if len(history) >= 1 else -1
last_2_is_churn = msno2churn[msno][-2] if len(history) >= 2 else -1
# ... up to last_5_is_churn

churn_rate = sum(msno2churn[msno]) / len(msno2churn[msno])
churn_count = sum(msno2churn[msno])
transaction_count = len(msno2churn[msno])
```

**Why it matters**: Users who churned before are 3-5x more likely to churn again.

### C. User Log Aggregations

```python
# Multi-window aggregations
user_logs_mean = user_logs.groupby('msno').mean()  # Add '_mean' suffix
user_logs_sum = user_logs.groupby('msno').sum()    # Add '_sum' suffix
user_logs_count = user_logs.groupby('msno').size() # Activity frequency

# Completion rate features
percent_100 = num_100 / total_plays  # Full listens
percent_25 = num_25 / total_plays    # Early skips (churn signal!)
```

### D. Membership Duration Features

```python
# From membership_features.py - Monthly activity flags
cols = ['201501', '201502', ..., '201703']  # 27 binary flags
combo_days = (expiration_date - first_transaction_date).days  # Tenure
```

---

## 3. Model Configurations That Won

### XGBoost (Primary Model)
```python
# From kernel_new_train_final.py
params = {
    'eta': 0.07,              # Learning rate
    'max_depth': 7,           # Tree depth
    'objective': 'binary:logistic',
    'eval_metric': 'logloss',
    'tree_method': 'exact',   # Precise splits
    'seed': 3228
}
# 200 rounds, early_stopping_rounds=10
```

### LightGBM (Secondary Model)
```python
lgb_params = {
    'learning_rate': 0.05,
    'application': 'binary',
    'max_depth': 7,
    'num_leaves': 256,        # High complexity
    'metric': 'binary_logloss'
}
# 240 rounds, early_stopping_rounds=50
```

### Ensemble Strategy
```python
# Simple but effective
final_pred = (xgb_pred + lgb_pred + cat_pred) / 3

# Or weighted (1st place)
final_pred = 0.88 * xgb_pred + 0.12 * lgb_pred
```

---

## 4. Our Implementation vs Winners

| Aspect | Our Implementation | Winner Solutions |
|--------|-------------------|------------------|
| **Validation** | Temporal splits (honest 0.70 AUC) | Random splits (inflated 0.99 AUC) |
| **Features** | 100+ multi-window | 76-258 features |
| **Churn History** | Not implemented | Central to success |
| **Models** | XGBoost only | XGB + LGB + CatBoost |
| **Ensemble** | None | Stacking, averaging |
| **Calibration** | Isotonic regression | Clipping + rate scaling |
| **Production Ready** | Yes (Docker, CI/CD) | No (Kaggle notebooks) |

### What We Do Better
- **Temporal safety** with SQL-level cutoffs and unit tests
- **Proper calibration** with isotonic regression and ECE tracking
- **Maintainable architecture** with modular design
- **Honest metrics** that reflect real-world performance

### What We Can Learn
1. **Add historical churn features** - `last_N_is_churn`, `churn_rate`, `churn_count`
2. **Add LightGBM** - Catches different patterns than XGBoost
3. **Add interaction features** - `autorenew_&_not_cancel` is highly predictive
4. **Simple ensemble** - Even averaging 2 models helps

---

## 5. Concrete Improvement Path

### Phase 1: Quick Wins (1-2 hours)
```python
# Add to features_comprehensive.sql
# 1. Interaction feature
CASE WHEN is_auto_renew = 1 AND is_cancel = 0 THEN 1 ELSE 0 END AS autorenew_not_cancel

# 2. Discount feature
plan_list_price - actual_amount_paid AS discount

# 3. Daily cost
actual_amount_paid / NULLIF(payment_plan_days, 0) AS amt_per_day
```

### Phase 2: Add LightGBM (2-3 hours)
```python
# In train_temporal.py, add:
import lightgbm as lgb

lgb_model = lgb.LGBMClassifier(
    learning_rate=0.05,
    max_depth=7,
    num_leaves=256,
    n_estimators=240,
    random_state=42
)
lgb_model.fit(X_train, y_train)

# Simple ensemble
ensemble_pred = 0.5 * xgb_pred + 0.5 * lgb_pred
```

### Phase 3: Historical Churn Features (4-6 hours)
This requires modifying the feature generation to track per-user churn history across time windows. See `example/Kaggle/KKBOX churn/code/labeler_v5.py` lines 89-121 for implementation reference.

---

## 6. Key Files to Study

### Best Feature Engineering
```
example/KKBOX_CHURN_PREDICTION/data_processing.py  # Clean, well-documented
example/Kaggle/KKBOX churn/code/labeler_v5.py      # Historical churn features
example/Kaggle/KKBOX churn/code/train_pre_v5.py    # Log aggregations
```

### Best Model Training
```
example/Kaggle/KKBOX churn/code/kernel_new_train_final.py  # XGB+LGB+CatBoost
example/KKBOX/train.py                                      # Random Forest approach
```

### Best Stacking/Ensemble
```
example/Kaggle/KKBOX churn/code/stacking.py     # Conditional min-max-mean
example/Kaggle/KKBOX churn/code/ensemble.py     # Simple averaging
```

---

## 7. External Resources

### Papers
- **1st Place**: [arXiv:1802.03396](https://arxiv.org/abs/1802.03396) - Bryan Gregory's temporal XGBoost
- **Stanford CS229**: [Project Report](https://cs229.stanford.edu/proj2017/final-reports/5244038.pdf) - 66 features detailed

### Articles
- [Top 4% Solution Analysis](https://medium.com/analytics-vidhya/kaggle-top-4-solution-wsdm-kkboxs-churn-prediction-fc49104568d6)
- [Complete EDA & Modeling](https://theperpetualmeatball.github.io/KKBox-Churn-Prediction/)

### Competition
- [Kaggle Competition Page](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [WSDM Cup 2018](https://wsdm-cup-2018.kkbox.events/)

---

## 8. Why 0.70 AUC is Actually Good

> **Important Context**: Competition solutions achieving 0.95+ AUC used random splits that leak future information into training. Our 0.70 AUC on true temporal holdout is what you'd see in production.

| Metric Context | AUC | What It Means |
|----------------|-----|---------------|
| Random split (leaky) | 0.95-0.99 | Overfitting to future |
| Temporal split (honest) | 0.65-0.75 | Real-world performance |
| Industry benchmark | 0.70-0.80 | Good churn model |

**Don't chase 0.99 AUC** - that's a sign of data leakage, not model quality.

---

## Quick Commands

```bash
# Run temporal training (honest metrics)
make train-temporal

# Run backtest across windows
make backtest

# View example solutions
ls example/
```
