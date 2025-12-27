"""Model loading and prediction service."""

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from api.config import settings

logger = logging.getLogger(__name__)

# Global cache for model and features
_model_cache: dict[str, Any] = {}


def get_cached_predictions() -> tuple[np.ndarray, list[str]] | None:
    """Get cached predictions if available."""
    if "predictions" in _model_cache:
        return _model_cache["predictions"]
    return None


def cache_predictions(probs: np.ndarray, feature_names: list[str]) -> None:
    """Cache predictions for reuse."""
    _model_cache["predictions"] = (probs, feature_names)


def load_model() -> xgb.Booster:
    """Load XGBoost model from JSON file.

    Returns:
        Loaded XGBoost Booster

    Raises:
        FileNotFoundError: If model file doesn't exist
        Exception: If model loading fails
    """
    if "model" in _model_cache:
        logger.info("Using cached model")
        return _model_cache["model"]

    model_path = Path(settings.MODEL_PATH)
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    try:
        # Load XGBoost model using Booster for compatibility
        bst = xgb.Booster()
        bst.load_model(str(model_path))

        _model_cache["model"] = bst
        logger.info(f"Model loaded successfully from {model_path} ({bst.num_features()} features)")
        return bst

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


def load_features() -> pd.DataFrame:
    """Load pre-computed features from CSV.

    Returns:
        DataFrame with member features

    Raises:
        FileNotFoundError: If features file doesn't exist
    """
    if "features" in _model_cache:
        logger.info("Using cached features")
        return _model_cache["features"]

    features_path = Path(settings.FEATURES_PATH)
    if not features_path.exists():
        logger.warning(
            f"Features file not found: {features_path}. "
            "Returning empty DataFrame."
        )
        return pd.DataFrame()

    try:
        df = pd.read_csv(features_path)
        _model_cache["features"] = df

        # Pre-compute and cache predictions for all members at load time
        probs, feats = predict(df)
        cache_predictions(probs, feats)

        logger.info(f"Loaded {len(df):,} members from {features_path}")
        return df

    except Exception as e:
        logger.error(f"Failed to load features: {e}")
        raise


def load_metrics() -> dict[str, Any]:
    """Load training metrics from JSON file.

    Returns:
        Dictionary with model metrics
    """
    if "metrics" in _model_cache:
        return _model_cache["metrics"]

    metrics_path = Path(settings.METRICS_PATH)
    if not metrics_path.exists():
        logger.warning(f"Metrics file not found: {metrics_path}")
        return {}

    try:
        with open(metrics_path, "r") as f:
            metrics = json.load(f)
        _model_cache["metrics"] = metrics
        logger.info(f"Loaded metrics from {metrics_path}")
        return metrics

    except Exception as e:
        logger.error(f"Failed to load metrics: {e}")
        return {}


def load_calibration_data() -> dict[str, Any]:
    """Load calibration curve data from JSON file.

    Returns:
        Dictionary with calibration data
    """
    if "calibration" in _model_cache:
        return _model_cache["calibration"]

    calibration_path = Path(settings.CALIBRATION_PATH)
    if not calibration_path.exists():
        logger.warning(f"Calibration file not found: {calibration_path}")
        return {}

    try:
        with open(calibration_path, "r") as f:
            calibration = json.load(f)
        _model_cache["calibration"] = calibration
        logger.info(f"Loaded calibration data from {calibration_path}")
        return calibration

    except Exception as e:
        logger.error(f"Failed to load calibration data: {e}")
        return {}


def predict(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """Generate churn predictions for members.

    Args:
        df: DataFrame with member features

    Returns:
        Tuple of (probabilities, feature_names)
        - probabilities: Array of churn probabilities
        - feature_names: List of feature column names used
    """
    bst = load_model()

    # Drop metadata columns
    drop = {"msno", "is_churn", "cutoff_ts", "window"}
    feats = [c for c in df.columns if c not in drop]

    X = df[feats].copy()

    # Encode categorical columns
    if "gender" in X.columns:
        gender_map = {"male": 0, "female": 1, "unknown": 2}
        X["gender"] = X["gender"].map(gender_map).fillna(2)

    # Fill missing values and convert to DMatrix with feature names
    X = X.fillna(0)
    dmatrix = xgb.DMatrix(X, feature_names=feats)

    # Get predictions (Booster returns probabilities directly for binary classification)
    probs = bst.predict(dmatrix)

    return probs, feats


def get_feature_importance(top_n: int | None = None) -> list[dict[str, Any]]:
    """Extract feature importance from model.

    Args:
        top_n: Return only top N features (None for all)

    Returns:
        List of dicts with feature name, importance, and rank
    """
    metrics = load_metrics()

    # Get XGBoost feature importance from metrics
    xgb_metrics = metrics.get("xgboost", {})
    feature_importance = xgb_metrics.get("feature_importance", {})

    if not feature_importance:
        logger.warning("No feature importance found in metrics")
        return []

    # Convert to list and sort by importance
    importance_list = [
        {"name": name, "importance": float(imp), "rank": idx + 1}
        for idx, (name, imp) in enumerate(
            sorted(feature_importance.items(), key=lambda x: float(x[1]), reverse=True)
        )
    ]

    if top_n is not None:
        importance_list = importance_list[:top_n]

    return importance_list


def get_top_features_for_member(
    feature_values: pd.Series, top_n: int = 5
) -> list[str]:
    """Get top risk factors for a specific member.

    Args:
        feature_values: Series of feature values for a member
        top_n: Number of top features to return

    Returns:
        List of feature names that contribute most to risk
    """
    # Get global feature importance
    importance_dict = {
        item["name"]: item["importance"] for item in get_feature_importance()
    }

    # Calculate weighted impact for this member
    # Higher feature value * higher importance = higher contribution
    member_impacts = []
    for feature_name in feature_values.index:
        if feature_name in importance_dict:
            value = abs(feature_values[feature_name])
            importance = importance_dict[feature_name]
            impact = value * importance
            member_impacts.append((feature_name, impact))

    # Sort by impact and return top N
    member_impacts.sort(key=lambda x: x[1], reverse=True)
    return [name for name, _ in member_impacts[:top_n]]


def is_model_loaded() -> bool:
    """Check if model is loaded in cache."""
    return "model" in _model_cache


def is_features_loaded() -> bool:
    """Check if features are loaded in cache."""
    return "features" in _model_cache and not _model_cache["features"].empty
