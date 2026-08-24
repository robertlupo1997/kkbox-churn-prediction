"""Member endpoints router."""

from fastapi import APIRouter, HTTPException, Query

from api.models.schemas import (
    ActionRecommendation,
    MemberDetail,
    MemberListResponse,
    MemberLookupRequest,
    MemberResponse,
)
from api.services import model_service, rules_service

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=MemberListResponse)
async def list_members(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    risk_tier: str | None = Query(None, description="Filter by risk tier: High, Medium, Low"),
    q: str | None = Query(
        None,
        min_length=1,
        max_length=64,
        description="Case-insensitive substring match on msno. This is what the demo's "
        "member search uses, so the search runs over the served population rather "
        "than a list bundled into the client.",
    ),
) -> MemberListResponse:
    """List members with risk scores, optionally filtered and searched.

    Uses pre-computed member data for instant response times.

    Args:
        limit: Maximum number of members to return
        offset: Number of members to skip
        risk_tier: Optional filter by risk tier
        q: Optional case-insensitive substring match on msno

    Returns:
        Paginated list of members with risk scores
    """
    if q:
        member_data, total = model_service.search_members(
            query=q,
            limit=limit,
            offset=offset,
            risk_tier=risk_tier,
        )
    else:
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


@router.post("/lookup", response_model=MemberDetail)
async def lookup_member(request: MemberLookupRequest) -> MemberDetail:
    """Get single member details with the member id in the request body.

    Identical payload to ``GET /members/{msno}``. It exists because that route
    is unreachable for 4,927 of the 10,000 shipped members: their base64 msno
    contains ``/``, which ends the path segment, and percent-encoding does not
    survive routing. See ``MemberLookupRequest``. The demo client uses this one
    for every member, not just the affected half, so one code path is exercised.

    Args:
        request: Body carrying the member id verbatim

    Returns:
        Member details with features, risk score, and recommendations
    """
    return _member_detail(request.msno)


@router.get("/{msno}", response_model=MemberDetail)
async def get_member(msno: str) -> MemberDetail:
    """Get single member details with prediction.

    Uses pre-computed member data for O(1) lookup.

    Unreachable for any msno containing ``/``. Use ``POST /members/lookup``.

    Args:
        msno: Member ID

    Returns:
        Member details with features, risk score, and recommendations
    """
    return _member_detail(msno)


def _member_detail(msno: str) -> MemberDetail:
    """Build the MemberDetail payload. Shared by both transports."""
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
