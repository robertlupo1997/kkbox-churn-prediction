# KKBOX Churn Prediction

Production-ready ML churn prediction pipeline for KKBOX music streaming service. Achieves 0.97 AUC with strict temporal validation (no data leakage).

## Quick Reference

```bash
# Install dependencies
make install          # or: pip install -r requirements.txt
make dev              # Install dev dependencies

# Run tests
make test             # Run pytest suite
make test-ci          # CI-friendly test run

# Train models
make features         # Generate features (synthetic data)
make features-real    # Generate from real KKBOX data (30GB, 10-30 min)
make models           # Train models
make calibrate        # Calibrate predictions

# Full pipeline
make all              # install -> lint -> test -> features -> models -> calibrate -> evaluate
make all-real         # Full pipeline with real data

# Start application
make app              # Docker Compose: API on :8000, Frontend on :3000

# Code quality
make lint             # Run ruff + black checks
make format           # Auto-format code
```

## Tech Stack

### Backend (Python 3.11+)
- **ML**: XGBoost, LightGBM, CatBoost, scikit-learn
- **Data**: DuckDB, pandas, numpy, pyarrow
- **Tuning**: Optuna
- **Interpretability**: SHAP
- **API**: FastAPI, uvicorn

### Frontend (React/TypeScript)
- **Framework**: React 19, TypeScript 5.8
- **Build**: Vite 6
- **Routing**: react-router-dom 7
- **Charts**: Recharts 3.6
- **Icons**: lucide-react
- **Animation**: framer-motion
- **Styling**: Tailwind CSS (utility classes)

### Infrastructure
- Docker + Docker Compose
- GitHub Actions CI/CD
- Hugging Face Spaces deployment

## Project Structure

```
KKBOX_PROJECT/
├── src/                    # Core ML pipeline
│   ├── make_dataset.py     # DuckDB data loading
│   ├── features_processor.py        # Feature pipeline
│   ├── features_comprehensive_processor.py  # 100+ feature generation
│   ├── labels.py           # 30-day churn rule implementation
│   ├── models.py           # Model training
│   ├── stacking.py         # Ensemble methods
│   ├── calibration.py      # Isotonic calibration
│   ├── temporal_cv.py      # Temporal cross-validation
│   ├── backtest.py         # Rolling backtests
│   └── psi.py              # Population Stability Index
├── api/                    # FastAPI application
│   ├── main.py             # App entry point
│   ├── routers/            # Endpoint definitions
│   │   ├── predictions.py  # /predictions endpoints
│   │   ├── members.py      # /members endpoints
│   │   ├── metrics.py      # /metrics endpoints
│   │   └── shap.py         # /shap endpoints
│   └── services/           # Business logic
│       ├── model_service.py
│       ├── rules_service.py
│       └── shap_service.py
├── brutalist-aesthetic-kkbox-churn-analysis-pro/  # React dashboard
│   ├── App.tsx             # Root component with routing
│   ├── components/         # React components
│   │   ├── Dashboard.tsx   # Main dashboard view
│   │   ├── MemberLookup.tsx
│   │   ├── ModelPerformance.tsx
│   │   ├── FeatureImportanceView.tsx
│   │   ├── ROICalculator.tsx
│   │   └── About.tsx
│   └── data/               # JSON data files for visualizations
├── features/               # SQL feature definitions
│   ├── features_comprehensive.sql  # 135 features
│   └── features_simple.sql
├── sql/                    # Data pipeline SQL scripts
│   ├── 00_create_staging_tables.sql
│   ├── 01_ingest_data.sql
│   ├── 02_create_core_tables.sql
│   ├── 03_feature_engineering.sql
│   ├── 04_kpi_metrics.sql
│   ├── 05_analysis_queries.sql
│   ├── 06_predictive_features.sql
│   ├── 07_churn_risk_scoring.sql
│   └── 08_validation.sql
├── models/                 # Trained models & metrics
├── eval/                   # Evaluation outputs
├── tests/                  # Test suite
├── scripts/                # Utility scripts
├── docs/                   # Documentation
└── specs/                  # Project specifications
```

## Key Commands

### Training Pipeline
```bash
python train_models.py                    # Train with synthetic data
python train_models.py --features <path>  # Train with specific features
python run_full_pipeline.py               # End-to-end pipeline
python run_full_pipeline.py --skip-features --skip-tuning
```

### Calibration & Evaluation
```bash
python src/calibration.py                 # Run calibration
python src/calibrate_and_evaluate.py      # Calibrate and evaluate
python src/run_error_analysis.py --calibrate
```

### Backtesting
```bash
make backtest         # Rolling backtests (requires real data)
make backtest-ci      # Backtests with synthetic data
make psi              # Calculate PSI drift metrics
```

### Docker
```bash
make docker-build     # Build image
make docker-run       # Run container
make docker-test      # Run tests in container
docker-compose up -d  # Start full stack
```

### Frontend Development
```bash
cd brutalist-aesthetic-kkbox-churn-analysis-pro
npm install
npm run dev           # Start dev server
npm run build         # Production build
npm run preview       # Preview production build
```

## API Endpoints

Base URL: `http://localhost:8000/api`

- `GET /health` - Health check
- `GET /members` - List members with predictions
- `GET /members/{id}` - Member details with SHAP explanations
- `POST /predictions` - Single prediction
- `POST /predictions/batch` - Batch predictions
- `GET /metrics` - Model performance metrics
- `GET /metrics/features` - Feature importance
- `GET /metrics/calibration` - Calibration data
- `GET /shap/{member_id}` - SHAP explanations

## Testing

```bash
make test                 # Full test suite
pytest tests/ -v          # Verbose output
pytest tests/test_labels.py  # Specific test file
pytest -k "temporal"      # Tests matching pattern
```

Key test files:
- `tests/test_temporal_safety.py` - Temporal validation tests
- `tests/test_labels.py` - Churn label logic tests
- `tests/test_calibration_modules.py` - Calibration tests
- `tests/api_tests/test_endpoints.py` - API integration tests

## Configuration Files

- `features.yaml` - Feature definitions
- `rules.yaml` - Business rules for recommendations
- `pytest.ini` - Pytest configuration
- `pyproject.toml` - Python project config (ruff, black, mypy)
- `.pre-commit-config.yaml` - Pre-commit hooks
- `mkdocs.yml` - Documentation site config

## Data Flow

1. **Raw Data** (KKBOX Kaggle competition data)
2. **SQL Processing** (`sql/00-08_*.sql`) - Staging, core tables, feature engineering
3. **Feature Generation** (`src/features_processor.py`) - 135 features via DuckDB
4. **Model Training** (`src/models.py`, `train_models.py`) - LightGBM, XGBoost, CatBoost
5. **Calibration** (`src/calibration.py`) - Isotonic regression
6. **API Serving** (`api/`) - FastAPI with cached predictions
7. **Dashboard** (`brutalist-aesthetic-kkbox-churn-analysis-pro/`) - React visualization

## Key Concepts

### Temporal Validation
All features use only past information. Train on Jan-Feb 2017, validate on Mar 2017. No data leakage.

### 30-Day Churn Rule
User churns if no new subscription within 30 days after expiration (official KKBOX definition).

### Isotonic Calibration
Transforms model confidence scores into true probabilities. Preserves ranking (AUC) while fixing calibration (log loss).

### Feature Categories (135 total)
- Transaction features (35): Payment patterns across 5 time windows
- User log features (50): Listening behavior, completion rates
- Trend features (10): Week-over-week, month-over-month changes
- Historical churn (10): `last_N_is_churn`, `churn_rate`
- Winner-inspired (15): `autorenew_not_cancel`, `amt_per_day`
- Demographics (5): Age, gender, tenure, registration channel

## Environment Variables

```bash
# API Configuration (docker-compose.yml)
MODEL_PATH=models/xgb.json
FEATURES_PATH=eval/app_features.csv
RULES_PATH=rules.yaml
METRICS_PATH=models/training_metrics.json
CALIBRATION_PATH=models/calibration_metrics.json
CORS_ORIGINS=["http://localhost:3000"]

# Frontend
VITE_API_URL=http://api:8000
```
