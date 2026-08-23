"""SHAP explanation endpoints."""

from fastapi import APIRouter, HTTPException

from api.models.schemas import MemberLookupRequest
from api.services import model_service, shap_service

router = APIRouter(prefix="/shap", tags=["shap"])


@router.post("")
async def explain_member(request: MemberLookupRequest) -> dict:
    """Get a SHAP explanation with the member id in the request body.

    Identical payload to ``GET /shap/{msno}``, and reachable for the 4,927 of
    10,000 members whose base64 msno contains ``/``. See ``MemberLookupRequest``.

    Args:
        request: Body carrying the member id verbatim

    Returns:
        SHAP values and top contributing features
    """
    return _explanation(request.msno)


@router.get("/{msno}")
async def get_member_explanation(msno: str) -> dict:
    """Get SHAP explanation for a specific member.

    Unreachable for any msno containing ``/``. Use ``POST /shap``.

    Args:
        msno: Member ID

    Returns:
        SHAP values and top contributing features
    """
    return _explanation(msno)


def _explanation(msno: str) -> dict:
    """Build the SHAP explanation payload. Shared by both transports."""
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
