"""SHAP explanation endpoints."""

from fastapi import APIRouter, HTTPException

from api.services import model_service, shap_service

router = APIRouter(prefix="/shap", tags=["shap"])


@router.get("/{msno}")
async def get_member_explanation(msno: str) -> dict:
    """Get SHAP explanation for a specific member.

    Args:
        msno: Member ID

    Returns:
        SHAP values and top contributing features
    """
    features_df = model_service.load_features()

    if features_df.empty:
        raise HTTPException(status_code=404, detail="No feature data available")

    member_row = features_df[features_df["msno"] == msno]

    if member_row.empty:
        raise HTTPException(status_code=404, detail=f"Member {msno} not found")

    explanation = shap_service.explain_prediction(member_row)

    return {
        "msno": msno,
        "explanation": explanation,
    }
