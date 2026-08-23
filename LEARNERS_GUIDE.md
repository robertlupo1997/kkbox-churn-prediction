# Learner's Guide: KKBOX Churn Prediction

These are my working notes from taking this project from an early 0.77 AUC baseline to a recorded
0.9696 AUC, by reading about the Kaggle winners' approaches and applying similar feature patterns
under a time-ordered split.

**Caveat on every number below**: the recorded metrics are HISTORICAL full-data figures recovered
into `models/archive/full-data-training_metrics.json` and
`models/archive/full-data-calibration_metrics.json` on 2026-08-23 (the serving artifacts were since
rebuilt on a 10,000-member sample and describe different models). They come from the March 2017
window, which was also the window Optuna maximised AUC over. They are tuned-validation figures, not
held-out results, and they describe no served model. There is no untouched test window in this
repository. See LIMITATIONS.md.

---

## Recorded Results

| Metric | Starting | Recorded best | Notes |
|--------|----------|---------------|-------|
| **AUC** | 0.7755 | **0.9696** | LightGBM, uncalibrated, on the tuning window |
| **Log Loss** | 0.4130 | **0.1127** | After isotonic calibration |
| **Brier** | 0.1255 | **0.0331** | After isotonic calibration |
| **Features** | 108 | **131** | Including historical churn lags |

No comparison against the winners' scores is made here. This repository holds no winner evaluation
artifact, and the cited paper is a Git LFS pointer in this checkout.

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

**Solution**: Apply isotonic calibration AFTER training. In this project it improved probability
quality a lot and moved AUC only slightly (0.96996 -> 0.97034). It is not guaranteed to leave
ranking untouched -- isotonic mapping can introduce ties.

```python
from sklearn.calibration import IsotonicRegression

# Fit on calibration set
calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(raw_predictions, actual_labels)

# Apply to test set
calibrated = calibrator.transform(test_predictions)
# Recorded here: log loss 0.4130 -> 0.1127, AUC 0.96996 -> 0.97034
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
| XGB+LGB Ensemble | 0.9680 | 50/50 blend |
| XGBoost | 0.9642 | Close third |
| Stacked Ensemble | 0.9637549319898823 | Worse than LightGBM alone (`models/stacked_ensemble_metrics.json`) |

(LightGBM/XGB+LGB/XGBoost rows are archived full-data values from
`models/archive/full-data-training_metrics.json`; the stacked figure is the only one still backed by
a live artifact.)

**Lesson**: More complex isn't always better. Single LightGBM beat stacking and ensembles.

### Hyperparameter Tuning

```python
# Optuna's selected LightGBM parameters, as stored in models/best_hyperparameters.json
lgb_params = {
    'learning_rate': 0.05407092815174269,
    'max_depth': 6,
    'num_leaves': 296,
    'n_estimators': 327,
    'min_child_samples': 65,
    'subsample': 0.8763671856065534,
    'colsample_bytree': 0.8110698895711549,
}
```

Optuna maximised AUC on the March validation window -- the same window the headline AUC is reported
on. That is why the headline number should not be read as a held-out estimate.

---

## 4. Choices In This Implementation

| Aspect | This implementation |
|--------|---------------------|
| **Validation** | One fixed time-ordered split: train on two earlier windows, validate on a later one |
| **AUC** | 0.9696 (on the same window used for tuning) |
| **Log Loss** | 0.1127 after isotonic calibration |
| **Features** | 131 in the recorded artifact |
| **Churn History** | Lag features implemented (not joined by the current pipeline -- see LIMITATIONS.md) |
| **Models** | LightGBM had the best recorded AUC |
| **Calibration** | Isotonic, fitted offline; not applied by the API |

### Why a time-ordered split

Splitting a time series at random lets a model see behaviour from the same period it is later scored
on, which inflates the estimate. Splitting on time removes that particular source of optimism:

```
Random split:   Train on a mix of Jan+Feb+Mar -> Test on a mix of Jan+Feb+Mar
                (the model can see contemporaneous behaviour)

Temporal split: Train on Jan+Feb -> Validate on Mar
                (the model only sees earlier periods)
```

That is the argument for the split. It is **not** an argument that this project's number is a clean
estimate: the same March window was reused for hyperparameter selection, so the split's benefit was
partly spent. What I did not do -- and would need to do -- is hold out a fourth window that nothing
touched. I have no basis for characterising how the competition winners validated their models; no
artifact in this repository establishes that.

---

## 5. Calibration

Historical LightGBM calibration figures (exact values from
`models/archive/full-data-calibration_metrics.json`):

```
                Before                After
Log Loss        0.41297890834500645   0.11270724473096795
Brier           0.12552498527058062   0.03311632255290847
AUC             0.9699632964687438    0.9703411520587144
```

(The shorter forms quoted elsewhere - 0.4130/0.1127, 0.1255/0.0331, 0.96996/0.97034 - are roundings
of these stored values, not separate measurements.)

Mean-prediction and observed-rate figures are not recorded in that artifact, and the evaluation
predictions needed to recompute them are not checked in, so I do not quote them.

### Why It Works

Isotonic regression learns a monotonic mapping from raw scores to calibrated probability estimates.
It improved probability quality substantially here. It moved AUC slightly, so it did not leave the
ranking exactly intact -- isotonic mapping can collapse distinct scores into ties.

The evaluation itself was done on a random split of the already-tuned March population
(`src/calibrate_and_evaluate.py`), so these calibration figures are not independent of the tuning
either.

---

## 6. Error Analysis

`src/run_error_analysis.py --calibrate` exists and is the intended entry point for this section.

No error-analysis output is checked into the repository. Accuracy, precision, recall, per-segment
accuracy, and reliability-bin tables previously appeared here as if measured; none of them are backed
by an artifact, and the predictions needed to recompute them are not committed. They have been
removed rather than guessed.

To regenerate this section honestly: produce and commit a prediction file for a window that was not
used for tuning, run the error-analysis script against it, and paste its actual output.

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
- Their feature engineering patterns transferred well to this project
- Their calibration techniques (clipping, scaling) are worth reading about
- Scores from different validation schemes are not directly comparable, so I do not compare mine to
  theirs here
- Temporal safety comes first, and tuning on the same window you report on undercuts it

### 4. Simpler Often Wins
- LightGBM alone beat XGB+LGB stacking and ensembles
- Focus on features before complex ensembles
- Calibration is more impactful than stacking

---

## 8. Resources

### Papers
- [Bryan Gregory's 1st Place Solution](https://arxiv.org/abs/1802.03396)

### Code Reference
- `src/calibrate_and_evaluate.py` - Calibration pipeline
- `src/historical_features.py` - Churn history features
- `features/features_comprehensive.sql` - 131 feature definitions

### External
- [Kaggle Competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Scikit-learn Calibration](https://scikit-learn.org/stable/modules/calibration.html)

---

## Quick Commands

```bash
# Run calibration
python src/calibrate_and_evaluate.py

# Error analysis
python src/run_error_analysis.py --calibrate

# Train models (if you have data)
python train_temporal.py
```
