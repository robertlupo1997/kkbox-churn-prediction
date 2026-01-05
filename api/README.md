# KKBOX Churn Prediction API

REST API for the KKBOX churn prediction model. Provides endpoints for member risk scoring, model metrics, feature importance, and SHAP explanations.

## Quick Start

```bash
# Install dependencies
pip install -r api/requirements.txt

# Run API server
uvicorn api.main:app --port 8001 --reload

# API docs available at
# http://localhost:8001/docs (Swagger UI)
# http://localhost:8001/redoc (ReDoc)
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
    ├── members.py       # Member endpoints
    ├── predictions.py   # Prediction endpoints
    ├── metrics.py       # Metrics endpoints
    └── shap.py          # SHAP explanation endpoints
```

## Endpoints

### Health Check

```
GET /api/health
```

Returns API health status and model loading state.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "features_loaded": true
}
```

---

### Members

#### List Members

```
GET /api/members
```

Returns paginated list of members with risk scores.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | int | 100 | Max members to return (1-1000) |
| `offset` | int | 0 | Number of members to skip |
| `risk_tier` | string | null | Filter by risk tier: High, Medium, Low |

**Response:**
```json
{
  "members": [
    {
      "msno": "abc123...",
      "risk_score": 0.85,
      "risk_tier": "High",
      "is_churn": true,
      "top_risk_factors": ["membership_days_remaining", "days_since_last_tx"],
      "action_recommendation": "Immediate outreach recommended"
    }
  ],
  "total": 10000,
  "limit": 100,
  "offset": 0
}
```

#### Get Member Detail

```
GET /api/members/{msno}
```

Returns detailed information for a specific member.

**Response:**
```json
{
  "msno": "abc123...",
  "risk_score": 0.85,
  "risk_tier": "High",
  "is_churn": true,
  "features": {
    "tenure_days": 365,
    "total_secs_90d": 150000,
    "membership_days_remaining": 5
  },
  "top_risk_factors": ["membership_days_remaining", "days_since_last_tx"],
  "action_recommendation": "Immediate outreach recommended"
}
```

---

### Predictions

#### Single Prediction

```
POST /api/predictions/single
```

Get churn prediction for a single member.

**Request:**
```json
{
  "msno": "abc123..."
}
```

**Response:**
```json
{
  "msno": "abc123...",
  "churn_probability": 0.85,
  "risk_tier": "High",
  "confidence": 0.92
}
```

#### Batch Predictions

```
POST /api/predictions
```

Get churn predictions for multiple members.

**Request:**
```json
{
  "msnos": ["abc123...", "def456...", "ghi789..."]
}
```

**Response:**
```json
{
  "predictions": [
    {
      "msno": "abc123...",
      "churn_probability": 0.85,
      "risk_tier": "High",
      "found": true
    }
  ],
  "total_requested": 3,
  "total_found": 3,
  "processing_time_ms": 5.2
}
```

---

### Metrics

#### Model Performance

```
GET /api/metrics
```

Returns model performance metrics.

**Response:**
```json
{
  "model_name": "LightGBM",
  "metrics": {
    "auc": 0.9696,
    "log_loss": 0.1127,
    "brier_score": 0.033,
    "accuracy": 0.91
  },
  "validation_set_size": 97000,
  "training_date": "2017-03-01"
}
```

#### Calibration Data

```
GET /api/calibration
```

Returns calibration curve data for the model.

**Response:**
```json
{
  "bins": [
    {"bin_start": 0.0, "bin_end": 0.1, "predicted_mean": 0.05, "actual_mean": 0.048, "count": 5000}
  ],
  "ece": 0.012,
  "mce": 0.035
}
```

---

### Feature Importance

```
GET /api/features/importance
```

Returns feature importance rankings from the model.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `top_n` | int | 20 | Number of top features to return |

**Response:**
```json
{
  "features": [
    {"name": "membership_days_remaining", "importance": 1373, "description": "Days until subscription expires"},
    {"name": "tenure_days", "importance": 872, "description": "How long user has been a member"}
  ],
  "total_features": 131
}
```

---

### SHAP Explanations

```
GET /api/shap/{msno}
```

Returns SHAP values explaining prediction for a specific member.

**Response:**
```json
{
  "msno": "abc123...",
  "base_value": 0.09,
  "prediction": 0.85,
  "shap_values": [
    {"feature": "membership_days_remaining", "value": 5, "shap_value": 0.35},
    {"feature": "days_since_last_tx", "value": 45, "shap_value": 0.22}
  ]
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "detail": "Member not found"
}
```

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 404 | Resource not found |
| 422 | Validation error |
| 500 | Internal server error |

---

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_PATH` | `models/xgb.json` | Path to XGBoost model |
| `FEATURES_PATH` | `eval/app_features.csv` | Path to member features |
| `RULES_PATH` | `rules.yaml` | Path to business rules |
| `METRICS_PATH` | `models/training_metrics.json` | Path to training metrics |
| `CALIBRATION_PATH` | `models/calibration_metrics.json` | Path to calibration data |

---

## Running Tests

```bash
# Run API integration tests
pytest tests/api_tests/test_endpoints.py -v

# Run all tests
pytest tests/ -v
```

## Implementation Status

- [x] Phase 1: API endpoints (complete)
- [x] Phase 2: Frontend redesign with shadcn/ui
- [x] Phase 3: Frontend-API integration
- [x] Phase 4: Docker containerization
- [x] Phase 5: Testing & documentation
