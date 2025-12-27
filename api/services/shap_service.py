"""SHAP explanation service."""
import logging
from typing import Any

import numpy as np
import pandas as pd
import shap
import xgboost as xgb

from api.services import model_service

logger = logging.getLogger(__name__)

# Cache SHAP explainer
_shap_cache: dict[str, Any] = {}


def get_explainer() -> shap.TreeExplainer:
    """Get or create SHAP TreeExplainer for XGBoost model."""
    if "explainer" in _shap_cache:
        return _shap_cache["explainer"]

    bst = model_service.load_model()
    explainer = shap.TreeExplainer(bst)
    _shap_cache["explainer"] = explainer
    logger.info("SHAP TreeExplainer initialized")
    return explainer


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
        base_value = float(expected_value[1]) if len(expected_value) > 1 else float(expected_value[0])
    else:
        base_value = float(expected_value)

    return {
        "base_value": base_value,
        "shap_values": shap_dict,
        "top_risk_factors": [{"feature": k, "impact": v} for k, v in top_positive],
        "top_protective_factors": [{"feature": k, "impact": v} for k, v in top_negative],
    }
