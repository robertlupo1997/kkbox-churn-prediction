# Real Data Commands - Copy & Paste Ready

## 🎯 **One-Command Ship** (Recommended)

```bash
# Complete pipeline with stop rules
./ship.sh
```

## 📋 **Step-by-Step Commands**

### 1) Label Validation (Stop Rule: ≥99%)
```bash
python3 src/labels.py \
  --transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv \
  --train-labels kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv \
  --output eval/labels_train_march.csv \
  --cutoff 2017-03-01 \
  --min-accuracy 0.99
```

### 2) Train & Calibrate
```bash
make models
make calibrate
```

### 3) Rolling Backtests & PSI
```bash
make backtest
python3 src/psi.py --features "eval/features_*.csv" --out eval/psi_features.csv
python3 scripts/psi_scores.py
```

### 4) App Preparation
```bash
# Use latest features for app demo
cp eval/features_2017-03-2017-04.csv eval/app_features.csv
```

### 5) README Auto-fill
```bash
python3 scripts/update_readme.py
```

### 6) Launch Demo
```bash
make app
```

## 🔍 **Verification Commands**

```bash
# Integration tests
python3 test_integration.py

# Check calibration improvements
jq '.logistic_regression.improvement' models/calibration_metrics.json

# Check PSI drift
head eval/psi_features.csv
head eval/psi_scores.csv

# Performance check
time python3 -c "
import pandas as pd
import pickle
df = pd.read_csv('eval/app_features.csv')
with open('models/xgboost.pkl', 'rb') as f:
    model = pickle.load(f)
start = time.time()
pred = model.predict_proba(df.drop(['msno', 'is_churn', 'cutoff_ts'], axis=1).fillna(0))
print(f'Prediction latency: {(time.time()-start)*1000:.0f}ms per batch of {len(df)}')
"
```

## ⚠️ **Stop Rules**

The pipeline will halt if:
- Label accuracy < 99% vs train_v2.csv
- Calibration doesn't improve Brier & ECE
- Integration tests fail
- Missing required files

Check error messages and fix issues before proceeding.
