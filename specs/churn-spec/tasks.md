# KKBOX Churn Prediction Implementation Tasks

## Environment Setup
```bash
export PGURL="postgres://..."
export RUN_SEED="${RUN_SEED:-42}"
```

## M1: Data Pipeline & Validation (Week 1)

### 1. Feature Registry
- [ ] Create `features.yaml` with existing PostgreSQL features
- [ ] List each feature with: name, source, window, aggregation, null_policy, dtype, fill_value, description
- **Files**: `features.yaml`
- **Command**: `python -c "import yaml; yaml.safe_load(open('features.yaml'))"`
- **Validation**: Schema validates, all required fields present

### 2. Data Extract with Purged Split
- [ ] Export train and val with boundary = 2017-02-01, purge_days = 30
- [ ] Train: label_date < boundary - 30 days, Validate: label_date >= boundary + 30 days
- [ ] Use polars/pandas for memory-efficient PostgreSQL export
- **Files**: `src/extract.py`, `data/train.parquet`, `data/val.parquet`
- **Command**: `python src/extract.py --boundary 2017-02-01 --purge-days 30 --out data/`
- **Validation**: No leakage, purge window [boundary - 30 days, boundary + 30 days) excluded
- **Stop Condition**: If leaks > 0, stop and report count

### 3. SQL Validation Checks
- [ ] Run leakage detection query on fact.user_logs.log_date
- [ ] Verify temporal split boundaries
- [ ] Generate validation reports
- **Files**: `leakage_check.txt`, `split_check.txt`, `validation_report.txt`
- **Commands**: 
```bash
# Leakage
psql -v ON_ERROR_STOP=1 "$PGURL" -c "
SELECT COUNT(*) AS leaks
FROM model.churn_dataset d
JOIN fact.user_logs l USING (msno)
WHERE l.log_date >= d.label_date;
" > leakage_check.txt

# Purged split
psql -v ON_ERROR_STOP=1 "$PGURL" -c "
SELECT
  MAX(CASE WHEN label_date < DATE '2017-02-01' - INTERVAL '30 days' THEN label_date END)::date AS train_max,
  MIN(CASE WHEN label_date >= DATE '2017-02-01' + INTERVAL '30 days' THEN label_date END)::date AS val_min
FROM model.churn_dataset;
" > split_check.txt

# Pipeline health
psql -v ON_ERROR_STOP=1 "$PGURL" -f sql/08_validation.sql > validation_report.txt
```
- **Stop Conditions**: 
  - If leaks > 0 → stop and report
  - If val_min <= train_max → stop and report

### 4. Run Logging Setup
- [ ] Create `src/runlog.py` with seed, git commit, data snapshot tracking
- [ ] Save run.json with RUN_SEED env (default 42), params, metrics
- **Files**: `src/runlog.py`, `run.json`
- **Command**: `python -c "from src.runlog import save_run_log; save_run_log(42, {}, {})"`

### 5. Optional Performance Indexes (Ask First)
- [ ] Add indexes for query performance on large tables
- **Commands**:
```sql
CREATE INDEX IF NOT EXISTS user_logs_msno_date ON fact.user_logs (msno, log_date);
CREATE INDEX IF NOT EXISTS churn_msno_date ON model.churn_dataset (msno, label_date);
```

## M2: Baseline & Advanced Models (Week 2)

### 6. Logistic Baseline
- [ ] L2 regularized logistic regression with StandardScaler
- [ ] Target: logloss ≤ 0.65, AUC ≥ 0.65 on validation set
- [ ] Generate feature importance rankings
- **Files**: `src/models/baseline.py`, `eval/baseline_metrics.json`
- **Command**: `python src/models/baseline.py --data data/train.parquet`
- **Validation**: Metrics saved, model serialized, no overfitting

### 7. XGBoost Model
- [ ] Forward-chained CV with early stopping at 50 rounds
- [ ] Improve logloss over baseline by ≥ 0.05
- [ ] Hyperparameter optimization via grid search
- **Files**: `src/models/xgboost_model.py`, `eval/xgb_metrics.json`
- **Command**: `python src/models/xgboost_model.py --cv-folds 3 --early-stopping 50`
- **Validation**: Cross-validation complete, best params saved

### 8. Model Comparison
- [ ] Compare baseline vs XGBoost on logloss (primary metric)
- [ ] Track AUC and Brier as secondary metrics
- [ ] Select best model for calibration
- **Files**: `eval/model_comparison.csv`, `eval/best_model.pkl`
- **Command**: `python src/model_comparison.py --models baseline,xgboost`

## M3: Calibration & Submission (Week 3)

### 9. Probability Calibration
- [ ] Isotonic calibration on validation folds
- [ ] Report base_rate vs mean(predicted_prob) for calibration check
- [ ] Save calibration parameters
- **Files**: `src/models/calibrator.py`, `models/calibration.pkl`, `eval/calibration_metrics.json`
- **Command**: `python src/models/calibrator.py --model eval/best_model.pkl`
- **Stop Condition**: If prob range not in [0,1], stop and report bounds

### 10. Kaggle Submission Generation
- [ ] Generate `submissions/final_submission.csv` matching sample format
- [ ] Apply calibrated probabilities to test predictions
- [ ] Validate submission shape, no NaNs, probability range [0,1]
- **Files**: `src/generate_submission.py`, `submissions/final_submission.csv`
- **Command**: `python src/generate_submission.py --model models/calibration.pkl`
- **Validation**: 
```python
import pandas as pd
sub = pd.read_csv("submissions/final_submission.csv")
print(f"Shape: {sub.shape}, Prob range: [{sub.is_churn.min():.3f}, {sub.is_churn.max():.3f}]")
```

### 11. Final Validation & Documentation
- [ ] Run end-to-end pipeline test
- [ ] Generate model performance report
- [ ] Update run.json with final metrics
- **Files**: `eval/final_report.md`, `run.json`
- **Command**: `python src/validate_pipeline.py --full-test`

## Dependencies & Setup
```bash
pip install polars psycopg[binary] pandas numpy scikit-learn xgboost pyyaml
mkdir -p specs/churn-spec src/models src data eval submissions
```

## Stop Conditions Summary
- Leakage detection: leaks > 0
- Temporal split: val_min <= train_max  
- Probability validation: any p not in [0,1]
- Model performance: baseline logloss > 0.65 or XGBoost improvement < 0.05