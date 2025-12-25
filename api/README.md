# KKBOX Churn Prediction API

FastAPI backend for serving XGBoost churn prediction model.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn api.main:app --reload

# Access the API
# - Health check: http://localhost:8000/api/health
# - Swagger docs: http://localhost:8000/docs
```

## Project Structure

```
api/
├── main.py              # FastAPI app entry point
├── config.py            # Configuration settings
├── models/
│   └── schemas.py       # Pydantic response models
├── services/
│   ├── model_service.py # XGBoost model operations
│   └── rules_service.py # Business rules engine
└── routers/
    ├── members.py       # Member endpoints (Phase 2)
    ├── predictions.py   # Prediction endpoints (Phase 2)
    └── metrics.py       # Metrics endpoints (Phase 2)
```

## Endpoints

### Current (Phase 1)

- `GET /` - API information
- `GET /api/health` - Health check with model status

### Coming Soon (Phase 2)

- `GET /api/members` - List all members with risk scores
- `GET /api/members/{msno}` - Single member details
- `POST /api/predict` - Batch predictions
- `POST /api/predict/single` - Single prediction
- `GET /api/metrics` - Model performance metrics
- `GET /api/features/importance` - Feature rankings
- `GET /api/calibration` - Calibration curve data

## Configuration

Configure via environment variables or `.env` file:

```env
MODEL_PATH=models/xgb.json
FEATURES_PATH=eval/app_features.csv
RULES_PATH=rules.yaml
METRICS_PATH=models/training_metrics.json
CALIBRATION_PATH=models/calibration_metrics.json
```

## Development

```bash
# Start with auto-reload
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
python test_api_startup.py
```

## Implementation Status

- [x] Phase 1: FastAPI backend foundation (COMPLETE)
- [ ] Phase 2: API endpoints implementation
- [ ] Phase 3: Frontend integration
- [ ] Phase 4: Docker compose setup
- [ ] Phase 5: Feature data generation

See `thoughts/shared/plans/2025-12-23-fastapi-react-integration.md` for full implementation plan.
