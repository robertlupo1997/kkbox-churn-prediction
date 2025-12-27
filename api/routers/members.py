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

    Args:
        limit: Maximum number of members to return
        offset: Number of members to skip
        risk_tier: Optional filter by risk tier

    Returns:
        Paginated list of members with risk scores
    """
    features_df = model_service.load_features()

    if features_df.empty:
        return MemberListResponse(members=[], total=0, limit=limit, offset=offset)

    # Use cached predictions if available
    cached = model_service.get_cached_predictions()
    if cached is not None:
        probs, feature_names = cached
    else:
        probs, feature_names = model_service.predict(features_df)

    # Build member list
    members = []
    for idx, row in features_df.iterrows():
        score = float(probs[idx])
        tier = rules_service.get_risk_tier(score)

        # Apply risk_tier filter if specified
        if risk_tier and tier != risk_tier:
            continue

        # Get top risk factors
        top_features = model_service.get_top_features_for_member(
            row[feature_names], top_n=3
        )

        # Get recommendation
        recommendation = rules_service.get_recommendation(score, top_features)

        members.append(
            MemberResponse(
                msno=row["msno"],
                risk_score=score,
                risk_tier=tier,
                is_churn=bool(row.get("is_churn")) if "is_churn" in row else None,
                top_risk_factors=top_features,
                action_recommendation=recommendation.get("recommendation", ""),
            )
        )

    # Sort by risk score descending
    members.sort(key=lambda m: m.risk_score, reverse=True)

    # Apply pagination
    total = len(members)
    members = members[offset : offset + limit]

    return MemberListResponse(
        members=members,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{msno}", response_model=MemberDetail)
async def get_member(msno: str) -> MemberDetail:
    """Get single member details with prediction.

    Args:
        msno: Member ID

    Returns:
        Member details with features, risk score, and recommendations
    """
    features_df = model_service.load_features()

    if features_df.empty:
        raise HTTPException(status_code=404, detail="No feature data available")

    # Find member
    member_row = features_df[features_df["msno"] == msno]

    if member_row.empty:
        raise HTTPException(status_code=404, detail=f"Member {msno} not found")

    member_row = member_row.iloc[0]

    # Get prediction
    probs, feature_names = model_service.predict(features_df[features_df["msno"] == msno])
    score = float(probs[0])
    tier = rules_service.get_risk_tier(score)

    # Get top risk factors
    top_features = model_service.get_top_features_for_member(
        member_row[feature_names], top_n=5
    )

    # Get recommendation
    recommendation = rules_service.get_recommendation(score, top_features)

    # Build feature dict (exclude metadata columns)
    drop_cols = {"msno", "is_churn", "cutoff_ts", "window"}
    features = {
        k: float(v) if isinstance(v, (int, float)) else v
        for k, v in member_row.items()
        if k not in drop_cols
    }

    action = ActionRecommendation(
        category=recommendation.get("category", "engagement"),
        recommendation=recommendation.get("recommendation", ""),
        message=recommendation.get("message", ""),
        urgency=recommendation.get("urgency", "medium"),
        channels=recommendation.get("channels", ["email"]),
    )

    return MemberDetail(
        msno=msno,
        risk_score=score,
        risk_tier=tier,
        is_churn=bool(member_row.get("is_churn")) if "is_churn" in member_row else None,
        features=features,
        action=action,
    )
