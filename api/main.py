"""KKBOX Churn Prediction API - FastAPI application."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    """Load model and features on startup."""
    logger.info("Starting KKBOX Churn API...")

    try:
        # Load model
        model_service.load_model()
        logger.info("Model loaded successfully")

        # Load features
        features_df = model_service.load_features()
        if not features_df.empty:
            logger.info(f"Loaded {len(features_df):,} member features")
        else:
            logger.warning(
                "No features loaded - API will have limited functionality. "
                "Please ensure eval/app_features.csv exists."
            )

        # Load metrics
        metrics = model_service.load_metrics()
        if metrics:
            logger.info("Training metrics loaded successfully")

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


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "KKBOX Churn Prediction API",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }
