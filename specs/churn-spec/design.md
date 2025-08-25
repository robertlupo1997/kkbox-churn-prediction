# KKBOX Churn Prediction Design

## Architecture Overview
Temporal-aware ML pipeline with strict leakage prevention, built on existing PostgreSQL feature store.

## Data Flow
```
PostgreSQL Pipeline → Feature Extract → Purged Split → Model Training → Calibration → Submission
     (existing)           (new)          (new)         (new)         (new)       (new)
```

## Component Design

### 1. Feature Registry (`features.yaml`)
**Purpose**: Declarative feature definitions with temporal boundaries
**Schema**:
```yaml
features:
  - name: tenure_months  
    source: features.user_tenure_revenue
    window: up_to_label_date
    aggregation: latest
    null_policy: fill_zero
    dtype: float32
    fill_value: 0
    description: months since signup at label_date
  - name: avg_seconds_per_day
    source: features.user_engagement  
    window: up_to_label_date
    aggregation: mean
    null_policy: fill_median
    dtype: float32
    fill_value: 120.0
    description: average listening seconds per day
```

### 2. Data Extraction (`src/extract.py`)
**Purpose**: Export leak-free datasets from PostgreSQL
**Interface**:
```python
def extract_dataset(
    connection_url: str,
    boundary: str = "2017-02-01",
    purge_days: int = 30,
    output_dir: str = "data/",
) -> tuple[str, str]:
    """Extract train/val with purged temporal split"""
```
**Boundary Rule**: 
- Train: label_date < boundary - 30 days
- Validate: label_date >= boundary + 30 days  
- Purge window: [boundary - 30 days, boundary + 30 days)

### 3. Run Logging (`src/runlog.py`)
**Purpose**: Track reproducibility metadata
**Interface**:
```python
def save_run_log(
    seed: int,
    params: dict,
    metrics: dict,
    output_path: str = "run.json"
) -> None:
    """Save seed, git commit, data snapshot, params, metrics"""
```
**Content**: RUN_SEED env (default 42), git commit hash, data version, hyperparameters, final metrics

### 4. Model Pipeline (`src/models/`)
**Components**:
- `baseline.py`: L2 Logistic with StandardScaler, target logloss ≤ 0.65
- `xgboost_model.py`: XGBClassifier with early stopping, improve by ≥ 0.05  
- `calibrator.py`: Isotonic calibration on validation folds
**Metric**: Optimize logloss only. Track AUC/Brier as secondary.

### 5. Evaluation Framework (`src/eval.py`)
**Primary Metric**: Logloss (minimize for model selection)
**Secondary Metrics**: AUC, Brier Score (monitoring only)
**Validation Strategy**: Forward-chained CV with purge windows
**Class Imbalance**: Stratified splits, calibrated probabilities, base_rate vs mean(p) reporting

## Error Handling & Stop Conditions
- **Data Leakage**: If leaks > 0, stop and report count
- **Split Overlap**: If val_min <= train_max, stop and report dates  
- **Probability Range**: If any p not in [0,1], stop and report bounds
- **Missing Data**: Apply null_policy from features.yaml, log warnings
- **Reproducibility**: Write run.json on each run with metadata

## Testing Strategy
- **Unit Tests**: Feature extraction, temporal splits, calibration math
- **Integration Tests**: End-to-end pipeline with 1000-row sample
- **Validation Tests**: SQL leakage detection, split boundaries, probability sanity

## Performance Considerations
- **Memory**: Use polars for 400M+ row processing, chunked reads
- **Indexes**: Add (msno, log_date) and (msno, label_date) if missing
- **Caching**: Cache feature extracts as parquet for repeated experiments