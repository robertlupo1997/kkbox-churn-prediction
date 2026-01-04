"""Business rules service for action recommendations."""

import logging
from pathlib import Path
from typing import Any

import yaml

from api.config import settings

logger = logging.getLogger(__name__)

# Global cache for rules
_rules_cache: dict[str, Any] = {}


def load_rules() -> dict[str, Any]:
    """Load business rules from YAML file.

    Returns:
        Dictionary with business rules
    """
    if "rules" in _rules_cache:
        return _rules_cache["rules"]

    rules_path = Path(settings.RULES_PATH)
    if not rules_path.exists():
        logger.warning(f"Rules file not found: {rules_path}")
        return {}

    try:
        with open(rules_path, encoding="utf-8") as f:
            rules = yaml.safe_load(f)
        _rules_cache["rules"] = rules
        logger.info(f"Loaded business rules from {rules_path}")
        return rules

    except Exception as e:
        logger.error(f"Failed to load rules: {e}")
        return {}


def get_recommendation(score: float, top_features: list[str] | None = None) -> dict[str, Any]:
    """Get action recommendation based on churn score and risk factors.

    Args:
        score: Churn probability (0-1)
        top_features: List of top risk factors (optional)

    Returns:
        Dictionary with action recommendation details
    """
    rules = load_rules()

    # Default fallback if no rules loaded
    if not rules:
        return _get_default_recommendation(score)

    # Try to match specific rules based on top features
    if top_features and "rules" in rules:
        for rule in rules["rules"]:
            if _matches_rule(score, top_features, rule):
                return {
                    "category": rule.get("action", "engagement"),
                    "recommendation": rule.get("recommendation", ""),
                    "message": rule.get("message", ""),
                    "urgency": rule.get("urgency", "medium"),
                    "channels": rule.get("channel", ["email"]),
                }

    # Fall back to default actions by score tier
    if "default_actions" in rules:
        defaults = rules["default_actions"]

        if score > 0.7 and "high_risk_generic" in defaults:
            action = defaults["high_risk_generic"]
        elif score > 0.4 and "medium_risk_generic" in defaults:
            action = defaults["medium_risk_generic"]
        elif "low_risk_generic" in defaults:
            action = defaults["low_risk_generic"]
        else:
            return _get_default_recommendation(score)

        return {
            "category": action.get("action", "engagement"),
            "recommendation": action.get("recommendation", ""),
            "message": action.get("message", ""),
            "urgency": action.get("urgency", "medium"),
            "channels": action.get("channel", ["email"]),
        }

    return _get_default_recommendation(score)


def _matches_rule(score: float, top_features: list[str], rule: dict[str, Any]) -> bool:
    """Check if a member matches a specific rule.

    Args:
        score: Churn probability
        top_features: List of top risk factors
        rule: Rule configuration

    Returns:
        True if rule matches
    """
    condition = rule.get("condition", {})

    # Check score threshold
    score_condition = condition.get("churn_score", "")
    if score_condition:
        try:
            threshold = float(score_condition.replace(">", "").strip())
            if score <= threshold:
                return False
        except ValueError:
            pass

    # Check if top feature is in the list
    top_feature_name = condition.get("top_feature", "")
    if top_feature_name and top_feature_name not in top_features:
        return False

    return True


def _get_default_recommendation(score: float) -> dict[str, Any]:
    """Get default recommendation when no rules are available.

    Args:
        score: Churn probability

    Returns:
        Default action recommendation
    """
    if score > 0.7:
        return {
            "category": "retention_campaign",
            "recommendation": "High-priority retention campaign",
            "message": "We value your membership and want to keep you! "
            "Let's chat about how to improve your experience.",
            "urgency": "high",
            "channels": ["email", "phone"],
        }
    elif score > 0.4:
        return {
            "category": "engagement",
            "recommendation": "Engagement campaign",
            "message": "Discover new music just for you! " "Try our enhanced recommendations.",
            "urgency": "medium",
            "channels": ["email", "push_notification"],
        }
    else:
        return {
            "category": "experience",
            "recommendation": "Monitor engagement",
            "message": "Keep enjoying great music! " "Here are some new releases you might like.",
            "urgency": "low",
            "channels": ["in_app"],
        }


def get_risk_tier(score: float) -> str:
    """Map churn score to risk tier.

    Args:
        score: Churn probability (0-1)

    Returns:
        Risk tier: "High", "Medium", or "Low"
    """
    if score > 0.7:
        return "High"
    elif score > 0.4:
        return "Medium"
    else:
        return "Low"
