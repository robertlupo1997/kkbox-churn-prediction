# Desktop Handoff: KKBox Churn Prediction

## Current State (as of 2025-12-25)

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI Backend | ✅ Complete | All endpoints working |
| React Frontend | ✅ Complete | Connected to API |
| Docker Compose | ✅ Complete | Both services containerized |
| XGBoost Model | ✅ Trained | AUC 0.99, 8 features |
| Feature Data | ⚠️ Synthetic | 500 demo rows in `eval/app_features.csv` |

## What Needs to Happen on Desktop

### Prerequisites
- Kaggle KKBox dataset in `data/` directory
- Docker Desktop running
- ~30GB disk space for data processing

### Quick Start (Use Existing Model)

```bash
# 1. Pull latest code
git pull origin main

# 2. Generate real features from Kaggle data
make features-real

# 3. Start the stack
docker-compose up -d

# 4. Verify
curl http://localhost:8000/api/health
open http://localhost:3000
```

### Full Retrain (Optional)

```bash
make all-real   # Features + train + calibrate
docker-compose up -d
```

## Key Files

| File | Purpose | Action on Desktop |
|------|---------|-------------------|
| `eval/app_features.csv` | Member features for API | Regenerate from real data |
| `models/xgb.json` | Trained XGBoost model | Keep or retrain |
| `data/*.csv` | Raw Kaggle data | Must exist before `make features-real` |

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/members` - List members with risk scores
- `GET /api/members/{msno}` - Single member details
- `GET /api/metrics` - Model performance
- `GET /api/features/importance` - Feature rankings

## Troubleshooting

**Docker won't start?**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**API unhealthy?**
```bash
docker-compose logs api
```

**Missing features?**
- Ensure Kaggle data exists in `data/`
- Run `make features-real`

## Research Notes

See `thoughts/` directory for research on:
- Feature engineering for churn
- Model calibration (fixing 59% clustering)
- Synthetic data generation
- Production ML serving patterns
