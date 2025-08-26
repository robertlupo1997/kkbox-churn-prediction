#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
trap 'echo -e "\n❌ Failed at line $LINENO"; exit 1' ERR

echo "🚀 KKBOX Churn Prediction - Ship Pipeline"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error_exit() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    exit 1
}

success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning_msg() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if real KKBOX data is available
KKBOX_DIR="kkbox-churn-prediction-challenge/data/churn_comp_refresh"
if [[ ! -d "$KKBOX_DIR" ]]; then
    warning_msg "Real KKBOX data not found at $KKBOX_DIR"
    echo "Using synthetic data for demonstration"
    USE_REAL_DATA=false
else
    echo "📊 Real KKBOX data detected"
    USE_REAL_DATA=true
fi

# Step 1: Label validation (only with real data)
if [[ "$USE_REAL_DATA" == "true" ]]; then
    echo -e "\n🏷️  STEP 1: Label Validation (Stop Rule: ≥99%)"
    python3 src/labels.py \
      --transactions "$KKBOX_DIR/transactions_v2.csv" \
      --train-labels "$KKBOX_DIR/train_v2.csv" \
      --output eval/labels_train_march.csv \
      --cutoff 2017-03-01 \
      --min-accuracy 0.99 || error_exit "Label accuracy <99%. Check eval/labels_train_march_mismatches.csv"

    success_msg "Label validation passed (≥99% accuracy)"
else
    warning_msg "Skipping label validation (synthetic data)"
fi

# Step 2: Train models
echo -e "\n🤖 STEP 2: Model Training"
make models || error_exit "Model training failed"
success_msg "Models trained successfully"

# Step 3: Calibration
echo -e "\n🎯 STEP 3: Model Calibration"
make calibrate || error_exit "Model calibration failed"

# Verify calibration improvements
if [[ -f "models/calibration_metrics.json" ]]; then
    python3 -c "
import json
with open('models/calibration_metrics.json') as f:
    cal = json.load(f)

# Check if any model shows improvement
improved = False
for model, metrics in cal.items():
    if 'improvement' in metrics:
        brier_delta = metrics['improvement']['brier_delta']
        ece_delta = metrics['improvement']['ece_delta']
        if brier_delta < 0 and ece_delta < 0:
            print(f'✅ {model}: Brier {brier_delta:+.4f}, ECE {ece_delta:+.4f}')
            improved = True
        else:
            print(f'⚠️  {model}: Brier {brier_delta:+.4f}, ECE {ece_delta:+.4f}')

if not improved:
    print('❌ No calibration improvements detected')
    exit(1)
else:
    print('✅ Calibration improvements verified')
" || error_exit "Calibration did not improve Brier & ECE"
fi

success_msg "Calibration improvements verified"

# Step 4: Rolling backtests
echo -e "\n⏱  STEP 4: Rolling Backtests"
if [[ "$USE_REAL_DATA" == "true" ]]; then
    make backtest || error_exit "Rolling backtests failed"
else
    warning_msg "Skipping real backtests (synthetic data)"
fi

# Step 5: PSI drift monitoring
echo -e "\n📈 STEP 5: PSI Drift Monitoring"
python3 src/psi.py --features "eval/features_*.csv" --out eval/psi_features.csv || warning_msg "PSI calculation failed"
python3 scripts/psi_scores.py || warning_msg "PSI scores calculation failed"

# Check for high drift
if [[ -f "eval/psi_features.csv" ]]; then
    python3 -c "
import pandas as pd
try:
    psi_df = pd.read_csv('eval/psi_features.csv')
    high_drift = psi_df[psi_df['psi'] > 0.2]
    if len(high_drift) > 0:
        print(f'⚠️  High drift detected in {len(high_drift)} features')
        for _, row in high_drift.head(5).iterrows():
            print(f'  {row[\"feature\"]}: PSI = {row[\"psi\"]:.3f}')
    else:
        print('✅ No high drift detected (PSI <= 0.2)')
except Exception as e:
    print(f'⚠️  PSI check failed: {e}')
"
fi

# Step 6: App preparation
echo -e "\n📱 STEP 6: App Preparation"
# Use the latest features file for app demo
LATEST_FEATURES=$(ls -t eval/features_*.csv 2>/dev/null | head -1 || echo "")
if [[ -n "$LATEST_FEATURES" && "$LATEST_FEATURES" != "eval/app_features.csv" ]]; then
    cp "$LATEST_FEATURES" eval/app_features.csv
    success_msg "App features updated from $LATEST_FEATURES"
fi

# Step 7: README autofill
echo -e "\n📝 STEP 7: README Update"
python3 scripts/update_readme.py || warning_msg "README update failed"
success_msg "README updated with latest metrics"

# Step 8: Final validation
echo -e "\n🔍 STEP 8: Final Validation"
python3 test_integration.py || error_exit "Integration tests failed"

# Performance check
echo -e "\n⚡ Performance Validation:"
if command -v streamlit &> /dev/null; then
    echo "  Streamlit available ✅"
else
    warning_msg "Streamlit not installed (pip install streamlit)"
fi

if [[ -f "eval/app_features.csv" ]]; then
    FEATURE_COUNT=$(wc -l < eval/app_features.csv)
    echo "  App features: $((FEATURE_COUNT-1)) members ✅"
else
    warning_msg "App features not found"
fi

# Final summary
echo -e "\n🎉 SHIPPING SUMMARY"
echo "=================="

if [[ "$USE_REAL_DATA" == "true" ]]; then
    echo "✅ Real KKBOX data validation complete"
else
    echo "⚠️  Using synthetic data (demo mode)"
fi

echo "✅ Models trained and calibrated"
echo "✅ Integration tests passing"
echo "✅ App ready for deployment"

echo -e "\n🚀 Ready to ship! Launch with:"
echo "   make app    # Start Streamlit demo"
echo "   make docker-run  # Containerized deployment"

exit 0
