"""Pydantic models for API request/response schemas."""

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., description="API health status")
    model_loaded: bool = Field(..., description="Whether the model is loaded")
    features_loaded: bool = Field(..., description="Whether features are loaded")


class ActionRecommendation(BaseModel):
    """Business action recommendation."""

    category: str = Field(..., description="Action category")
    recommendation: str = Field(..., description="Recommended action")
    message: str = Field(..., description="User-facing message")
    urgency: str = Field(..., description="Urgency level: high, medium, low")
    channels: list[str] = Field(..., description="Recommended communication channels")


class MemberResponse(BaseModel):
    """Member with risk score and recommendation."""

    msno: str = Field(..., description="Member ID")
    risk_score: float = Field(..., description="Churn probability (0-1)")
    risk_tier: str = Field(..., description="Risk tier: High, Medium, Low")
    is_churn: bool | None = Field(None, description="Actual churn label if available")
    top_risk_factors: list[str] = Field(..., description="Top features driving the risk score")
    action_recommendation: str = Field(..., description="Recommended retention action")


class MemberDetail(BaseModel):
    """Detailed member information with full features."""

    msno: str = Field(..., description="Member ID")
    risk_score: float = Field(..., description="Churn probability (0-1)")
    risk_tier: str = Field(..., description="Risk tier: High, Medium, Low")
    is_churn: bool | None = Field(None, description="Actual churn label if available")
    features: dict[str, Any] = Field(..., description="All feature values")
    action: ActionRecommendation = Field(..., description="Detailed action plan")


class MemberListResponse(BaseModel):
    """Paginated list of members."""

    members: list[MemberResponse] = Field(..., description="List of members")
    total: int = Field(..., description="Total number of members")
    limit: int = Field(..., description="Page size")
    offset: int = Field(..., description="Offset for pagination")


class PredictionResponse(BaseModel):
    """Single prediction result."""

    msno: str = Field(..., description="Member ID")
    churn_probability: float = Field(..., description="Predicted churn probability")
    risk_tier: str = Field(..., description="Risk tier: High, Medium, Low")
    action: str = Field(..., description="Recommended action")


class MetricsResponse(BaseModel):
    """Model performance metrics."""

    model_name: str = Field(..., description="Model type")
    log_loss: float = Field(..., description="Log loss score")
    auc: float = Field(..., description="AUC-ROC score")
    brier_score: float | None = Field(None, description="Brier score")
    ece: float | None = Field(None, description="Expected calibration error")
    training_samples: int | None = Field(None, description="Number of training samples")
    validation_samples: int | None = Field(None, description="Number of validation samples")


class FeatureImportanceItem(BaseModel):
    """Single feature importance item."""

    name: str = Field(..., description="Feature name")
    importance: float = Field(..., description="Importance score")
    description: str | None = Field(None, description="Feature description")
    rank: int = Field(..., description="Rank by importance")


class FeatureImportanceResponse(BaseModel):
    """List of feature importances."""

    features: list[FeatureImportanceItem] = Field(..., description="Ranked feature importances")


class CalibrationPoint(BaseModel):
    """Calibration curve data point."""

    mean_predicted: float = Field(..., description="Mean predicted probability")
    fraction_of_positives: float = Field(..., description="Fraction of positive samples")


class CalibrationResponse(BaseModel):
    """Calibration curve data."""

    uncalibrated: list[CalibrationPoint] = Field(..., description="Uncalibrated predictions")
    calibrated: list[CalibrationPoint] = Field(..., description="Calibrated predictions")
