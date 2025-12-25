"""
Error Analysis Module for KKBOX Churn Prediction

Provides tools to understand WHERE and WHY the model fails, not just
aggregate metrics. This is essential for:
1. Debugging model performance issues
2. Identifying high-risk segments
3. Communicating model limitations to stakeholders
4. Guiding feature engineering efforts

Key insight: A model with 0.70 AUC might be 0.90 on some segments and 0.50
on others. Understanding these patterns is more valuable than the aggregate.
"""

import warnings
from collections import defaultdict
from typing import Any

import numpy as np
import pandas as pd


class ChurnErrorAnalyzer:
    """
    Comprehensive error analysis for churn prediction models.

    Analyzes model errors across multiple dimensions:
    - Feature-based segmentation (where does model struggle?)
    - Confidence calibration (is high confidence accurate?)
    - Error patterns (false positives vs false negatives)
    - Business impact (cost of different error types)

    Example:
        >>> analyzer = ChurnErrorAnalyzer(fp_cost=10, fn_cost=50)
        >>> report = analyzer.analyze(y_true, y_pred, features_df)
        >>> analyzer.print_report(report)
    """

    def __init__(self, threshold: float = 0.5, fp_cost: float = 10.0, fn_cost: float = 50.0):
        """
        Args:
            threshold: Decision threshold for classification
            fp_cost: Business cost of false positive (wasted retention spend)
            fn_cost: Business cost of false negative (lost customer LTV)
        """
        self.threshold = threshold
        self.fp_cost = fp_cost
        self.fn_cost = fn_cost

    def analyze(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        features_df: pd.DataFrame,
        feature_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Perform comprehensive error analysis.

        Args:
            y_true: Ground truth labels (0/1)
            y_pred: Predicted probabilities [0,1]
            features_df: Feature dataframe (same order as y_true/y_pred)
            feature_names: Columns to analyze. If None, uses all numeric columns.

        Returns:
            Dictionary containing analysis results

        Raises:
            ValueError: If inputs are invalid
        """
        # Convert to numpy if needed
        y_true = np.asarray(y_true)
        y_pred = np.asarray(y_pred)

        # Input validation
        if len(y_true) == 0 or len(y_pred) == 0:
            raise ValueError("Input arrays cannot be empty")

        if len(y_true) != len(y_pred):
            raise ValueError(f"Length mismatch: y_true={len(y_true)}, y_pred={len(y_pred)}")

        if len(features_df) != len(y_true):
            raise ValueError(
                f"features_df length ({len(features_df)}) must match y_true ({len(y_true)})"
            )

        # Get predictions at threshold
        y_pred_binary = (y_pred >= self.threshold).astype(int)

        # Basic classification
        correct = y_pred_binary == y_true
        tp = (y_pred_binary == 1) & (y_true == 1)
        tn = (y_pred_binary == 0) & (y_true == 0)
        fp = (y_pred_binary == 1) & (y_true == 0)
        fn = (y_pred_binary == 0) & (y_true == 1)

        # Determine features to analyze
        if feature_names is None:
            feature_names = [
                col
                for col in features_df.columns
                if features_df[col].dtype in ["int64", "float64"]
                and col not in ["msno", "is_churn", "cutoff_ts"]
            ]

        # Build results
        results = {
            "summary": self._compute_summary(
                y_true, y_pred, y_pred_binary, correct, tp, tn, fp, fn
            ),
            "confidence_analysis": self._analyze_confidence(y_true, y_pred, correct),
            "segment_analysis": self._analyze_segments(
                y_true, y_pred, correct, features_df, feature_names
            ),
            "hardest_examples": self._find_hardest_examples(y_true, y_pred, features_df),
            "business_impact": self._compute_business_impact(tp, tn, fp, fn),
            "recommendations": self._generate_recommendations(
                y_true, y_pred, correct, features_df, feature_names
            ),
        }

        return results

    def _compute_summary(
        self, y_true, y_pred, y_pred_binary, correct, tp, tn, fp, fn
    ) -> dict[str, Any]:
        """Compute summary statistics."""
        n = len(y_true)

        return {
            "n_samples": n,
            "accuracy": correct.mean(),
            "base_rate": y_true.mean(),
            "prediction_rate": y_pred_binary.mean(),
            "mean_prediction": y_pred.mean(),
            "confusion_matrix": {
                "true_positives": int(tp.sum()),
                "true_negatives": int(tn.sum()),
                "false_positives": int(fp.sum()),
                "false_negatives": int(fn.sum()),
            },
            "rates": {
                "precision": tp.sum() / (tp.sum() + fp.sum()) if (tp.sum() + fp.sum()) > 0 else 0,
                "recall": tp.sum() / (tp.sum() + fn.sum()) if (tp.sum() + fn.sum()) > 0 else 0,
                "specificity": tn.sum() / (tn.sum() + fp.sum()) if (tn.sum() + fp.sum()) > 0 else 0,
                "fpr": fp.sum() / (fp.sum() + tn.sum()) if (fp.sum() + tn.sum()) > 0 else 0,
                "fnr": fn.sum() / (fn.sum() + tp.sum()) if (fn.sum() + tp.sum()) > 0 else 0,
            },
        }

    def _analyze_confidence(self, y_true, y_pred, correct) -> dict[str, Any]:
        """Analyze prediction confidence vs accuracy."""
        # Bin predictions by confidence
        bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        bin_results = []

        for i in range(len(bins) - 1):
            mask = (y_pred >= bins[i]) & (y_pred < bins[i + 1])
            if mask.sum() == 0:
                continue

            bin_results.append(
                {
                    "bin": f"{bins[i]:.1f}-{bins[i+1]:.1f}",
                    "n_samples": int(mask.sum()),
                    "mean_confidence": float(y_pred[mask].mean()),
                    "actual_rate": float(y_true[mask].mean()),
                    "accuracy": float(correct[mask].mean()),
                    "calibration_error": abs(y_pred[mask].mean() - y_true[mask].mean()),
                }
            )

        # High confidence errors (most concerning)
        high_conf_wrong = (y_pred >= 0.8) & ~correct
        low_conf_wrong = (y_pred >= 0.2) & (y_pred < 0.8) & ~correct

        return {
            "bins": bin_results,
            "high_confidence_errors": {
                "count": int(high_conf_wrong.sum()),
                "rate": float(high_conf_wrong.sum() / len(y_true)),
                "concern": "These predictions were confident but wrong",
            },
            "uncertain_errors": {
                "count": int(low_conf_wrong.sum()),
                "rate": float(low_conf_wrong.sum() / len(y_true)),
                "note": "Model was appropriately uncertain",
            },
        }

    def _analyze_segments(
        self, y_true, y_pred, correct, features_df, feature_names
    ) -> dict[str, list[dict]]:
        """Analyze accuracy across feature segments."""
        segment_results = {}

        for feature in feature_names:
            if feature not in features_df.columns:
                continue

            values = features_df[feature].values

            # Skip if too many unique values (likely continuous ID)
            if len(np.unique(values)) > 50:
                # Bin continuous features
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        bins = pd.qcut(values, q=5, duplicates="drop")
                    bin_labels = bins.astype(str)
                except:
                    continue
            else:
                bin_labels = values.astype(str)

            # Group by bin
            groups = defaultdict(list)
            for i, label in enumerate(bin_labels):
                groups[label].append(i)

            feature_results = []
            for label, indices in groups.items():
                indices = np.array(indices)
                if len(indices) < 10:  # Skip tiny groups
                    continue

                feature_results.append(
                    {
                        "segment": str(label),
                        "n_samples": len(indices),
                        "accuracy": float(correct[indices].mean()),
                        "mean_pred": float(y_pred[indices].mean()),
                        "actual_rate": float(y_true[indices].mean()),
                        "error_rate": float(1 - correct[indices].mean()),
                    }
                )

            # Sort by accuracy (worst first)
            feature_results.sort(key=lambda x: x["accuracy"])
            segment_results[feature] = feature_results

        return segment_results

    def _find_hardest_examples(
        self, y_true, y_pred, features_df, n_examples: int = 20
    ) -> dict[str, pd.DataFrame]:
        """Find examples where model was most wrong."""
        # Error magnitude: how wrong was the prediction?
        error = np.abs(y_true - y_pred)

        # High confidence wrong (most concerning)
        confidence = np.maximum(y_pred, 1 - y_pred)
        confidence_when_wrong = confidence * (y_pred.round() != y_true)

        results_df = features_df.copy()
        results_df["y_true"] = y_true
        results_df["y_pred"] = y_pred
        results_df["y_pred_binary"] = (y_pred >= self.threshold).astype(int)
        results_df["error"] = error
        results_df["confidence"] = confidence
        results_df["confidence_when_wrong"] = confidence_when_wrong

        # False negatives (missed churners - high business cost)
        fn_mask = (results_df["y_pred_binary"] == 0) & (results_df["y_true"] == 1)
        false_negatives = results_df[fn_mask].nlargest(n_examples, "y_pred")

        # False positives (wasted retention spend)
        fp_mask = (results_df["y_pred_binary"] == 1) & (results_df["y_true"] == 0)
        false_positives = results_df[fp_mask].nlargest(n_examples, "y_pred")

        # Highest confidence errors
        wrong = results_df["y_pred_binary"] != results_df["y_true"]
        high_conf_errors = results_df[wrong].nlargest(n_examples, "confidence_when_wrong")

        return {
            "false_negatives": false_negatives,
            "false_positives": false_positives,
            "high_confidence_errors": high_conf_errors,
        }

    def _compute_business_impact(self, tp, tn, fp, fn) -> dict[str, float]:
        """Compute business cost of errors."""
        fp_cost_total = fp.sum() * self.fp_cost
        fn_cost_total = fn.sum() * self.fn_cost
        total_cost = fp_cost_total + fn_cost_total

        # Cost if we predicted everyone as churner (catch all churners)
        all_positive_cost = (tp.sum() + tn.sum()) * self.fp_cost

        # Cost if we predicted no one as churner (miss all churners)
        all_negative_cost = (tp.sum() + fn.sum()) * self.fn_cost

        return {
            "fp_cost_per_error": self.fp_cost,
            "fn_cost_per_error": self.fn_cost,
            "total_fp_cost": float(fp_cost_total),
            "total_fn_cost": float(fn_cost_total),
            "total_cost": float(total_cost),
            "cost_vs_all_positive": (
                float(total_cost / all_positive_cost) if all_positive_cost > 0 else 0
            ),
            "cost_vs_all_negative": (
                float(total_cost / all_negative_cost) if all_negative_cost > 0 else 0
            ),
            "savings_vs_baseline": float(min(all_positive_cost, all_negative_cost) - total_cost),
        }

    def _generate_recommendations(
        self, y_true, y_pred, correct, features_df, feature_names
    ) -> list[str]:
        """Generate actionable recommendations."""
        recommendations = []

        # Check calibration
        calibration_error = abs(y_pred.mean() - y_true.mean())
        if calibration_error > 0.05:
            recommendations.append(
                f"Model is poorly calibrated (predicted {y_pred.mean():.2%} vs actual {y_true.mean():.2%}). "
                "Consider isotonic calibration or Platt scaling."
            )

        # Check class imbalance handling
        if y_true.mean() < 0.1:
            recall = ((y_pred >= self.threshold) & (y_true == 1)).sum() / y_true.sum()
            if recall < 0.5:
                recommendations.append(
                    f"Low recall ({recall:.2%}) on minority class. "
                    "Consider adjusting threshold, using class weights, or oversampling."
                )

        # Check for segment-specific issues
        for feature in feature_names[:5]:  # Check top 5 features
            if feature not in features_df.columns:
                continue

            # Simple segment check
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    quartiles = pd.qcut(features_df[feature], q=4, duplicates="drop")
                    segment_acc = pd.Series(correct).groupby(quartiles).mean()

                    if segment_acc.max() - segment_acc.min() > 0.15:
                        worst_segment = segment_acc.idxmin()
                        recommendations.append(
                            f"Model struggles with {feature} segment '{worst_segment}' "
                            f"(accuracy: {segment_acc.min():.2%} vs avg {correct.mean():.2%}). "
                            "Consider segment-specific features or models."
                        )
            except:
                continue

        # Check for high confidence errors
        high_conf_wrong = (y_pred >= 0.8) & (y_pred.round() != y_true)
        if high_conf_wrong.mean() > 0.05:
            recommendations.append(
                f"{high_conf_wrong.sum()} predictions were >80% confident but wrong. "
                "Investigate these examples to understand failure modes."
            )

        if not recommendations:
            recommendations.append(
                "No major issues detected. Consider hyperparameter tuning for incremental gains."
            )

        return recommendations

    def print_report(self, results: dict[str, Any], verbose: bool = True):
        """Print formatted error analysis report."""
        print("\n" + "=" * 70)
        print("CHURN MODEL ERROR ANALYSIS REPORT")
        print("=" * 70)

        # Summary
        summary = results["summary"]
        print("\n--- SUMMARY ---")
        print(f"Samples: {summary['n_samples']:,}")
        print(f"Accuracy: {summary['accuracy']:.2%}")
        print(f"Base churn rate: {summary['base_rate']:.2%}")
        print(f"Predicted churn rate: {summary['prediction_rate']:.2%}")

        # Confusion matrix
        cm = summary["confusion_matrix"]
        print("\n--- CONFUSION MATRIX ---")
        print("             Predicted No | Predicted Yes")
        print(f"Actual No    {cm['true_negatives']:>10,}    | {cm['false_positives']:>10,}")
        print(f"Actual Yes   {cm['false_negatives']:>10,}    | {cm['true_positives']:>10,}")

        # Rates
        rates = summary["rates"]
        print("\n--- CLASSIFICATION RATES ---")
        print(f"Precision: {rates['precision']:.2%}")
        print(f"Recall: {rates['recall']:.2%}")
        print(f"Specificity: {rates['specificity']:.2%}")
        print(f"False Positive Rate: {rates['fpr']:.2%}")
        print(f"False Negative Rate: {rates['fnr']:.2%}")

        # Business impact
        impact = results["business_impact"]
        print("\n--- BUSINESS IMPACT ---")
        print(f"Cost per FP: ${impact['fp_cost_per_error']:.0f} (wasted retention spend)")
        print(f"Cost per FN: ${impact['fn_cost_per_error']:.0f} (lost customer)")
        print(f"Total FP cost: ${impact['total_fp_cost']:,.0f}")
        print(f"Total FN cost: ${impact['total_fn_cost']:,.0f}")
        print(f"Total cost: ${impact['total_cost']:,.0f}")
        print(f"Savings vs no-model baseline: ${impact['savings_vs_baseline']:,.0f}")

        # Confidence analysis
        conf = results["confidence_analysis"]
        print("\n--- CONFIDENCE ANALYSIS ---")
        print(f"High confidence errors (>=80%): {conf['high_confidence_errors']['count']}")
        print(f"Uncertain errors (20-80%): {conf['uncertain_errors']['count']}")

        if verbose:
            print("\nCalibration by confidence bin:")
            for bin_info in conf["bins"]:
                print(
                    f"  {bin_info['bin']}: {bin_info['n_samples']:>5} samples, "
                    f"pred={bin_info['mean_confidence']:.2f}, actual={bin_info['actual_rate']:.2f}, "
                    f"accuracy={bin_info['accuracy']:.2%}"
                )

        # Segment analysis (top struggling segments)
        print("\n--- SEGMENTS WITH LOWEST ACCURACY ---")
        segment_analysis = results["segment_analysis"]
        shown = 0
        for feature, segments in segment_analysis.items():
            if shown >= 5:
                break
            if segments and segments[0]["accuracy"] < summary["accuracy"] - 0.05:
                worst = segments[0]
                print(
                    f"  {feature}='{worst['segment']}': {worst['accuracy']:.2%} accuracy "
                    f"({worst['n_samples']} samples)"
                )
                shown += 1

        # Recommendations
        print("\n--- RECOMMENDATIONS ---")
        for i, rec in enumerate(results["recommendations"], 1):
            print(f"{i}. {rec}")

        print("\n" + "=" * 70)


def run_error_analysis(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    features_df: pd.DataFrame,
    threshold: float = 0.5,
    fp_cost: float = 10.0,
    fn_cost: float = 50.0,
) -> dict[str, Any]:
    """
    Convenience function to run error analysis.

    Args:
        y_true: Ground truth labels
        y_pred: Predicted probabilities
        features_df: Feature dataframe
        threshold: Classification threshold
        fp_cost: Cost of false positive
        fn_cost: Cost of false negative

    Returns:
        Analysis results dictionary
    """
    analyzer = ChurnErrorAnalyzer(threshold=threshold, fp_cost=fp_cost, fn_cost=fn_cost)
    results = analyzer.analyze(y_true, y_pred, features_df)
    analyzer.print_report(results)
    return results


if __name__ == "__main__":
    # Demo with synthetic data
    np.random.seed(42)
    n = 1000

    # Create synthetic features
    features_df = pd.DataFrame(
        {
            "msno": [f"user_{i}" for i in range(n)],
            "logs_30d": np.random.exponential(10, n),
            "secs_30d": np.random.exponential(5000, n),
            "tx_count_total": np.random.poisson(3, n),
            "plan_days_latest": np.random.choice([30, 90, 180, 365], n),
            "age": np.random.normal(30, 10, n).clip(18, 65),
            "gender": np.random.choice(["male", "female", "unknown"], n),
        }
    )

    # Synthetic labels (correlated with features)
    churn_prob = 0.1 + 0.3 * (features_df["logs_30d"] < 5).astype(float)
    y_true = np.random.binomial(1, churn_prob)

    # Synthetic predictions (imperfect model)
    y_pred = churn_prob + np.random.normal(0, 0.15, n)
    y_pred = np.clip(y_pred, 0.01, 0.99)

    # Run analysis
    results = run_error_analysis(y_true, y_pred, features_df)
