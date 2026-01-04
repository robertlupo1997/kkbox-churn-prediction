# Model Card: KKBOX Churn Prediction

## Model Details

| Field | Value |
|-------|-------|
| **Model Type** | LightGBM Classifier + Isotonic Calibration |
| **Version** | 2.0 (2026-01-04) |
| **Owner** | Robert "Trey" Lupo |
| **Framework** | scikit-learn, LightGBM |

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **AUC-ROC** | 0.9696 | Ranking ability |
| **Log Loss** | 0.1127 | After calibration |
| **Brier Score** | 0.033 | Calibration quality |
| **Accuracy** | 95.50% | At 0.5 threshold |
| **Precision** | 83.42% | True positives / predicted positives |
| **Recall** | 62.35% | True positives / actual positives |

### Comparison

| Model | AUC | Log Loss |
|-------|-----|----------|
| Starting (XGBoost baseline) | 0.7755 | N/A |
| Final (Calibrated LightGBM) | 0.9696 | 0.1127 |
| Kaggle Winner | ~0.99* | 0.08 |

*Winner used random splits with data leakage; our temporal validation is more honest.

## Intended Use

**Primary Use**
- Predict churn risk for paid music streaming subscribers
- Support retention campaign targeting
- Budget allocation for intervention programs

**Not For**
- Credit decisions or financial judgments
- Legal or employment decisions
- Real-time serving without additional validation

## Training Data

| Field | Value |
|-------|-------|
| **Source** | KKBOX Kaggle Competition |
| **Period** | 2015-2017 |
| **Training** | Jan-Feb 2017 (1.94M samples) |
| **Validation** | Mar 2017 (971K samples) |
| **Churn Rate** | 8.99% |

### Label Definition

A user churns if they do NOT renew within 30 days after membership expiration.

## Features (135 total)

### Transaction Features (35)
- Multi-window aggregations (7/14/30/60/90 days)
- Payment amounts, plan days, discounts
- Auto-renew status, cancellation history
- Payment method diversity

### User Log Features (50)
- Listening time and song counts
- Completion rates (full listens vs skips)
- Activity patterns and consistency
- Engagement trends

### Historical Churn Features (10)
- `last_1_is_churn` through `last_5_is_churn`
- `churn_count`, `churn_rate`
- `months_since_last_churn`

### Winner-Inspired Features (15)
- `autorenew_not_cancel` (interaction)
- `amt_per_day` (value density)
- `ul_last2wk_vs_month_unq_ratio` (trend)

### Demographics (5)
- Age, gender, tenure, city, registration channel

## Model Architecture

```
Raw Features (135)
       ↓
LightGBM Classifier
  - max_depth: 7
  - num_leaves: 256
  - learning_rate: 0.05
  - n_estimators: 240
       ↓
Raw Probability (0-1)
       ↓
Isotonic Calibration
       ↓
Calibrated Probability
```

## Calibration

| Metric | Before | After |
|--------|--------|-------|
| Log Loss | 0.41 | 0.11 |
| Mean Prediction | 0.35 | 0.09 |
| Actual Churn Rate | 0.09 | 0.09 |

Isotonic regression maps raw scores to true probabilities while preserving ranking (AUC unchanged).

## Limitations and Risks

### Known Limitations
- Trained on 2017 data; may not generalize to current behavior
- Performance degrades for users with unusual transaction patterns
- Weakest on segments: `tx_count_90d=5` (46% accuracy)

### Bias Considerations
- No sensitive demographic fields used
- Age bucketed to reduce individual identification
- Gender not a strong predictor

### Failure Modes
- Long gaps in user activity logs
- Promotional pricing spikes
- Platform-wide behavior shifts

## Monitoring Recommendations

- Track PSI (Population Stability Index) monthly
- Monitor calibration drift with reliability plots
- Re-calibrate if log loss exceeds 0.15
- Retrain if AUC drops below 0.90

## Files

| File | Description |
|------|-------------|
| `models/lightgbm.pkl` | Trained classifier |
| `models/calibrator_lightgbm.pkl` | Isotonic calibrator |
| `models/calibration_metrics.json` | Performance metrics |
| `features/features_comprehensive.sql` | Feature definitions |

## References

- [WSDM KKBox Competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Bryan Gregory's 1st Place Solution](https://arxiv.org/abs/1802.03396)
- [Scikit-learn Calibration](https://scikit-learn.org/stable/modules/calibration.html)

## Contact

Issues and questions: GitHub repository issues
