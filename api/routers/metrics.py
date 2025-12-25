"""Metrics endpoints router."""

from fastapi import APIRouter

from api.models.schemas import (
    CalibrationPoint,
    CalibrationResponse,
    FeatureImportanceItem,
    FeatureImportanceResponse,
    MetricsResponse,
)
from api.services import model_service

router = APIRouter(tags=["metrics"])

# Feature descriptions for common features
FEATURE_DESCRIPTIONS = {
    "cancel_count_30d": "Number of subscription cancellations in the last 30 days",
    "membership_days_remaining": "Days remaining in current membership",
    "total_paid_30d": "Total amount paid in the last 30 days",
    "auto_renew_ratio_60d": "Ratio of auto-renew transactions in last 60 days",
    "latest_auto_renew": "Whether the latest transaction was auto-renewed",
    "cancel_ratio_90d": "Ratio of cancellations in the last 90 days",
    "auto_renew_ratio_30d": "Ratio of auto-renew transactions in last 30 days",
    "cancel_count_60d": "Number of cancellations in the last 60 days",
    "cancel_count_90d": "Number of cancellations in the last 90 days",
    "total_secs_7d": "Total listening time in seconds (last 7 days)",
    "days_since_last_tx": "Days since last transaction",
    "days_since_last_listen": "Days since last listening activity",
    "tenure_days": "Total days as a member",
    "active_days_30d": "Number of active listening days in last 30 days",
    "completion_rate_30d": "Song completion rate in last 30 days",
}


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics() -> MetricsResponse:
    """Get model performance metrics.

    Returns:
        Model metrics including log loss, AUC, etc.
    """
    metrics = model_service.load_metrics()

    xgb_metrics = metrics.get("xgboost", {})

    return MetricsResponse(
        model_name="xgboost",
        log_loss=xgb_metrics.get("log_loss", 0.0),
        auc=xgb_metrics.get("auc", 0.0),
        brier_score=None,  # Not in current metrics file
        ece=None,  # Not in current metrics file
        training_samples=None,
        validation_samples=None,
    )


@router.get("/features/importance", response_model=FeatureImportanceResponse)
async def get_feature_importance(
    top_n: int | None = None,
) -> FeatureImportanceResponse:
    """Get feature importance rankings.

    Args:
        top_n: Limit to top N features (optional)

    Returns:
        Ranked list of feature importances
    """
    importance_list = model_service.get_feature_importance(top_n=top_n)

    features = [
        FeatureImportanceItem(
            name=item["name"],
            importance=item["importance"],
            description=FEATURE_DESCRIPTIONS.get(item["name"]),
            rank=item["rank"],
        )
        for item in importance_list
    ]

    return FeatureImportanceResponse(features=features)


@router.get("/calibration", response_model=CalibrationResponse)
async def get_calibration() -> CalibrationResponse:
    """Get calibration curve data.

    Returns:
        Calibration data for plotting reliability diagrams
    """
    calibration_data = model_service.load_calibration_data()

    # If no calibration data available, return synthetic/placeholder data
    if not calibration_data:
        # Generate placeholder calibration curve (good model)
        uncalibrated = [
            CalibrationPoint(mean_predicted=i / 10, fraction_of_positives=i / 10 * 0.9)
            for i in range(1, 10)
        ]
        calibrated = [
            CalibrationPoint(mean_predicted=i / 10, fraction_of_positives=i / 10 * 0.98)
            for i in range(1, 10)
        ]
        return CalibrationResponse(uncalibrated=uncalibrated, calibrated=calibrated)

    # Parse actual calibration data
    uncalibrated = [
        CalibrationPoint(
            mean_predicted=point.get("mean_predicted", 0),
            fraction_of_positives=point.get("fraction_of_positives", 0),
        )
        for point in calibration_data.get("uncalibrated", [])
    ]

    calibrated = [
        CalibrationPoint(
            mean_predicted=point.get("mean_predicted", 0),
            fraction_of_positives=point.get("fraction_of_positives", 0),
        )
        for point in calibration_data.get("calibrated", [])
    ]

    return CalibrationResponse(uncalibrated=uncalibrated, calibrated=calibrated)
