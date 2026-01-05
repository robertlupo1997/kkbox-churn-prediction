"""SHAP explanation service."""

import logging
from typing import Any

import numpy as np
import pandas as pd

from api.services import model_service

logger = logging.getLogger(__name__)

# Cache SHAP explainer
_shap_cache: dict[str, Any] = {}


def get_explainer():
    """Get or create SHAP TreeExplainer for XGBoost model.

    Returns None if SHAP import fails or explainer can't be created.
    """
    if "explainer" in _shap_cache:
        return _shap_cache["explainer"]

    if "explainer_failed" in _shap_cache:
        return None

    try:
        import shap

        bst = model_service.load_model()
        explainer = shap.TreeExplainer(bst)
        _shap_cache["explainer"] = explainer
        logger.info("SHAP TreeExplainer initialized")
        return explainer
    except Exception as e:
        logger.warning(f"Could not initialize SHAP explainer: {e}")
        _shap_cache["explainer_failed"] = True
        return None


def _compute_feature_importance_proxy(
    member_features: pd.DataFrame, risk_score: float
) -> dict[str, Any]:
    """Compute proxy SHAP values using feature importance when true SHAP unavailable.

    This provides an approximation based on:
    - Global feature importance from the model
    - Normalized feature values for this member
    - Direction based on whether values are above/below average

    Args:
        member_features: DataFrame with one row of member features
        risk_score: The member's risk score (0-1)

    Returns:
        Dict mimicking SHAP output structure
    """
    # Get feature importance
    importance_list = model_service.get_feature_importance()
    importance_dict = {item["name"]: item["importance"] for item in importance_list}

    # Get feature columns
    drop = {"msno", "is_churn", "cutoff_ts", "window"}
    feats = [c for c in member_features.columns if c not in drop]

    # Calculate proxy SHAP values
    # Scale by importance and normalize by feature deviation from mean
    proxy_values = {}
    features_df = model_service.load_features()

    for feat in feats:
        if feat not in importance_dict:
            continue

        importance = importance_dict[feat]
        value = member_features[feat].iloc[0]

        # Skip non-numeric
        if not isinstance(value, int | float | np.number) or pd.isna(value):
            continue

        # Get mean for normalization
        if feat in features_df.columns:
            mean_val = features_df[feat].mean()
            std_val = features_df[feat].std()
            if std_val > 0:
                z_score = (value - mean_val) / std_val
            else:
                z_score = 0
        else:
            z_score = 0

        # Proxy SHAP = importance * z_score * direction adjustment
        # Positive z-score with high risk = positive contribution
        proxy = importance * z_score * 0.1  # Scale down for reasonable magnitudes
        proxy_values[feat] = float(proxy)

    # Sort by absolute impact
    sorted_features = sorted(proxy_values.items(), key=lambda x: abs(x[1]), reverse=True)
    top_positive = [(k, v) for k, v in sorted_features if v > 0][:5]
    top_negative = [(k, v) for k, v in sorted_features if v < 0][:5]

    # Base value approximation (logit of average churn rate)
    base_value = -1.5  # Approximate logit for ~18% base churn rate

    return {
        "base_value": base_value,
        "shap_values": proxy_values,
        "top_risk_factors": [{"feature": k, "impact": v} for k, v in top_positive],
        "top_protective_factors": [{"feature": k, "impact": v} for k, v in top_negative],
        "is_approximate": True,
        "note": "Using feature importance approximation (model feature mismatch)",
    }


def explain_prediction(member_features: pd.DataFrame) -> dict[str, Any]:
    """Generate SHAP explanation for a single member.

    Args:
        member_features: DataFrame with one row of member features

    Returns:
        Dict with base_value, shap_values, and top_contributors
    """
    explainer = get_explainer()

    # Prepare features (same as model_service.predict)
    drop = {"msno", "is_churn", "cutoff_ts", "window"}
    feats = [c for c in member_features.columns if c not in drop]
    X = member_features[feats].copy()

    # Encode categorical
    if "gender" in X.columns:
        gender_map = {"male": 0, "female": 1, "unknown": 2}
        X["gender"] = X["gender"].map(gender_map).fillna(2)

    X = X.fillna(0)

    # Try true SHAP if explainer available
    if explainer is not None:
        try:
            # Get SHAP values
            shap_values = explainer.shap_values(X)

            # Handle output format (could be list for multi-class or array)
            if isinstance(shap_values, list):
                shap_values = shap_values[1]  # Class 1 (churn) for binary

            # Build response
            shap_dict = dict(zip(feats, shap_values[0].tolist()))

            # Get top contributors (positive = increases churn risk)
            sorted_features = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)
            top_positive = [(k, v) for k, v in sorted_features if v > 0][:5]
            top_negative = [(k, v) for k, v in sorted_features if v < 0][:5]

            # Handle expected_value format
            expected_value = explainer.expected_value
            if isinstance(expected_value, np.ndarray):
                base_value = (
                    float(expected_value[1])
                    if len(expected_value) > 1
                    else float(expected_value[0])
                )
            else:
                base_value = float(expected_value)

            return {
                "base_value": base_value,
                "shap_values": shap_dict,
                "top_risk_factors": [{"feature": k, "impact": v} for k, v in top_positive],
                "top_protective_factors": [{"feature": k, "impact": v} for k, v in top_negative],
                "is_approximate": False,
            }
        except Exception as e:
            logger.warning(f"SHAP computation failed, using proxy: {e}")

    # Fall back to feature importance proxy
    msno = member_features["msno"].iloc[0] if "msno" in member_features.columns else None
    risk_score = 0.5
    if msno:
        member = model_service.get_member_by_msno(msno)
        if member:
            risk_score = member.get("risk_score", 0.5)

    return _compute_feature_importance_proxy(member_features, risk_score)
