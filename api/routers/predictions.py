"""Prediction endpoints router."""

import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.models.schemas import (
    BatchPredictionItem,
    BatchPredictionRequest,
    BatchPredictionResponse,
    PredictionResponse,
)
from api.services import model_service, rules_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


class SinglePredictionRequest(BaseModel):
    """Request for single prediction."""

    msno: str


@router.post("/single", response_model=PredictionResponse)
async def predict_single(request: SinglePredictionRequest) -> PredictionResponse:
    """Get prediction for a single member by ID.

    Uses pre-computed predictions for efficiency.
    Falls back to on-demand prediction if not found.

    Args:
        request: Member ID to predict

    Returns:
        Churn prediction with risk tier and recommended action
    """
    # Try pre-computed prediction first (O(1) lookup)
    pred = model_service.get_prediction_by_msno(request.msno)

    if pred:
        score = pred["stacked_pred"]
        tier = rules_service.get_risk_tier(score)
        recommendation = rules_service.get_recommendation(score)

        return PredictionResponse(
            msno=request.msno,
            churn_probability=score,
            risk_tier=tier,
            action=recommendation.get("recommendation", ""),
        )

    # Fall back to member cache lookup
    member = model_service.get_member_by_msno(request.msno)
    if member:
        score = member["risk_score"]
        tier = member["risk_tier"]
        recommendation = rules_service.get_recommendation(score)

        return PredictionResponse(
            msno=request.msno,
            churn_probability=score,
            risk_tier=tier,
            action=recommendation.get("recommendation", ""),
        )

    raise HTTPException(status_code=404, detail=f"Member {request.msno} not found")


@router.post("", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest) -> BatchPredictionResponse:
    """Get predictions for multiple members.

    Efficiently processes up to 1000 member IDs at once.
    Uses pre-computed predictions where available.

    Args:
        request: List of member IDs

    Returns:
        Batch prediction results with processing time
    """
    start_time = time.time()

    # Validate input size
    if len(request.msnos) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 members per batch request")

    # Get batch predictions
    results = model_service.get_batch_predictions(request.msnos)

    predictions = []
    found_count = 0

    for result in results:
        if result["found"]:
            found_count += 1
            score = result.get("stacked_pred", 0.0)
            predictions.append(
                BatchPredictionItem(
                    msno=result["msno"],
                    churn_probability=score,
                    risk_tier=rules_service.get_risk_tier(score),
                    found=True,
                )
            )
        else:
            # Try member cache as fallback
            member = model_service.get_member_by_msno(result["msno"])
            if member:
                found_count += 1
                predictions.append(
                    BatchPredictionItem(
                        msno=result["msno"],
                        churn_probability=member["risk_score"],
                        risk_tier=member["risk_tier"],
                        found=True,
                    )
                )
            else:
                predictions.append(
                    BatchPredictionItem(
                        msno=result["msno"],
                        churn_probability=0.0,
                        risk_tier="Unknown",
                        found=False,
                    )
                )

    processing_time = (time.time() - start_time) * 1000

    return BatchPredictionResponse(
        predictions=predictions,
        total_requested=len(request.msnos),
        total_found=found_count,
        processing_time_ms=round(processing_time, 2),
    )
