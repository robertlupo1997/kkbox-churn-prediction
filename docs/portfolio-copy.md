# Portfolio Copy: KKBOX Churn Prediction

## Headline Options

**Option A (Technical)**
> Production ML Pipeline for Music Streaming Churn Prediction

**Option B (Results-focused)**
> Predicting Customer Churn with 97% Accuracy Using Temporal ML

**Option C (Full-stack emphasis)**
> End-to-End Churn Prediction: From Feature Engineering to Interactive Dashboard

---

## Project Summary (Short)

Built a production-ready machine learning pipeline to predict customer churn for KKBOX, Asia's leading music streaming service. The system achieves 0.97 AUC with strict temporal validation, processing millions of transaction and listening behavior records to generate 135 predictive features. Includes a full-stack dashboard for exploring predictions and model explanations.

---

## Project Summary (Extended)

Customer churn costs streaming services billions annually. This project tackles the KKBOX churn prediction challenge with a complete ML pipeline—from raw transaction logs to an interactive dashboard where analysts can explore individual predictions.

The core challenge: predict which users will cancel their subscription within 30 days of expiration. The solution combines behavioral signals (listening patterns, skip rates, session frequency) with transaction history (payment methods, discount usage, renewal patterns) across multiple time windows.

Key constraint: strict temporal validation ensures no future data leaks into predictions, making the model reliable for real-world deployment.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **AUC-ROC** | 0.97 |
| **Log Loss (calibrated)** | 0.11 |
| **Features Engineered** | 135 |
| **Training Samples** | 1.9M users |
| **Validation** | Temporal (no leakage) |

---

## Technical Highlights

### Feature Engineering
- 135 features across 5 time windows (7d, 14d, 30d, 60d, 90d)
- Transaction patterns: payment frequency, discount usage, cancellation history
- Listening behavior: session duration, completion rates, unique tracks
- Trend features: week-over-week and month-over-month changes
- Historical churn indicators for repeat behavior detection

### Model Pipeline
- Ensemble of XGBoost, LightGBM, and CatBoost
- Isotonic calibration reduces log loss by 73% while preserving ranking
- Temporal cross-validation prevents data leakage
- Population Stability Index (PSI) monitoring for drift detection

### Full-Stack Dashboard
- FastAPI backend with sub-100ms inference latency
- React/TypeScript frontend with interactive visualizations
- SHAP explanations for individual prediction interpretability
- ROI calculator for business impact estimation

---

## Tech Stack

```
ML Pipeline:      Python, XGBoost, LightGBM, scikit-learn, DuckDB
API:              FastAPI, Pydantic, uvicorn
Frontend:         React 19, TypeScript, Tailwind CSS, Recharts
Interpretability: SHAP
Infrastructure:   Docker, GitHub Actions CI/CD
```

---

## What Makes This Different

1. **No data leakage** — Temporal validation ensures all features use only past information. Unit tests actively try to break this constraint.

2. **Calibrated probabilities** — Raw model scores are transformed into true probabilities using isotonic regression, critical for business decision-making.

3. **Production architecture** — Not just a notebook. Containerized API, automated testing, one-command deployment (`make app`).

4. **Explainable predictions** — Every prediction includes SHAP values showing which factors drove the risk score.

---

## Challenges Solved

- **Feature leakage detection**: Built automated tests that fabricate "future" data to catch any temporal violations
- **Class imbalance**: ~9% churn rate required careful handling during calibration
- **Scale**: Processed 30GB+ of raw data efficiently using DuckDB and SQL-based feature engineering
- **Interpretability**: Integrated SHAP explanations without sacrificing API latency

---

## Links

- **GitHub**: [View Source Code →](https://github.com/YOUR_USERNAME/kkbox-churn-prediction)
- **Live Demo**: [Explore Dashboard →](YOUR_DEMO_URL)
