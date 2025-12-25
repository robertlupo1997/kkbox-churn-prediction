"""
Temporal Cross-Validation for KKBOX Churn Prediction

Implements proper time-aware validation strategies that prevent data leakage
and provide reliable performance estimates.

Key insight: Churn prediction is inherently temporal. Random splits allow
"future" information to leak into training, producing optimistic metrics.
"""

from collections.abc import Iterator
from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, clone
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score


class TemporalSplit:
    """
    Time-based train/validation split that respects temporal ordering.

    Unlike random splits, this ensures:
    1. Training data is always BEFORE validation data
    2. No temporal leakage from future to past
    3. Evaluation mimics production deployment

    Example:
        >>> splitter = TemporalSplit(train_end='2017-02-01', val_end='2017-03-01')
        >>> train_idx, val_idx = splitter.split(df, time_column='cutoff_ts')
    """

    def __init__(self, train_end: str, val_end: str | None = None, gap_days: int = 0):
        """
        Args:
            train_end: Cutoff date for training data (exclusive)
            val_end: End date for validation data (exclusive). If None, uses all remaining data.
            gap_days: Gap between train and val to prevent leakage from label construction
        """
        self.train_end = pd.to_datetime(train_end)
        self.val_end = pd.to_datetime(val_end) if val_end else None
        self.gap_days = gap_days

    def split(
        self, df: pd.DataFrame, time_column: str = "cutoff_ts"
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Split data temporally.

        Returns:
            train_idx: Indices for training set
            val_idx: Indices for validation set
        """
        times = pd.to_datetime(df[time_column])

        # Training: all data before cutoff
        train_mask = times < self.train_end

        # Validation: data after cutoff (with optional gap)
        val_start = self.train_end + timedelta(days=self.gap_days)
        if self.val_end:
            val_mask = (times >= val_start) & (times < self.val_end)
        else:
            val_mask = times >= val_start

        train_idx = np.where(train_mask)[0]
        val_idx = np.where(val_mask)[0]

        return train_idx, val_idx


class ChurnTemporalCV:
    """
    Walk-forward cross-validation for churn prediction.

    Generates multiple train/validation folds that respect temporal ordering:

    Fold 1: Train on Month 1, Validate on Month 2
    Fold 2: Train on Months 1-2, Validate on Month 3
    Fold 3: Train on Months 1-3, Validate on Month 4

    This mimics production deployment where you train on historical data
    and predict future churn.

    Usage:
        >>> cv = ChurnTemporalCV(months=['2017-01', '2017-02', '2017-03', '2017-04'])
        >>> for fold, (train_idx, val_idx) in enumerate(cv.split(df)):
        ...     X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        ...     # Train and evaluate model
    """

    def __init__(self, months: list[str], time_column: str = "cutoff_ts", expanding: bool = True):
        """
        Args:
            months: List of month strings in 'YYYY-MM' format, sorted chronologically
            time_column: Column name containing temporal information
            expanding: If True, use expanding window (train on all prior months).
                       If False, use sliding window (train only on previous month).
        """
        self.months = sorted(months)
        self.time_column = time_column
        self.expanding = expanding

    def get_n_splits(self) -> int:
        """Return number of CV folds."""
        return len(self.months) - 1

    def split(self, df: pd.DataFrame) -> Iterator[tuple[np.ndarray, np.ndarray]]:
        """
        Generate train/validation indices for each fold.

        Yields:
            train_idx, val_idx: Arrays of indices for each fold
        """
        times = pd.to_datetime(df[self.time_column])

        # Parse months to date ranges
        month_ranges = []
        for m in self.months:
            year, month = int(m[:4]), int(m[5:7])
            start = pd.Timestamp(year=year, month=month, day=1)
            if month == 12:
                end = pd.Timestamp(year=year + 1, month=1, day=1)
            else:
                end = pd.Timestamp(year=year, month=month + 1, day=1)
            month_ranges.append((start, end))

        # Generate folds
        for i in range(1, len(self.months)):
            # Validation: current month
            val_start, val_end = month_ranges[i]
            val_mask = (times >= val_start) & (times < val_end)

            # Training: all prior months (expanding) or just previous (sliding)
            if self.expanding:
                train_end = val_start
                train_mask = times < train_end
            else:
                train_start, train_end = month_ranges[i - 1]
                train_mask = (times >= train_start) & (times < train_end)

            train_idx = np.where(train_mask)[0]
            val_idx = np.where(val_mask)[0]

            if len(train_idx) == 0 or len(val_idx) == 0:
                continue

            yield train_idx, val_idx

    def get_fold_description(self) -> list[str]:
        """Return human-readable descriptions of each fold."""
        descriptions = []
        for i in range(1, len(self.months)):
            if self.expanding:
                train_months = self.months[:i]
                train_desc = "+".join(train_months)
            else:
                train_desc = self.months[i - 1]
            val_desc = self.months[i]
            descriptions.append(f"Train: {train_desc}, Val: {val_desc}")
        return descriptions


class BootstrapMetrics:
    """
    Bootstrap confidence intervals for ML metrics.

    Provides uncertainty quantification for model performance metrics,
    essential for:
    1. Understanding metric reliability
    2. Comparing models with overlapping CIs
    3. Communicating uncertainty to stakeholders

    Example:
        >>> bootstrap = BootstrapMetrics(n_bootstrap=1000)
        >>> results = bootstrap.compute(y_true, y_pred)
        >>> print(f"AUC: {results['auc']['mean']:.3f} ({results['auc']['ci_lower']:.3f}-{results['auc']['ci_upper']:.3f})")
    """

    def __init__(self, n_bootstrap: int = 1000, confidence: float = 0.95, random_state: int = 42):
        """
        Args:
            n_bootstrap: Number of bootstrap samples
            confidence: Confidence level for intervals (default 95%)
            random_state: Random seed for reproducibility
        """
        self.n_bootstrap = n_bootstrap
        self.confidence = confidence
        self.random_state = random_state
        self.alpha = (1 - confidence) / 2

    def compute(self, y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, dict[str, float]]:
        """
        Compute bootstrap confidence intervals for multiple metrics.

        Args:
            y_true: Ground truth labels (0 or 1)
            y_pred: Predicted probabilities [0, 1]

        Returns:
            Dictionary with metrics and their confidence intervals

        Raises:
            ValueError: If inputs are invalid (empty, mismatched length, or invalid values)
        """
        # Input validation
        y_true = np.asarray(y_true)
        y_pred = np.asarray(y_pred)

        if len(y_true) == 0 or len(y_pred) == 0:
            raise ValueError("Input arrays cannot be empty")

        if len(y_true) != len(y_pred):
            raise ValueError(f"Length mismatch: y_true={len(y_true)}, y_pred={len(y_pred)}")

        if not np.all((y_pred >= 0) & (y_pred <= 1)):
            raise ValueError("y_pred must contain probabilities in [0, 1]")

        if len(np.unique(y_true)) < 2:
            raise ValueError("y_true must contain at least 2 classes")

        np.random.seed(self.random_state)

        n_samples = len(y_true)

        # Storage for bootstrap samples
        metrics = {"log_loss": [], "auc": [], "brier": []}

        for _ in range(self.n_bootstrap):
            # Resample with replacement
            idx = np.random.choice(n_samples, size=n_samples, replace=True)
            y_true_boot = y_true[idx]
            y_pred_boot = y_pred[idx]

            # Skip if only one class in bootstrap sample
            if len(np.unique(y_true_boot)) < 2:
                continue

            # Compute metrics
            metrics["log_loss"].append(log_loss(y_true_boot, y_pred_boot))
            metrics["auc"].append(roc_auc_score(y_true_boot, y_pred_boot))
            metrics["brier"].append(brier_score_loss(y_true_boot, y_pred_boot))

        # Compute confidence intervals
        results = {}
        for metric_name, values in metrics.items():
            values = np.array(values)
            results[metric_name] = {
                "mean": np.mean(values),
                "std": np.std(values),
                "ci_lower": np.percentile(values, self.alpha * 100),
                "ci_upper": np.percentile(values, (1 - self.alpha) * 100),
                "n_samples": len(values),
            }

        return results

    def format_results(self, results: dict[str, dict[str, float]]) -> str:
        """Format results for display."""
        lines = ["Bootstrap Confidence Intervals:"]
        lines.append("-" * 50)
        for metric, vals in results.items():
            line = (
                f"{metric:12s}: {vals['mean']:.4f} "
                f"({vals['ci_lower']:.4f} - {vals['ci_upper']:.4f})"
            )
            lines.append(line)
        return "\n".join(lines)


def temporal_cross_val_score(
    estimator: BaseEstimator,
    X: pd.DataFrame,
    y: pd.Series,
    cv: ChurnTemporalCV,
    scoring: str = "log_loss",
    return_estimators: bool = False,
) -> dict[str, Any]:
    """
    Evaluate estimator using temporal cross-validation.

    Like sklearn's cross_val_score but designed for temporal data.

    Args:
        estimator: Scikit-learn compatible model
        X: Features (must include time column)
        y: Target variable
        cv: ChurnTemporalCV instance
        scoring: Metric to compute ('log_loss', 'auc', 'brier')
        return_estimators: Whether to return fitted estimators

    Returns:
        Dictionary with:
        - scores: List of scores per fold
        - mean_score: Average score
        - std_score: Standard deviation
        - fold_details: Per-fold information
        - estimators: (optional) Fitted estimators per fold
    """
    scores = []
    fold_details = []
    estimators = [] if return_estimators else None

    fold_descriptions = cv.get_fold_description()

    for fold_idx, (train_idx, val_idx) in enumerate(cv.split(X)):
        # Clone estimator for this fold
        model = clone(estimator)

        # Prepare data (exclude time column for training)
        drop_cols = ["msno", "is_churn", "cutoff_ts"]
        feature_cols = [c for c in X.columns if c not in drop_cols]

        X_train = X.iloc[train_idx][feature_cols].fillna(0)
        X_val = X.iloc[val_idx][feature_cols].fillna(0)
        y_train = y.iloc[train_idx]
        y_val = y.iloc[val_idx]

        # Train
        model.fit(X_train, y_train)

        # Predict
        y_pred = model.predict_proba(X_val)[:, 1]

        # Score
        if scoring == "log_loss":
            score = log_loss(y_val, y_pred)
        elif scoring == "auc":
            score = roc_auc_score(y_val, y_pred)
        elif scoring == "brier":
            score = brier_score_loss(y_val, y_pred)
        else:
            raise ValueError(f"Unknown scoring: {scoring}")

        scores.append(score)
        fold_details.append(
            {
                "fold": fold_idx,
                "description": fold_descriptions[fold_idx],
                "n_train": len(train_idx),
                "n_val": len(val_idx),
                "train_churn_rate": y_train.mean(),
                "val_churn_rate": y_val.mean(),
                "score": score,
            }
        )

        if return_estimators:
            estimators.append(model)

    result = {
        "scores": scores,
        "mean_score": np.mean(scores),
        "std_score": np.std(scores),
        "fold_details": fold_details,
    }

    if return_estimators:
        result["estimators"] = estimators

    return result


if __name__ == "__main__":
    # Demo usage
    print("Temporal CV Demo")
    print("=" * 50)

    # Create sample data
    np.random.seed(42)
    n_samples = 1000

    dates = pd.date_range("2017-01-01", "2017-04-30", periods=n_samples)
    df = pd.DataFrame(
        {
            "cutoff_ts": dates,
            "feature1": np.random.randn(n_samples),
            "feature2": np.random.randn(n_samples),
            "is_churn": np.random.binomial(1, 0.1, n_samples),
        }
    )

    # Test temporal split
    splitter = TemporalSplit(train_end="2017-03-01")
    train_idx, val_idx = splitter.split(df, "cutoff_ts")
    print(f"Temporal Split: Train={len(train_idx)}, Val={len(val_idx)}")

    # Test temporal CV
    cv = ChurnTemporalCV(months=["2017-01", "2017-02", "2017-03", "2017-04"])
    print(f"\nTemporal CV: {cv.get_n_splits()} folds")
    for desc in cv.get_fold_description():
        print(f"  {desc}")

    # Test bootstrap
    y_true = np.random.binomial(1, 0.1, 500)
    y_pred = np.random.uniform(0, 1, 500)

    bootstrap = BootstrapMetrics(n_bootstrap=100)  # Small for demo
    results = bootstrap.compute(y_true, y_pred)
    print(f"\n{bootstrap.format_results(results)}")
