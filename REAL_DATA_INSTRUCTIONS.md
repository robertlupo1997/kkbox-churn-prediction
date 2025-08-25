# KKBOX Real Data Integration Instructions

## 🎯 **READY TO SHIP**: Complete Portfolio Pipeline

All infrastructure is complete and tested. Follow these steps to integrate real KKBOX data and generate final metrics.

### ✅ **Current Status**
- **Infrastructure**: 100% complete ✅
- **Synthetic Testing**: All tests passing ✅  
- **Pipeline Components**: Ready for real data ✅
- **Stop Rule Validation**: ≥99% label accuracy framework ready ✅

---

## 🚀 **Real Data Integration Steps**

### **Step 1: Data Setup (Local Only - Never Push)**

```bash
# Create the expected directory structure (already exists)
mkdir -p kkbox-churn-prediction-challenge/data/churn_comp_refresh/

# Place KKBOX files (download from Kaggle competition):
# kkbox-churn-prediction-challenge/data/churn_comp_refresh/
# ├── transactions_v2.csv
# ├── user_logs_v2.csv  
# ├── members_v3.csv
# └── train_v2.csv
```

### **Step 2: Label Validation (Stop Rule: ≥99%)**

```bash
# Validate WSDMChurnLabeller.scala compliance
python3 src/labels.py \
  --transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv \
  --train-labels kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv \
  --output eval/labels_train_march.csv \
  --cutoff 2017-03-01 \
  --min-accuracy 0.99

# If accuracy < 99%, check eval/labels_train_march_mismatches.csv for debugging
# Fix label logic until ≥99% achieved
```

### **Step 3: Model Training & Calibration**

```bash
# Train models with real features
make features  # Uses synthetic for demo (update paths for real data)
make models    # Train baseline + XGBoost
make calibrate # Apply isotonic calibration

# Verify calibration improvements
cat models/calibration_metrics.json
# Ensure: Brier_post < Brier_pre AND ECE_post < ECE_pre
```

### **Step 4: Rolling Backtests & PSI Drift**

```bash
# Execute rolling backtests (Jan→Feb, Feb→Mar, Mar→Apr)
make backtest

# Calculate PSI drift across windows
make psi

# Review results
cat eval/backtests.csv  # Log loss, AUC, Brier, ECE per window/model
cat eval/psi.csv        # Feature drift detection (flag >0.2)
```

### **Step 5: App Preparation & Demo**

```bash
# Prepare safe feature set for demo (latest window)
cp eval/features_2017-03-2017-04.csv eval/app_features.csv

# Install streamlit if needed
pip install streamlit

# Launch retention copilot
make app

# Test latency targets: <500ms per prediction
```

---

## 📊 **Expected Outputs**

### **Performance Metrics**
| File | Content |
|------|---------|
| `models/training_metrics.json` | Pre-calibration baseline metrics |
| `models/calibration_metrics.json` | Post-calibration improvements |
| `eval/backtests.csv` | Rolling window performance |
| `eval/psi.csv` | Feature drift monitoring |

### **Go/No-Go Gates**
✅ **Labels**: ≥99% accuracy vs train_v2.csv  
✅ **Calibration**: Brier & ECE improvements  
✅ **Backtests**: <10% log-loss degradation across windows  
✅ **App**: <500ms p50 latency target  

### **Portfolio Artifacts**
- `eval/backtests.csv` → README performance tables
- `models/calibration_metrics.json` → Reliability improvements  
- `eval/app_features.csv` → Live demo data
- Streamlit app → Interactive retention copilot

---

## 🔧 **Troubleshooting**

### **Label Accuracy < 99%**
```bash
# Check mismatch patterns
head -20 eval/labels_train_march_mismatches.csv

# Common issues:
# - Same-day renewals (check days_to_next = 0 cases)
# - Overlapping plans (multiple transactions per day)
# - Canceled plan logic (is_cancel handling)
```

### **Calibration Not Improving**
```bash
# Check calibration metrics
jq '.logistic_regression.improvement' models/calibration_metrics.json

# If Brier/ECE not improving:
# - Increase calibration sample size
# - Try different binning strategies
# - Verify feature quality
```

### **App Performance Issues**
```bash
# Profile feature loading
python3 -c "
import time
import pandas as pd
t0 = time.time()
df = pd.read_csv('eval/app_features.csv')
print(f'Load time: {(time.time()-t0)*1000:.0f}ms')
"

# Optimize if needed:
# - Reduce feature count
# - Use parquet format
# - Cache model loading
```

---

## 🎉 **Final Steps**

### **1. Update README Metrics**
Replace placeholders in README.md with actual numbers from:
- `models/calibration_metrics.json`
- `eval/backtests.csv`
- `eval/psi.csv`

### **2. Generate Proof Pack**
- Screenshot of Streamlit app
- Demo video (2 minutes)
- Brief.pdf from Resume_Assets/brief.txt
- Live app deployment

### **3. Verification Commands**
```bash
# Full pipeline verification
make production-check    # All tests pass
make docker-test        # Containerized validation
python3 test_integration.py  # Integration tests

# Performance validation  
make app                # <500ms target
curl -X POST app/predict  # API latency check
```

---

## 🚀 **SHIPPING CHECKLIST**

- [ ] Label accuracy ≥99% achieved
- [ ] Calibration improves Brier & ECE  
- [ ] Rolling backtests show stable performance
- [ ] PSI flags drift >0.2 appropriately
- [ ] App meets <500ms latency target
- [ ] README filled with verified metrics
- [ ] Docker production build passes
- [ ] All integration tests green

**Status**: Infrastructure complete. Ready for real KKBOX data integration and final validation.