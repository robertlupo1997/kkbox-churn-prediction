# KKBOX Churn Prediction API

REST API for the KKBOX churn prediction model. Exposes routes for member risk scoring, model
metrics, feature importance, and SHAP explanations.

> **Status with the checked-in defaults: member prediction does not work.** `models/xgb.json`
> declares 131 features while `eval/app_features.csv` supplies 99 predictor columns, so scoring
> raises a feature-name mismatch. The service then looks for a precomputed predictions CSV, which is
> not committed and is git-ignored. The member cache therefore stays empty: `/api/members` returns an
> empty list, single predictions return 404, and batch predictions mark every member not found.
> Supplying a compatible feature file or a precomputed predictions file is required first. See
> [../LIMITATIONS.md](../LIMITATIONS.md).
>
> Since the wave-3 repair (2026-08-23) the API loads the fitted calibrator from
> `models/isotonic_calibrator.json` and applies it to every served score, so returned
> probabilities ARE calibrated — the same quantity `models/calibration_metrics.json` measures.
> Before that repair the booster was served raw while calibrated figures were advertised.
>
> The browsable member surface is restricted to the persisted holdout population in
> `eval/serving_split.json` (1,995 members); training-split members are not listable or
> searchable.

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

Liveness endpoint. Reports whether the model file and feature file loaded. `status` is hard-coded to
`"healthy"` and does not check scoring readiness or the member cache, so a 200 here does not mean
predictions are available.

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

Returns a paginated page of the cached member list. The cache is populated at startup only if
scoring succeeds or a precomputed predictions file is present; with the checked-in defaults it is
empty and this route returns `[]`.

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
      "top_risk_factors": ["auto_renew_ratio_30d", "auto_renew_ratio_60d", "cancel_count_30d"],
      "action_recommendation": "Immediate outreach recommended"
    }
  ],
  "total": 1995,
  "limit": 100,
  "offset": 0
}
```

`top_risk_factors` is **not** member-level: precomputation assigns the same three globally most
important features to every member. `action_recommendation` is selected by hand-written score and
feature rules in `rules.yaml`; no campaign experiment has evaluated whether those actions help.

#### Get Member Detail

```
GET /api/members/{msno}
```

Returns member features, risk fields, the observed churn label when available, and a structured
`action` object (`MemberDetail` in `api/models/schemas.py`). There is no `top_risk_factors` or
`action_recommendation` field on this response.

**Response:**
```json
{
  "msno": "abc123...",
  "risk_score": 0.85,
  "risk_tier": "High",
  "is_churn": true,
  "features": {
    "tx_count_90d": 3,
    "auto_renew_ratio_30d": 0.0,
    "cancel_count_30d": 1
  },
  "action": {
    "category": "high_risk",
    "recommendation": "Immediate outreach",
    "message": "We noticed your plan is expiring soon.",
    "urgency": "high",
    "channels": ["email", "push"]
  }
}
```

---

### Predictions

#### Single Prediction

```
POST /api/predictions/single
```

Returns a cached prediction for a single member. With the checked-in defaults the cache is empty and
this route returns 404.

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
  "action": "Immediate outreach"
}
```

There is no `confidence` field. `churn_probability` is the isotonic-calibrated model score
(the same quantity the calibration endpoints measure).

#### Batch Predictions

```
POST /api/predictions
```

Returns cached predictions for multiple members. With the checked-in defaults every member comes
back with `found: false`.

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

Returns recorded model metrics as a flat object (`MetricsResponse`). There is no nested `metrics`
object, no `accuracy`, no `validation_set_size`, and no `training_date`. The figures come from the
validation window that was also used for hyperparameter tuning.

**Response:**
```json
{
  "model_name": "XGBoost",
  "log_loss": 0.4134,
  "auc": 0.9642,
  "brier_score": 0.1246,
  "ece": null,
  "training_samples": 1929125,
  "validation_samples": 970960
}
```

#### Calibration Data

```
GET /api/calibration
```

Returns uncalibrated and calibrated curve points, the bin count, and optional before/after fields
(`CalibrationResponse`). There are no `bins`, `ece`, or `mce` top-level fields.

Two caveats on this route: when curve arrays are absent from the metrics file the router
**synthesizes** near-diagonal points rather than returning nothing (the committed
`models/calibration_metrics.json` HAS measured curve arrays since 2026-08-23, so the live route
serves real points; `tests/test_calibration_serving.py` guards this), and the fields named
`ece_before` / `ece_after` are populated with Brier scores, not expected calibration error.

**Response:**
```json
{
  "uncalibrated": [{"mean_predicted": 0.05, "fraction_of_positives": 0.048}],
  "calibrated": [{"mean_predicted": 0.05, "fraction_of_positives": 0.051}],
  "n_bins": 10,
  "bin_counts": [5000],
  "ece_before": 0.1255,
  "ece_after": 0.0331
}
```

(The values above are an illustrative payload shape, not a recorded measurement; despite their
names, both fields carry Brier scores.)
```

---

### Feature Importance

```
GET /api/features/importance
```

Returns feature importance rankings from the model as a `features` list. There is no
`total_features` field; use the length of the list.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `top_n` | int | 20 | Number of top features to return |

**Response:**
```json
{
  "features": [
    {"name": "auto_renew_ratio_30d", "importance": 1.0, "description": "Auto-renew ratio (30 days)", "rank": 1},
    {"name": "auto_renew_ratio_60d", "importance": 0.222, "description": "Auto-renew ratio (60 days)", "rank": 2}
  ]
}
```

---

### SHAP Explanations

```
GET /api/shap/{msno}
```

Returns `msno` and a nested `explanation`. The explanation holds a base value, a feature-to-SHAP-value
mapping, top risk and protective factors, and an `is_approximate` flag. There is no top-level
`base_value` or `prediction`.

When true SHAP cannot be computed — which is the case for the checked-in 99-column feature rows
against the 131-feature model — the service returns a feature-importance/z-score **approximation**
with `is_approximate: true` and an explanatory `note`.

**Response:**
```json
{
  "msno": "abc123...",
  "explanation": {
    "base_value": 0.09,
    "shap_values": {"auto_renew_ratio_30d": -0.35, "cancel_count_30d": 0.22},
    "top_risk_factors": [{"feature": "cancel_count_30d", "impact": 0.22}],
    "top_protective_factors": [{"feature": "auto_renew_ratio_30d", "impact": -0.35}],
    "is_approximate": false
  }
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

- [x] Phase 1: API routes defined and served
- [x] Phase 2: Custom React/Tailwind frontend (it does **not** use shadcn/ui or Radix; those
      packages are not dependencies)
- [ ] Phase 3: Frontend-API integration — **incomplete**. The frontend health check calls `/health`
      while the backend exposes `/api/health`, and member prediction calls `GET /api/predict/{id}`
      while the backend exposes `POST /api/predictions/single`.
- [x] Phase 4: Docker containerization (see LIMITATIONS.md on the Compose frontend API URL)
- [x] Phase 5: Tests and documentation exist; see LIMITATIONS.md on what the test targets actually
      gate

Prediction serving itself is not working with the checked-in artifacts; see the note at the top of
this file.
