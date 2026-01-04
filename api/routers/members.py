"""Member endpoints router."""

from fastapi import APIRouter, HTTPException, Query

from api.models.schemas import (
    ActionRecommendation,
    MemberDetail,
    MemberListResponse,
    MemberResponse,
)
from api.services import model_service, rules_service

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=MemberListResponse)
async def list_members(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    risk_tier: str | None = Query(None, description="Filter by risk tier: High, Medium, Low"),
) -> MemberListResponse:
    """List all members with risk scores.

    Uses pre-computed member data for instant response times.

    Args:
        limit: Maximum number of members to return
        offset: Number of members to skip
        risk_tier: Optional filter by risk tier

    Returns:
        Paginated list of members with risk scores
    """
    # Use pre-computed sorted members (O(1) lookup)
    member_data, total = model_service.get_sorted_members(
        limit=limit,
        offset=offset,
        risk_tier=risk_tier,
    )

    if not member_data:
        return MemberListResponse(members=[], total=0, limit=limit, offset=offset)

    # Convert to response format
    members = [
        MemberResponse(
            msno=m["msno"],
            risk_score=m["risk_score"],
            risk_tier=m["risk_tier"],
            is_churn=m["is_churn"],
            top_risk_factors=m["top_risk_factors"],
            action_recommendation=rules_service.get_recommendation(
                m["risk_score"], m["top_risk_factors"]
            ).get("recommendation", ""),
        )
        for m in member_data
    ]

    return MemberListResponse(
        members=members,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{msno}", response_model=MemberDetail)
async def get_member(msno: str) -> MemberDetail:
    """Get single member details with prediction.

    Uses pre-computed member data for O(1) lookup.

    Args:
        msno: Member ID

    Returns:
        Member details with features, risk score, and recommendations
    """
    # O(1) lookup from pre-computed cache
    member = model_service.get_member_by_msno(msno)

    if member is None:
        raise HTTPException(status_code=404, detail=f"Member {msno} not found")

    # Get features for this member
    features = model_service.get_member_features(msno)
    if features is None:
        raise HTTPException(status_code=404, detail="No feature data available")

    # Get recommendation
    recommendation = rules_service.get_recommendation(
        member["risk_score"], member["top_risk_factors"]
    )

    action = ActionRecommendation(
        category=recommendation.get("category", "engagement"),
        recommendation=recommendation.get("recommendation", ""),
        message=recommendation.get("message", ""),
        urgency=recommendation.get("urgency", "medium"),
        channels=recommendation.get("channels", ["email"]),
    )

    return MemberDetail(
        msno=msno,
        risk_score=member["risk_score"],
        risk_tier=member["risk_tier"],
        is_churn=member["is_churn"],
        features=features,
        action=action,
    )
