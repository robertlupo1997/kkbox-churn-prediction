# Real Data Fast Path - Minimum Viable Ship

## 🚀 **Prerequisites**
Place KKBOX competition files:
```
kkbox-churn-prediction-challenge/data/churn_comp_refresh/
├── transactions_v2.csv
├── user_logs_v2.csv
├── members_v3.csv
└── train_v2.csv
```

## ⚡ **Fast Path Commands** (Stop on Failures)

```bash
# 1) Labels (stop rule ≥ 0.99)
python3 src/labels.py \
  --transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv \
  --train-labels kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv \
  --output eval/labels_train_march.csv --cutoff 2017-03-01 --min-accuracy 0.99

# 2) Models + calibration
make models && make calibrate

# 3) Backtests + PSI (+ scores PSI)
make backtest && make psi

# 4) Auto-fill README tables
python3 scripts/update_readme.py

# 5) Launch demo
make app
```

## 🔍 **Pre-Release Sniff Test** (Quick Wins)

### **Artifacts Generated**
- [ ] `eval/backtests.csv` exists with **3 windows × N models** rows
- [ ] `eval/psi_features.csv` created; PSI > 0.2 flagged for investigation
- [ ] `eval/psi_scores.csv` created; score drift > 0.2 documented
- [ ] `eval/features_YYYY-MM-YYYY-MM.csv` present for each window
- [ ] Latest features copied to `eval/app_features.csv` for demo

### **Performance Validation**
- [ ] App shows median inference < 500ms (footer logs timing)
- [ ] `scripts/update_readme.py` produced non-TBD numbers
- [ ] **LogLoss/Brier deltas are negative** (lower = better)
- [ ] Calibration shows ECE improvement (lower = better)

### **Quality Gates**
- [ ] Label accuracy ≥ 99% on train_v2.csv
- [ ] At least 1 model shows Brier & ECE improvement
- [ ] No high PSI drift (>0.2) without documentation
- [ ] All integration tests passing (`python3 test_integration.py`)

## ⚠️ **Stop Rules**

Pipeline halts if:
- **Label accuracy < 99%**: Check `eval/labels_train_march_mismatches.csv`
- **No calibration improvement**: Brier_post >= Brier_pre OR ECE_post >= ECE_pre
- **App latency > 500ms**: Check model loading, feature size
- **Integration tests fail**: Fix component issues before proceeding

## 🎯 **Success Indicators**

✅ **Ready to Ship** when:
- Labels validate at ≥99% accuracy vs official train_v2
- Models train and calibrate with reliability improvements
- Rolling backtests complete across 3 time windows
- PSI drift analysis flags potential issues
- React/FastAPI app loads with <100ms API latency
- README auto-populated with verified metrics

**Time Estimate**: 15-30 minutes with real KKBOX data on standard laptop
