# Docker Deployment Guide

This guide explains how to run the KKBOX Churn Prediction service using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers

## Architecture

The application consists of two services:

1. **API Service** (Port 8000)
   - FastAPI backend serving the ML prediction model
   - Loads XGBoost model, features, and business rules
   - Provides REST API endpoints for predictions

2. **Frontend Service** (Port 3000)
   - React/Vite application
   - Connects to API service for data and predictions
   - Provides interactive UI for churn analysis

## Quick Start

### 1. Build and Start Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### 2. Access the Application

- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- API Health: http://localhost:8000/api/health

### 3. Stop Services

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Service Details

### API Service

**Build Context**: Project root (`.`)
**Dockerfile**: `./Dockerfile`
**Port**: 8000

**Mounted Volumes**:
- `./models` → `/app/models` (read-only) - Trained models
- `./eval` → `/app/eval` (read-only) - Feature data and metrics
- `./rules.yaml` → `/app/rules.yaml` (read-only) - Business rules
- `./features.yaml` → `/app/features.yaml` (read-only) - Feature definitions

**Environment Variables**:
- `MODEL_PATH` - Path to XGBoost model (default: models/xgb.json)
- `FEATURES_PATH` - Path to features CSV (default: eval/app_features.csv)
- `RULES_PATH` - Path to business rules (default: rules.yaml)
- `METRICS_PATH` - Path to training metrics (default: models/training_metrics.json)
- `CORS_ORIGINS` - Allowed CORS origins

**Health Check**: GET /api/health (every 30s)

### Frontend Service

**Build Context**: `./gemini-app`
**Dockerfile**: `./gemini-app/Dockerfile`
**Port**: 3000

**Environment Variables**:
- `VITE_API_URL` - API service URL (default: http://api:8000)

**Dependencies**: Waits for API service to be healthy before starting

## Development Workflow

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
```

### Rebuild After Changes

```bash
# Rebuild specific service
docker-compose build api
docker-compose build frontend

# Restart service
docker-compose restart api
```

### Execute Commands in Container

```bash
# API service
docker-compose exec api bash
docker-compose exec api python -c "import api; print(api.__version__)"

# Frontend service
docker-compose exec frontend sh
docker-compose exec frontend npm run build
```

## Troubleshooting

### API Service Won't Start

1. Check if model files exist:
   ```bash
   ls -la models/
   ls -la eval/
   ```

2. View API logs:
   ```bash
   docker-compose logs api
   ```

3. Verify health check:
   ```bash
   docker-compose exec api curl http://localhost:8000/api/health
   ```

### Frontend Can't Connect to API

1. Check if API is healthy:
   ```bash
   docker-compose ps
   ```

2. Verify network connectivity:
   ```bash
   docker-compose exec frontend ping api
   ```

3. Check CORS settings in API logs

### Port Already in Use

If ports 3000 or 8000 are already in use, modify `docker-compose.yml`:

```yaml
services:
  api:
    ports:
      - "8001:8000"  # Change host port
  frontend:
    ports:
      - "3001:3000"  # Change host port
```

## Production Deployment

For production deployment, consider:

1. **Remove --reload flag** from API command:
   ```yaml
   command: uvicorn api.main:app --host 0.0.0.0 --port 8000
   ```

2. **Build frontend for production**:
   Update frontend Dockerfile CMD to:
   ```dockerfile
   RUN npm run build
   CMD ["npm", "run", "preview"]
   ```

3. **Use environment file**:
   ```bash
   docker-compose --env-file .env.production up -d
   ```

4. **Add resource limits**:
   ```yaml
   services:
     api:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

## Network Architecture

Services communicate over a dedicated Docker bridge network (`kkbox-network`):

```
Internet
    ↓
Host Machine (localhost)
    ↓
    ├── Port 3000 → Frontend Container
    └── Port 8000 → API Container
         ↑
         └── Internal: api:8000 (used by frontend)
```

## Volume Mounts

All volumes are mounted as **read-only** (`:ro`) to prevent accidental modifications:

- Models and features are loaded at startup
- To update models, stop containers, update files, and restart
- For development with hot-reload, remove `:ro` flags

## Customization

### Use Different Model

Update volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./custom_models:/app/models:ro
```

### Add New Environment Variables

Edit `.env` file or add to `docker-compose.yml`:

```yaml
environment:
  - CUSTOM_VAR=value
```

### Change API Port

```yaml
services:
  api:
    ports:
      - "8080:8000"  # External:Internal
    environment:
      - VITE_API_URL=http://api:8000  # Keep internal port
```
