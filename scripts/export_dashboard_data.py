#!/usr/bin/env python3
"""Export ML data for React dashboard.

This script transforms ML model outputs and evaluation data into JSON files
that can be consumed by the React frontend for the KKBOX churn dashboard.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent
DASHBOARD_DATA_DIR = PROJECT_ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro" / "data"


def get_feature_description(feature: str) -> str:
    """Generate human-readable description for a feature."""
    descriptions = {
        "auto_renew_ratio_30d": "Ratio of auto-renew transactions in last 30 days",
        "cancel_count_30d": "Number of cancellations in last 30 days",
        "auto_renew_ratio_60d": "Ratio of auto-renew transactions in last 60 days",
        "tx_count_60d": "Number of transactions in last 60 days",
        "latest_auto_renew": "Whether latest subscription has auto-renew enabled",
        "cancel_ratio_90d": "Ratio of cancelled transactions in last 90 days",
        "total_paid_30d": "Total amount paid in last 30 days",
        "tx_count_90d": "Number of transactions in last 90 days",
        "tenure_days": "Days since user registration",
        "active_days_30d": "Days with listening activity in last 30 days",
        "total_secs_90d": "Total listening seconds in last 90 days",
        "completion_rate_90d": "Song completion rate in last 90 days",
        "days_since_last_tx": "Days since last transaction",
        "total_paid_90d": "Total amount paid in last 90 days",
        "avg_paid_90d": "Average payment amount in last 90 days",
        "membership_days_remaining": "Days remaining in current membership",
        "cancel_count_90d": "Number of cancellations in last 90 days",
        "active_days_90d": "Days with listening activity in last 90 days",
        "total_unq_90d": "Unique songs played in last 90 days",
        "total_plays_90d": "Total song plays in last 90 days",
        "days_since_last_listen": "Days since last listening activity",
        "city": "User's city code",
        "age": "User's age",
        "gender": "User's gender",
        "registered_via": "Registration channel",
        "tx_recency_vs_plan": "Transaction recency relative to plan length",
        "transaction_count": "Total number of transactions",
        "churn_count": "Historical churn count",
        "churn_rate": "Historical churn rate",
        "expiry_urgency": "Urgency based on membership expiration",
        "autorenew_not_cancel": "Auto-renew enabled without cancellation",
        "last_trx_gt1_no_cancel": "Last transaction >1 with no cancellation",
        "activity_rate_30d": "Activity rate in last 30 days",
        "activity_rate_7d": "Activity rate in last 7 days",
    }

    if feature in descriptions:
        return descriptions[feature]

    # Auto-generate based on feature name patterns
    time_periods = {
        "90d": "in last 90 days",
        "60d": "in last 60 days",
        "30d": "in last 30 days",
        "14d": "in last 14 days",
        "7d": "in last 7 days",
    }

    metrics = {
        "tx_count": "Number of transactions",
        "cancel_count": "Number of cancellations",
        "auto_renew_ratio": "Auto-renew ratio",
        "cancel_ratio": "Cancellation ratio",
        "total_paid": "Total amount paid",
        "avg_paid": "Average payment",
        "std_paid": "Payment standard deviation",
        "active_days": "Days with activity",
        "total_secs": "Total listening time",
        "total_unq": "Unique songs played",
        "total_plays": "Total plays",
        "completion_rate": "Song completion rate",
        "early_skip_rate": "Early skip rate",
        "listening_trend": "Listening activity trend",
        "activity_density": "Activity density",
    }

    # Try to match pattern
    for period_key, period_desc in time_periods.items():
        if period_key in feature:
            for metric_key, metric_desc in metrics.items():
                if metric_key in feature:
                    return f"{metric_desc} {period_desc}"

    # Fallback: humanize the feature name
    return feature.replace("_", " ").title()


def export_feature_importance() -> list[dict[str, Any]]:
    """Export 131 features with importance scores, grouped by category."""
    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    importance = metrics["xgboost"]["feature_importance"]

    # Categorize features by keywords
    categories = {
        "transaction": [
            "tx_count",
            "cancel_count",
            "auto_renew",
            "total_paid",
            "payment",
            "discount",
            "cancel_ratio",
            "amt_per_day",
            "canc_per",
        ],
        "listening": [
            "secs",
            "active_days",
            "unq",
            "completed",
            "plays",
            "completion_rate",
            "skip",
            "song_length",
            "listening",
        ],
        "temporal": ["trend", "90d", "60d", "30d", "14d", "7d", "days_since", "recency"],
        "demographic": ["city", "age", "gender", "registered_via", "tenure"],
        "behavioral": [
            "churn",
            "last_",
            "is_churn",
            "has_cancelled",
            "usually_auto",
            "changed_payment",
        ],
    }

    features = []
    for feature, importance_score in sorted(importance.items(), key=lambda x: -x[1]):
        # Determine category
        category = "other"
        for cat, keywords in categories.items():
            if any(kw in feature.lower() for kw in keywords):
                category = cat
                break

        features.append(
            {
                "feature": feature,
                "importance": round(importance_score, 6),
                "category": category,
                "description": get_feature_description(feature),
            }
        )

    print(f"  Feature importance: {len(features)} features")
    return features


def export_model_metrics() -> list[dict[str, Any]]:
    """Export metrics for all models."""
    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    with open(PROJECT_ROOT / "models" / "calibration_metrics.json") as f:
        calibration = json.load(f)

    models = []
    model_display_names = {
        "logistic_regression": "Logistic Regression",
        "random_forest": "Random Forest",
        "xgboost": "XGBoost",
        "lightgbm": "LightGBM",
        "xgb_lgb_ensemble": "XGB+LGB Ensemble",
        "xgb_lgb_50_50": "XGB+LGB 50/50",
    }

    for name, m in metrics["models"].items():
        model_data = {
            "name": name,
            "display_name": model_display_names.get(name, name.replace("_", " ").title()),
            "auc": round(m["auc"], 4),
            "log_loss": round(m["log_loss"], 4),
            "brier": round(m["brier"], 4),
        }

        # Add calibration data if available
        if name in calibration:
            model_data["calibrated_log_loss"] = round(calibration[name]["after"]["log_loss"], 4)
            model_data["calibrated_brier"] = round(calibration[name]["after"]["brier"], 4)
            model_data["log_loss_improvement"] = round(
                calibration[name]["improvement"]["log_loss"], 4
            )

        models.append(model_data)

    print(f"  Model metrics: {len(models)} models")
    return models


def export_ensemble_weights() -> dict[str, Any]:
    """Export stacked ensemble meta-learner coefficients."""
    with open(PROJECT_ROOT / "models" / "stacked_ensemble_metrics.json") as f:
        ensemble = json.load(f)

    result = {
        "coefficients": ensemble["meta_learner_coefficients"],
        "validation_results": ensemble["validation_results"],
        "n_folds": ensemble["n_folds"],
    }

    print(f"  Ensemble weights: {len(result['coefficients'])} models")
    return result


def export_dataset_stats() -> dict[str, Any]:
    """Export dataset summary statistics."""
    with open(PROJECT_ROOT / "eval" / "dataset_summary.json") as f:
        summary = json.load(f)

    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    result = {
        "total_members": summary["total_rows"],
        "churn_rate": round(summary["total_pos_rate"] * 100, 2),
        "train_samples": metrics["train_samples"],
        "val_samples": metrics["val_samples"],
        "feature_count": metrics["feature_count"],
        "temporal_windows": metrics["train_windows"] + [metrics["val_window"]],
    }

    print(f"  Dataset stats: {result['total_members']:,} members, {result['churn_rate']}% churn")
    return result


def export_calibration_curves() -> list[dict[str, Any]]:
    """Export calibration curve data points from actual predictions."""
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if not predictions_path.exists():
        print("  Calibration curves: Predictions file not found")
        return []

    df = pd.read_csv(predictions_path)
    print(f"  Calibration curves: Processing {len(df):,} predictions")

    bins = np.linspace(0, 1, 11)
    calibration_data = []

    for model_col, display_name in [
        ("xgb_pred", "xgb"),
        ("lgb_pred", "lgb"),
        ("stacked_pred", "stacked"),
    ]:
        if model_col not in df.columns:
            continue

        df["bin"] = pd.cut(df[model_col], bins=bins, labels=False, include_lowest=True)
        grouped = (
            df.groupby("bin", observed=True)
            .agg({model_col: "mean", "is_churn": "mean"})
            .reset_index()
        )

        points = []
        for _, row in grouped.iterrows():
            if not pd.isna(row[model_col]):
                points.append(
                    {
                        "mean_predicted": round(float(row[model_col]), 4),
                        "fraction_of_positives": round(float(row["is_churn"]), 4),
                    }
                )

        calibration_data.append({"model": display_name, "points": points})

    return calibration_data


def export_risk_distribution() -> list[dict[str, Any]]:
    """Export risk score distribution from actual predictions."""
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if not predictions_path.exists():
        return []

    df = pd.read_csv(predictions_path)

    # Calculate risk distribution bins
    bins = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0]
    labels = ["0-10%", "10-20%", "20-40%", "40-60%", "60-80%", "80-100%"]
    tiers = ["Low", "Low", "Medium", "Medium", "High", "High"]

    df["risk_bin"] = pd.cut(df["stacked_pred"], bins=bins, labels=labels, include_lowest=True)
    distribution = df["risk_bin"].value_counts().sort_index()

    result = []
    for i, (label, count) in enumerate(zip(labels, distribution)):
        result.append({"range": label, "count": int(distribution.get(label, 0)), "tier": tiers[i]})

    print(f"  Risk distribution: {len(result)} bins")
    return result


def export_sample_members() -> list[dict[str, Any]]:
    """Export sample of real members for demo from predictions file."""
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if not predictions_path.exists():
        print("  Sample members: Predictions file not found")
        return []

    # Read predictions - this has actual model scores
    df = pd.read_csv(predictions_path)
    print(f"  Sample members: Processing {len(df):,} predictions")

    # Select diverse samples across risk tiers
    samples = []

    # Sort by stacked_pred to get variety
    df_sorted = df.sort_values("stacked_pred", ascending=False)

    # Get high risk (top 1%), medium risk (around 50%), and low risk (bottom 10%)
    high_risk = df_sorted.head(50)
    medium_start = len(df) // 2 - 25
    medium_risk = df_sorted.iloc[medium_start : medium_start + 50]
    low_risk = df_sorted.tail(50)

    # Also get actual churners
    churners = df[df["is_churn"] == 1].head(50)

    # Combine all samples
    sample_df = pd.concat([high_risk, medium_risk, low_risk, churners]).drop_duplicates(
        subset="msno"
    )

    for _, row in sample_df.iterrows():
        risk_score = float(row["stacked_pred"])
        risk_tier = "High" if risk_score > 0.6 else ("Medium" if risk_score > 0.2 else "Low")

        samples.append(
            {
                "msno": row["msno"][:8] + "...",  # Truncate for privacy
                "msno_full": row["msno"],  # Keep full for lookups
                "risk_score": int(risk_score * 100),
                "risk_tier": risk_tier,
                "is_churn": bool(row.get("is_churn", False)),
                "city": 1,  # Placeholder since predictions file doesn't have demographics
                "age": 0,
                "tenure_days": 0,
                "is_auto_renew": risk_score < 0.3,  # Approximate from score
                "total_secs_30d": 0,
                "active_days_30d": 0,
            }
        )

    print(f"  Sample members: {len(samples)} unique members")
    return samples


def export_temporal_performance() -> list[dict[str, Any]]:
    """Export model performance across temporal windows."""
    scores_dir = PROJECT_ROOT / "eval"
    temporal_data = []

    windows = ["2017-01-2017-02", "2017-02-2017-03", "2017-03-2017-04"]

    for window in windows:
        window_data = {"window": window, "models": {}}

        for model in ["xgb", "rf", "logreg"]:
            scores_path = scores_dir / f"scores_{window}_{model}.csv"
            if scores_path.exists():
                # Load scores and compute AUC
                try:
                    df = pd.read_csv(scores_path, nrows=100000)  # Sample for speed
                    if "is_churn" in df.columns and "score" in df.columns:
                        from sklearn.metrics import roc_auc_score

                        auc = roc_auc_score(df["is_churn"], df["score"])
                        window_data["models"][model] = {"auc": round(auc, 4), "samples": len(df)}
                    else:
                        window_data["models"][model] = {"available": True}
                except Exception as e:
                    window_data["models"][model] = {"error": str(e)}

        temporal_data.append(window_data)

    print(f"  Temporal performance: {len(temporal_data)} windows")
    return temporal_data


def export_lift_gains_data() -> dict[str, list[dict[str, Any]]]:
    """Export lift and gains curve data from predictions."""
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if not predictions_path.exists():
        return {"lift": [], "gains": []}

    df = pd.read_csv(predictions_path)
    df = df.sort_values("stacked_pred", ascending=False)

    total = len(df)
    total_positives = df["is_churn"].sum()

    # Calculate lift and gains at each decile
    lift_data = []
    gains_data = [{"percentContacted": 0, "percentCaptured": 0}]

    for pct in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
        n = int(total * pct / 100)
        subset = df.head(n)

        positives_in_subset = subset["is_churn"].sum()

        # Lift = (positives in subset / subset size) / (total positives / total size)
        expected_rate = total_positives / total
        actual_rate = positives_in_subset / n if n > 0 else 0
        lift = actual_rate / expected_rate if expected_rate > 0 else 1

        # Cumulative gains = positives captured / total positives
        cum_gain = (positives_in_subset / total_positives * 100) if total_positives > 0 else 0

        lift_data.append({"percentile": pct, "lift": round(lift, 2), "cumGain": round(cum_gain, 1)})

        gains_data.append({"percentContacted": pct, "percentCaptured": round(cum_gain, 1)})

    print(f"  Lift/gains data: {len(lift_data)} deciles")
    return {"lift": lift_data, "gains": gains_data}


def export_pr_curve_data() -> list[dict[str, Any]]:
    """Export precision-recall curve data at various thresholds."""
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if not predictions_path.exists():
        return []

    df = pd.read_csv(predictions_path)

    pr_data = []
    for threshold in [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
        predicted_positive = df["stacked_pred"] >= threshold
        actual_positive = df["is_churn"] == 1

        tp = (predicted_positive & actual_positive).sum()
        fp = (predicted_positive & ~actual_positive).sum()
        fn = (~predicted_positive & actual_positive).sum()

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        pr_data.append(
            {
                "threshold": threshold,
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1": round(f1, 3),
            }
        )

    print(f"  PR curve data: {len(pr_data)} thresholds")
    return pr_data


def main():
    """Export all dashboard data."""
    print("Exporting ML data for React dashboard...")
    print(f"Output directory: {DASHBOARD_DATA_DIR}")

    DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)

    exports = {
        "featureImportance.json": export_feature_importance(),
        "modelMetrics.json": export_model_metrics(),
        "ensembleWeights.json": export_ensemble_weights(),
        "datasetStats.json": export_dataset_stats(),
        "calibrationCurves.json": export_calibration_curves(),
        "riskDistribution.json": export_risk_distribution(),
        "sampleMembers.json": export_sample_members(),
        "liftGainsData.json": export_lift_gains_data(),
        "prCurveData.json": export_pr_curve_data(),
    }

    # Skip temporal for now (requires sklearn and is slow)
    # "temporalPerformance.json": export_temporal_performance(),

    print("\nWriting JSON files...")
    for filename, data in exports.items():
        output_path = DASHBOARD_DATA_DIR / filename
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        size_kb = output_path.stat().st_size / 1024
        print(f"  {filename}: {size_kb:.1f} KB")

    print(f"\nAll data exported to {DASHBOARD_DATA_DIR}")


if __name__ == "__main__":
    main()
