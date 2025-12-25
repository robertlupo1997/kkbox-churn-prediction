"""Prediction endpoints router."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.models.schemas import PredictionResponse
from api.services import model_service, rules_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


class SinglePredictionRequest(BaseModel):
    """Request for single prediction."""

    msno: str


@router.post("/single", response_model=PredictionResponse)
async def predict_single(request: SinglePredictionRequest) -> PredictionResponse:
    """Get prediction for a single member by ID.

    Args:
        request: Member ID to predict

    Returns:
        Churn prediction with risk tier and recommended action
    """
    features_df = model_service.load_features()

    if features_df.empty:
        raise HTTPException(status_code=404, detail="No feature data available")

    # Find member
    member_row = features_df[features_df["msno"] == request.msno]

    if member_row.empty:
        raise HTTPException(status_code=404, detail=f"Member {request.msno} not found")

    # Get prediction
    probs, _ = model_service.predict(member_row)
    score = float(probs[0])
    tier = rules_service.get_risk_tier(score)

    # Get recommendation
    recommendation = rules_service.get_recommendation(score)

    return PredictionResponse(
        msno=request.msno,
        churn_probability=score,
        risk_tier=tier,
        action=recommendation.get("recommendation", ""),
    )
