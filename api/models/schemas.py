"""Pydantic models for API request/response schemas."""

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(
        ...,
        description="Liveness status. Always 'healthy'; it does not check scoring readiness.",
    )
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
    top_risk_factors: list[str] = Field(
        ...,
        description=(
            "Top globally important model features. These are the same for every member; "
            "they are not member-level risk drivers."
        ),
    )
    action_recommendation: str = Field(
        ...,
        description="Rule-selected retention action. Its effectiveness has not been evaluated.",
    )


class MemberDetail(BaseModel):
    """Detailed member information with full features."""

    msno: str = Field(..., description="Member ID")
    risk_score: float = Field(..., description="Churn probability (0-1)")
    risk_tier: str = Field(..., description="Risk tier: High, Medium, Low")
    is_churn: bool | None = Field(None, description="Actual churn label if available")
    features: dict[str, Any] = Field(..., description="All feature values")
    action: ActionRecommendation = Field(
        ...,
        description="Rule-selected action. Its effectiveness has not been evaluated.",
    )


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


class MetricRegime(BaseModel):
    """One model's metrics under a single scoring regime."""

    auc: float | None = Field(None, description="AUC-ROC score")
    log_loss: float | None = Field(None, description="Log loss score")
    brier: float | None = Field(None, description="Brier score")


class MetricsResponse(BaseModel):
    """Model performance metrics.

    The three top-level scalars do not all describe the same scores, and they
    are kept that way for compatibility with existing clients and probes:
    `auc` and `log_loss` are the raw model's, while `brier_score` is measured
    after calibration. The API serves calibrated scores. Read `uncalibrated`
    and `calibrated` for a coherent set, and `metric_regimes` for which regime
    each top-level scalar came from.
    """

    model_name: str = Field(..., description="Model type")
    log_loss: float = Field(..., description="Log loss score, uncalibrated")
    auc: float = Field(..., description="AUC-ROC score, uncalibrated")
    brier_score: float | None = Field(None, description="Brier score, calibrated")
    ece: float | None = Field(None, description="Expected calibration error")
    training_samples: int | None = Field(None, description="Number of training samples")
    validation_samples: int | None = Field(None, description="Number of validation samples")

    calibration_applied_at_serving: bool = Field(
        False,
        description="Whether the scores this API returns pass through the calibrator",
    )
    metric_regimes: dict[str, str] = Field(
        default_factory=dict,
        description="Which regime each top-level scalar was measured under",
    )
    uncalibrated: MetricRegime | None = Field(
        None, description="Raw model output on the holdout"
    )
    calibrated: MetricRegime | None = Field(
        None, description="The same scores after isotonic calibration, which is what is served"
    )


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
    n_bins: int | None = Field(None, description="Number of calibration bins")
    bin_counts: list[int] | None = Field(None, description="Sample count per bin")
    ece_before: float | None = Field(
        None, description="Populated with the Brier score before calibration, not ECE"
    )
    ece_after: float | None = Field(
        None, description="Populated with the Brier score after calibration, not ECE"
    )


class BatchPredictionRequest(BaseModel):
    """Request for batch predictions."""

    msnos: list[str] = Field(..., description="List of member IDs", max_length=1000)


class BatchPredictionItem(BaseModel):
    """Single item in batch prediction response."""

    msno: str = Field(..., description="Member ID")
    churn_probability: float = Field(..., description="Predicted churn probability")
    risk_tier: str = Field(..., description="Risk tier: High, Medium, Low")
    found: bool = Field(True, description="Whether member was found in data")


class BatchPredictionResponse(BaseModel):
    """Batch prediction response."""

    predictions: list[BatchPredictionItem] = Field(..., description="List of predictions")
    total_requested: int = Field(..., description="Total members requested")
    total_found: int = Field(..., description="Total members found")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class MemberLookupRequest(BaseModel):
    """Look up one member by id, with the id in the body.

    Path parameters cannot carry a KKBOX ``msno``: the ids are base64 and 4,927
    of the 10,000 shipped members contain ``/``, which ends the path segment.
    Percent-encoding does not help -- the server decodes ``%2F`` before routing
    and re-splits. A query parameter has the same class of problem with ``+``,
    which decodes to a space. The body is the only transport with no encoding
    trap, so it is what the demo client uses.
    """

    msno: str = Field(..., description="Member ID, verbatim -- no encoding applied")
