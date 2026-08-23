# Model Card: KKBOX Churn Prediction

Read alongside [LIMITATIONS.md](LIMITATIONS.md), which lists what this project does not do and what
is unverified.

## Model Details

| Field | Value |
|-------|-------|
| **Best recorded offline result** | LightGBM classifier with isotonic calibration fitted afterwards |
| **What the API actually serves** | An uncalibrated XGBoost booster (`models/xgb.json`), loaded via `api/config.py` |
| **Version** | 2.0 (2026-01-04) |
| **Owner** | Robert "Trey" Lupo |
| **Framework** | scikit-learn, LightGBM, XGBoost |

The calibrated LightGBM model described in the metrics below is not the model in the serving path,
and no calibrator artifact is checked in or loaded at request time.

## Performance Metrics

**Every figure in this section was measured on the March 2017 window, which was also the window
Optuna maximised AUC over during hyperparameter selection** (`src/hyperparameter_tuning.py`,
`train_temporal.py`). These are tuned-validation numbers. There is no untouched test window in this
repository, so none of these should be read as a held-out estimate of future performance.

| Metric | Value | Source | Notes |
|--------|-------|--------|-------|
| **AUC-ROC** | 0.9696 | `models/training_metrics.json` | LightGBM, uncalibrated; ranking only |
| **Log Loss** | 0.1127 | `models/calibration_metrics.json` | LightGBM after isotonic calibration |
| **Brier Score** | 0.0331 | `models/calibration_metrics.json` | LightGBM after isotonic calibration |

The calibration figures come from a random split of that same already-tuned March population
(`src/calibrate_and_evaluate.py`), so they are not independent of the tuning.

Accuracy, precision, and recall are **not reported**. No artifact in the repository contains them,
and the prediction files needed to recompute them are not checked in.

### Recorded model comparison

All AUC values below are from the same tuned validation window (`models/training_metrics.json`,
`models/stacked_ensemble_metrics.json`):

| Model | AUC | Log loss (uncalibrated) |
|-------|-----|-------------------------|
| Logistic regression | 0.8690 | 0.1991 |
| Random forest | 0.9122 | 0.3156 |
| XGBoost | 0.9642 | 0.4134 |
| LightGBM | 0.9696 | 0.4138 |
| XGB/LGB 50-50 blend | 0.9680 | 0.4119 |
| Stacked ensemble | 0.9638 | 0.1432 |

No comparison against the competition winners is made here: the repository holds no winner
evaluation artifact, and the cited paper file is a Git LFS pointer in this checkout.

## Intended Use

**Primary Use**
- A portfolio demonstration of churn feature engineering, temporal evaluation, and calibration
- Exploratory ranking of churn risk for paid music streaming subscribers on 2017 competition data

**Not For**
- Production retention targeting without a clean holdout evaluation first
- Credit decisions or financial judgments
- Legal or employment decisions
- Real-time serving; the checked-in serving path does not produce predictions (see LIMITATIONS.md)

## Training Data

| Field | Value | Source |
|-------|-------|--------|
| **Source** | KKBOX Kaggle Competition | — |
| **Windows used** | Two 2017 monthly windows for training, a later 2017 window for validation | `models/training_metrics.json` |
| **Training rows** | 1,929,125 | `models/training_metrics.json` |
| **Validation rows** | 970,960 | `models/training_metrics.json` |
| **Training churn rate** | 8.88% | `models/training_metrics.json` |
| **Validation churn rate** | 8.99% | `models/training_metrics.json` |

Row counts, not distinct members: a member can appear in more than one monthly window. No
distinct-member count is recorded. The repository does not include the raw data or a data manifest
establishing its full date range; only the 2017 window identifiers above are recorded.

### Label Definition

A user churns if they do NOT renew within 30 days after membership expiration.

The repository currently implements this boundary two ways: `src/labels.py` treats renewal on day 30
as retained, while `src/backtest.py` treats the same member as churned. See
[DECISIONS-PENDING.md](DECISIONS-PENDING.md).

## Features

The recorded model artifacts declare **131 features**. Per-category counts are not published: no
code in the repository classifies features into categories, and the breakdown previously stated here
did not sum to 131.

Feature families present, by inspection of `features/features_comprehensive.sql` and the recorded
importance list:

- **Transaction**: multi-window aggregations (7/14/30/60/90 days), payment amounts, plan days,
  discounts, auto-renew status, cancellation history, payment method diversity
- **User log**: listening time, song counts, completion rates, activity patterns, engagement trends
- **Historical churn**: `last_1_is_churn` through `last_5_is_churn`, `churn_count`, `churn_rate`,
  `months_since_last_churn` — generated to separate CSVs and **not joined by the current pipeline**
  (see LIMITATIONS.md)
- **Winner-inspired** (so labelled in source comments): `autorenew_not_cancel`, `amt_per_day`,
  `ul_last2wk_vs_month_unq_ratio`
- **Demographic**: age, gender, city, registration channel, tenure

## Model Configuration

Tuned LightGBM parameters actually consumed by the temporal trainer
(`models/best_hyperparameters.json`, `train_temporal.py`):

```
max_depth:         6
num_leaves:        296
learning_rate:     0.0540709
n_estimators:      327
min_child_samples: 65
subsample:         0.8764
colsample_bytree:  0.8111
```

Pipeline shape: raw features → LightGBM → probability estimate → isotonic calibration fitted on a
split of the validation population → calibrated probability. The API path skips the calibration
stage entirely and serves the XGBoost booster instead.

## Calibration

| Metric (LightGBM) | Before | After | Source |
|-------------------|--------|-------|--------|
| Log loss | 0.4130 | 0.1127 | `models/calibration_metrics.json` |
| Brier score | 0.1255 | 0.0331 | `models/calibration_metrics.json` |
| AUC | 0.96996 | 0.97034 | `models/calibration_metrics.json` |

Isotonic regression substantially improved the recorded probability metrics. It did **not** leave
ranking untouched: the recorded AUC moved. Isotonic mapping can introduce ties, so exact rank
preservation is not guaranteed.

No ECE, reliability-curve arrays, or bin counts are stored with these figures, so the amount of
remaining calibration error is unmeasured. A nonzero Brier score is not evidence of exact
calibration.

## Limitations and Risks

### Known Limitations
- Trained and evaluated on 2017 data; it may not generalize to current behavior
- No untouched test window exists; every reported figure comes from the tuning window
- Segment-level performance has not been evaluated. Any statement about which user segments the
  model handles worst would need a segment evaluation artifact, and none is checked in.
- See [LIMITATIONS.md](LIMITATIONS.md) for the reproducibility and serving gaps

### Bias Considerations
- The model **does** use demographic inputs: city, cleaned age, encoded gender, and registration
  channel all appear in `features/features_comprehensive.sql` and in the recorded feature
  importance (`models/training_metrics.json`). `rules.yaml` additionally targets age and gender.
- Age is range-cleaned to 10–80 and otherwise set to null. It is **not** bucketed.
- Recorded XGBoost importance for gender is 0.00192. No fairness threshold or disparate-impact
  analysis has been run, so this number is not a fairness finding.
- A fairness review of the demographic inputs has not been performed and would be required before
  any real targeting use.

### Untested Risks

The following are plausible failure modes worth testing. No robustness experiment in this repository
tests any of them, so they are listed as hypotheses, not findings:

- Long gaps in user activity logs
- Promotional pricing spikes
- Platform-wide behavior shifts

## Monitoring Recommendations

These are proposals for a future deployment, not implemented monitoring:

- Track PSI (Population Stability Index) monthly (`scripts/psi_scores.py` exists as a starting point)
- Monitor calibration drift with reliability plots
- Re-calibrate if log loss exceeds 0.15
- Retrain if AUC drops below 0.90

## Files

| File | Description |
|------|-------------|
| `models/lgb.txt` | LightGBM model in native text format (131 features) |
| `models/xgb.json` | XGBoost booster the API loads (131 features) |
| `models/xgboost.json` | Additional XGBoost artifact |
| `models/training_metrics.json` | Recorded training/validation metrics and feature importance |
| `models/calibration_metrics.json` | Recorded before/after calibration metrics |
| `models/best_hyperparameters.json` | Optuna-selected parameters |
| `features/features_comprehensive.sql` | Feature definitions |

No calibrated-model artifact is checked in.

## References

- [WSDM KKBox Competition](https://www.kaggle.com/c/kkbox-churn-prediction-challenge)
- [Bryan Gregory's 1st Place Solution](https://arxiv.org/abs/1802.03396)
- [Scikit-learn Calibration](https://scikit-learn.org/stable/modules/calibration.html)

## Contact

Issues and questions: GitHub repository issues
