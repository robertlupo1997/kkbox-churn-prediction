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

# Global cache for model, features, and pre-computed member data
_model_cache: dict[str, Any] = {}

# Pre-computed member data for fast lookups
_member_cache: dict[str, dict] = {}  # msno -> member data
_sorted_members: list[dict] = []  # Pre-sorted by risk score
_tier_counts: dict[str, int] = {"High": 0, "Medium": 0, "Low": 0}

# Pre-computed predictions cache for batch lookups
_predictions_cache: pd.DataFrame | None = None
_predictions_index: dict[str, int] = {}  # msno -> row index


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
        logger.warning(f"Features file not found: {features_path}. " "Returning empty DataFrame.")
        return pd.DataFrame()

    try:
        df = pd.read_csv(features_path)
        _model_cache["features"] = df

        # Try to pre-compute predictions, but don't fail if features don't match
        # (we can fall back to pre-computed predictions from CSV)
        try:
            probs, feats = predict(df)
            cache_predictions(probs, feats)
        except Exception as pred_err:
            logger.warning(
                f"Could not generate predictions from features (may have feature mismatch): {pred_err}"
            )
            logger.info("Will rely on pre-computed predictions from CSV instead")

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
        with open(metrics_path) as f:
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
        with open(calibration_path) as f:
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


def get_top_features_for_member(feature_values: pd.Series, top_n: int = 5) -> list[str]:
    """Get top risk factors for a specific member.

    Args:
        feature_values: Series of feature values for a member
        top_n: Number of top features to return

    Returns:
        List of feature names that contribute most to risk
    """
    # Get global feature importance
    importance_dict = {item["name"]: item["importance"] for item in get_feature_importance()}

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


def precompute_member_data() -> None:
    """Pre-compute all member data for fast API responses.

    This is called once at startup after features are loaded.
    Pre-computes risk scores, tiers, and sorts by risk score.
    Uses stacked_ensemble_predictions.csv if model predictions unavailable.
    """
    global _member_cache, _sorted_members, _tier_counts

    features_df = _model_cache.get("features")
    if features_df is None or features_df.empty:
        logger.warning("No features to precompute")
        return

    # Try to get predictions from cache (model-generated)
    cached = get_cached_predictions()

    if cached is None:
        # Fall back to stacked ensemble predictions from CSV
        logger.info("Using stacked_ensemble_predictions.csv for member risk scores")
        predictions_df = load_predictions()
        if predictions_df.empty:
            logger.warning("No predictions available - cannot precompute member data")
            return

        # Merge predictions with features on msno
        merged = features_df.merge(
            predictions_df[["msno", "stacked_pred", "is_churn"]],
            on="msno",
            how="left",
        )
        probs = merged["stacked_pred"].fillna(0.5).values
        feature_names = [
            c for c in features_df.columns if c not in {"msno", "is_churn", "cutoff_ts", "window"}
        ]
    else:
        probs, feature_names = cached

    # Get feature importance for risk factors (do once)
    importance_dict = {item["name"]: item["importance"] for item in get_feature_importance()}
    top_features_global = sorted(
        importance_dict.keys(), key=lambda x: importance_dict.get(x, 0), reverse=True
    )[:10]

    logger.info("Pre-computing member data for %d members...", len(features_df))

    # Reset caches
    _member_cache = {}
    _sorted_members = []
    _tier_counts = {"High": 0, "Medium": 0, "Low": 0}

    # Vectorized tier assignment
    tiers = np.where(probs >= 0.7, "High", np.where(probs >= 0.3, "Medium", "Low"))

    # Build member cache using vectorized operations
    msno_col = features_df["msno"].values
    is_churn_col = (
        features_df["is_churn"].values
        if "is_churn" in features_df.columns
        else [None] * len(features_df)
    )

    for idx in range(len(features_df)):
        msno = msno_col[idx]
        score = float(probs[idx])
        tier = tiers[idx]

        # Use global top features instead of per-member calculation (much faster)
        member_data = {
            "msno": msno,
            "risk_score": score,
            "risk_tier": tier,
            "is_churn": bool(is_churn_col[idx]) if is_churn_col[idx] is not None else None,
            "top_risk_factors": top_features_global[:3],
            "idx": idx,  # Store index for feature lookup
        }

        _member_cache[msno] = member_data
        _sorted_members.append(member_data)
        _tier_counts[tier] += 1

    # Sort once by risk score descending
    _sorted_members.sort(key=lambda x: x["risk_score"], reverse=True)

    logger.info(
        "Pre-computed %d members: High=%d, Medium=%d, Low=%d",
        len(_member_cache),
        _tier_counts["High"],
        _tier_counts["Medium"],
        _tier_counts["Low"],
    )


def get_sorted_members(
    limit: int = 100,
    offset: int = 0,
    risk_tier: str | None = None,
) -> tuple[list[dict], int]:
    """Get pre-sorted members with pagination.

    Args:
        limit: Maximum members to return
        offset: Number to skip
        risk_tier: Optional filter by tier

    Returns:
        Tuple of (members list, total count)
    """
    if not _sorted_members:
        return [], 0

    if risk_tier:
        # Filter by tier
        filtered = [m for m in _sorted_members if m["risk_tier"] == risk_tier]
        total = len(filtered)
        return filtered[offset : offset + limit], total
    else:
        total = len(_sorted_members)
        return _sorted_members[offset : offset + limit], total


def get_member_by_msno(msno: str) -> dict | None:
    """Get pre-computed member data by msno.

    Args:
        msno: Member ID

    Returns:
        Member data dict or None if not found
    """
    return _member_cache.get(msno)


def _convert_to_native(value: Any) -> Any:
    """Convert numpy/pandas types to Python native types for JSON serialization."""
    if isinstance(value, np.integer | np.int64 | np.int32):
        return int(value)
    elif isinstance(value, np.floating | np.float64 | np.float32):
        return float(value)
    elif isinstance(value, np.bool_):
        return bool(value)
    elif isinstance(value, np.ndarray):
        return value.tolist()
    elif pd.isna(value):
        return None
    return value


def get_member_features(msno: str) -> dict[str, Any] | None:
    """Get full feature values for a member.

    Args:
        msno: Member ID

    Returns:
        Dictionary of feature name -> value
    """
    member = _member_cache.get(msno)
    if member is None:
        return None

    features_df = _model_cache.get("features")
    if features_df is None:
        return None

    idx = member["idx"]
    row = features_df.iloc[idx]

    drop_cols = {"msno", "is_churn", "cutoff_ts", "window"}
    return {k: _convert_to_native(v) for k, v in row.items() if k not in drop_cols}


def load_predictions() -> pd.DataFrame:
    """Load pre-computed predictions from CSV.

    Returns:
        DataFrame with columns: msno, is_churn, xgb_pred, lgb_pred, cat_pred, stacked_pred
    """
    global _predictions_cache, _predictions_index

    if _predictions_cache is not None:
        return _predictions_cache

    predictions_path = Path(settings.PREDICTIONS_PATH)
    if not predictions_path.exists():
        logger.warning(f"Predictions file not found: {predictions_path}")
        return pd.DataFrame()

    try:
        df = pd.read_csv(predictions_path)
        _predictions_cache = df

        # Build index for O(1) lookup
        _predictions_index = {msno: idx for idx, msno in enumerate(df["msno"])}

        logger.info(f"Loaded {len(df):,} pre-computed predictions from {predictions_path}")
        return df

    except Exception as e:
        logger.error(f"Failed to load predictions: {e}")
        return pd.DataFrame()


def get_prediction_by_msno(msno: str) -> dict | None:
    """Get pre-computed prediction for a member.

    Args:
        msno: Member ID

    Returns:
        Dict with xgb_pred, lgb_pred, cat_pred, stacked_pred or None if not found
    """
    global _predictions_cache, _predictions_index

    if _predictions_cache is None:
        load_predictions()

    if _predictions_cache is None or msno not in _predictions_index:
        return None

    idx = _predictions_index[msno]
    row = _predictions_cache.iloc[idx]

    return {
        "xgb_pred": float(row["xgb_pred"]),
        "lgb_pred": float(row["lgb_pred"]),
        "cat_pred": float(row["cat_pred"]),
        "stacked_pred": float(row["stacked_pred"]),
        "is_churn": bool(row["is_churn"]) if pd.notna(row["is_churn"]) else None,
    }


def get_batch_predictions(msnos: list[str]) -> list[dict]:
    """Get predictions for multiple members efficiently.

    Args:
        msnos: List of member IDs

    Returns:
        List of prediction dicts, preserving order. Missing members have found=False.
    """
    results = []
    for msno in msnos:
        pred = get_prediction_by_msno(msno)
        if pred:
            results.append({"msno": msno, "found": True, **pred})
        else:
            results.append({"msno": msno, "found": False})
    return results


def is_predictions_loaded() -> bool:
    """Check if predictions are loaded in cache."""
    return _predictions_cache is not None and not _predictions_cache.empty
