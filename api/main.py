"""KKBOX Churn Prediction API - FastAPI application."""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.config import settings
from api.models.schemas import HealthResponse
from api.routers import members, metrics, predictions, shap
from api.services import model_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="REST API for KKBOX churn prediction using XGBoost model",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Load model, features, and predictions on startup."""
    logger.info("Starting KKBOX Churn API...")

    try:
        # Load model
        model_service.load_model()
        logger.info("Model loaded successfully")

        # Load features
        features_df = model_service.load_features()
        if not features_df.empty:
            logger.info(f"Loaded {len(features_df):,} member features")
            # Pre-compute member data for fast API responses
            model_service.precompute_member_data()
        else:
            logger.warning(
                "No features loaded - API will have limited functionality. "
                "Please ensure eval/app_features.csv exists."
            )

        # Load pre-computed predictions for batch lookups
        predictions_df = model_service.load_predictions()
        if not predictions_df.empty:
            logger.info(f"Loaded {len(predictions_df):,} pre-computed predictions")

        # Load metrics
        metrics = model_service.load_metrics()
        if metrics:
            logger.info("Training metrics loaded successfully")

        # Load calibration data
        calibration = model_service.load_calibration_data()
        if calibration:
            logger.info("Calibration metrics loaded successfully")

        # Load rules
        from api.services import rules_service

        rules = rules_service.load_rules()
        if rules:
            logger.info("Business rules loaded successfully")

        logger.info("Startup complete - API ready to serve requests")

    except Exception as e:
        logger.error(f"Startup error: {e}")
        logger.warning("API starting with limited functionality")


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint.

    Returns:
        API health status with model and feature loading status
    """
    return HealthResponse(
        status="healthy",
        model_loaded=model_service.is_model_loaded(),
        features_loaded=model_service.is_features_loaded(),
    )


# Mount routers at /api prefix
app.include_router(members.router, prefix=settings.API_PREFIX)
app.include_router(predictions.router, prefix=settings.API_PREFIX)
app.include_router(metrics.router, prefix=settings.API_PREFIX)
app.include_router(shap.router, prefix=settings.API_PREFIX)


# Determine static files directory
# In Docker: /app/static, in development: gemini-app/dist
STATIC_DIR = Path("static")
if not STATIC_DIR.exists():
    STATIC_DIR = Path("gemini-app/dist")


@app.get("/", tags=["root"])
async def root():
    """Serve the frontend or API info."""
    # If static files exist, serve the frontend
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    # Otherwise return API info
    return {
        "message": "KKBOX Churn Prediction API",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }


# Mount static files for frontend assets (JS, CSS, images)
# This must come AFTER all API routes
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


# Catch-all route for SPA routing - must be last
@app.get("/{full_path:path}", tags=["frontend"])
async def serve_spa(full_path: str):
    """Serve the SPA for any non-API routes."""
    # Skip API routes
    if full_path.startswith("api/") or full_path == "docs" or full_path == "openapi.json":
        return {"detail": "Not Found"}

    # Check if it's a static file request
    static_file = STATIC_DIR / full_path
    if static_file.exists() and static_file.is_file():
        return FileResponse(static_file)

    # For all other routes, serve index.html (SPA routing)
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    # Fallback if no frontend
    return {"detail": "Not Found"}
