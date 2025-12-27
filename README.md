# KKBOX Churn Prediction - Temporal Safe ML Pipeline

> **Production-ready churn prediction with isotonic calibration, leak-proof features, and business action mapping**

[![CI](https://img.shields.io/github/actions/workflow/status/robertlupo1997/kkbox-churn-prediction/ci.yml?branch=main)](../../actions)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](Dockerfile)
[![Tests](https://img.shields.io/badge/tests-passing-green.svg)](tests/)

## What You Get

✅ **One-Command Execution**: `make all` - Complete pipeline from features to calibrated models
✅ **Temporal Safety**: Zero future data leakage with comprehensive unit tests
✅ **WSDMChurnLabeller Compliance**: ≥99% accuracy vs official Kaggle Scala reference
✅ **Isotonic Calibration**: Reliability improvements with Brier score and ECE validation
✅ **Business Action Mapping**: SHAP explanations → retention interventions via [rules.yaml](rules.yaml)

## Performance Metrics *[Updated: 2025-12-27]*

### Temporal Validation Results
**Training**: Jan + Feb 2017 (1.94M samples) | **Validation**: Mar 2017 (971K samples)

| Model | ROC AUC | Log Loss | Brier Score |
|-------|---------|----------|-------------|
| **XGBoost** | 0.7025 | 1.18 | 0.355 |
| Random Forest | 0.6069 | 0.89 | 0.244 |
| Logistic Regression | 0.5884 | 0.56 | 0.138 |

> **Note**: These are realistic temporal validation metrics. Models trained on past data, validated on future data - no leakage.

### Rolling Backtest Windows
| Window | XGBoost AUC | Random Forest AUC | LogReg AUC |
|--------|-------------|-------------------|------------|
| Jan→Feb | 0.7638 | 0.7401 | 0.6693 |
| Feb→Mar | 0.7622 | 0.7404 | 0.6672 |
| Mar→Apr | 0.7504 | 0.7272 | 0.6596 |

> **Training Approach**: True temporal splits using `train_temporal.py` - no random split data leakage


## Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd kkbox-churn-prediction

# One-command execution
make all

# Or step by step
make features  # Generate features with temporal safeguards
make models    # Train baseline + XGBoost models
make calibrate # Apply isotonic calibration
make test      # Run temporal safety validation

# Launch interactive app
make app       # Start ChurnPro (React + FastAPI) via Docker
```

## Docker Deployment

```bash
# Production container
make docker-build
make docker-run

# Verify in isolated environment
make docker-test
```

## Architecture

### Temporal Safety First
- **Train Cutoff**: 2017-02-28 (official Kaggle spec)
- **Test Prep**: 2017-03-31 ready
- **Anti-Leakage**: Unit tests fabricate future events, assert zero leakage
- **SQL Hardening**: DuckDB-safe with TRY_CAST and explicit type handling

### Model Pipeline
1. **Labels**: WSDMChurnLabeller.scala semantics with mismatch audit
2. **Features**: Leak-proof SQL with 90-day transaction, 30-day usage windows
3. **Models**: Baseline → XGBoost with competition-optimized hyperparameters
4. **Calibration**: Isotonic regression for reliability improvement
5. **Validation**: Rolling backtests with PSI drift monitoring

### Business Integration
- **Action Mapping**: `rules.yaml` maps SHAP importance → retention campaigns
- **Cost Guidelines**: Budget allocation by risk tier ($5-$50 per user)
- **Success Tracking**: 15% retention lift, 10% revenue impact targets

## File Structure

```
├── src/
│   ├── labels.py          # WSDMChurnLabeller.scala compliance
│   ├── models.py          # Baseline + XGBoost training
│   ├── calibration.py     # Isotonic calibration pipeline
│   └── features_processor.py  # SQL bridge with synthetic support
├── features/
│   └── features_simple.sql   # DuckDB-safe, leak-proof features
├── tests/
│   └── test_temporal_safety.py  # Anti-leakage unit tests
├── rules.yaml             # Business action mapping
├── Dockerfile             # Python 3.11 production image
├── Makefile              # One-command execution
└── requirements.txt       # Pinned dependencies
```

## Technical Validation

### ✅ Completed
- [x] Labels achieve ≥99% match with WSDMChurnLabeller.scala
- [x] Zero temporal leakage in unit tests
- [x] DuckDB SQL type safety with TRY_CAST
- [x] Repository isolation with pytest.ini
- [x] Production Docker + Makefile infrastructure

### 🔄 In Progress
- [x] Real KKBOX data metrics validation
- [x] Rolling backtests (Jan→Feb, Feb→Mar, Mar→Apr)
- [ ] React/FastAPI app with <100ms API latency

## Citations

Based on the [WSDM KKBox Churn Prediction Challenge](https://www.kaggle.com/competitions/kkbox-churn-prediction-challenge). See [CITES.md](CITES.md) for official sources and evaluation metric specifications.

**Competition Metric**: Log Loss ([arXiv:1802.03396](https://arxiv.org/pdf/1802.03396))
**Churn Definition**: No renewal within 30 days after membership expiry

## Portfolio Showcase

This project demonstrates expertise across four roles:

- **📊 Data Analyst**: Leak audit, reliability plots, cost curve analysis
- **🔬 Data Scientist**: Label reproduction, bootstrap CIs, SHAP interpretation
- **⚙️ ML Engineer**: Docker, CI/CD, one-command deployment
- **🤖 AI Engineer**: React/FastAPI app, cached inference, business rule integration

---

**Status**: Temporal training complete with realistic metrics (XGBoost AUC: 0.70). No data leakage.

[📋 Full Release Checklist](RELEASE_CHECKLIST.md) | [🔍 Technical Documentation](docs/) | [🚀 Live Demo](#) (Coming Soon)
