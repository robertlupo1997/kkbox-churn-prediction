"""
Calibration Visualization Script
Creates before/after reliability diagrams and calibration curves

Run: python scripts/visualize_calibration.py
Output: saves PNG files to eval/ directory
"""

import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def load_data_and_models():
    """Load features, models, and calibrators."""
    print("Loading data and models...")

    # Load features
    features_path = Path("features/features_comprehensive.csv")
    if not features_path.exists():
        features_path = Path("features/features_processed.csv")

    df = pd.read_csv(features_path)
    print(f"  Loaded {len(df):,} samples")

    # Prepare features
    X = df.drop(["msno", "is_churn", "cutoff_ts"], axis=1, errors="ignore")
    y = df["is_churn"].values

    # Handle categorical encoding if needed
    if "gender" in X.columns and X["gender"].dtype == "object":
        gender_map = {"male": 0, "female": 1, "unknown": 2}
        X["gender"] = X["gender"].map(gender_map).fillna(2)

    X = X.fillna(0)

    # Load XGBoost model
    models_dir = Path("models")

    try:
        import xgboost as xgb

        xgb_path = models_dir / "xgboost.json"
        if xgb_path.exists():
            model = xgb.XGBClassifier()
            model.load_model(str(xgb_path))
            print("  Loaded XGBoost model (JSON)")
        else:
            with open(models_dir / "xgboost.pkl", "rb") as f:
                model = pickle.load(f)
            print("  Loaded XGBoost model (pickle)")
    except Exception as e:
        print(f"  Error loading model: {e}")
        return None, None, None, None

    # Load calibrator
    calibrator_path = models_dir / "calibrator_xgboost.pkl"
    if calibrator_path.exists():
        with open(calibrator_path, "rb") as f:
            calibrator = pickle.load(f)
        print("  Loaded calibrator")
    else:
        calibrator = None
        print("  No calibrator found")

    return X, y, model, calibrator


def compute_calibration_data(y_true, y_prob, n_bins=10):
    """Compute calibration curve data manually for more control."""
    bin_edges = np.linspace(0, 1, n_bins + 1)
    bin_centers = []
    bin_accuracies = []
    bin_counts = []
    bin_avg_predictions = []

    for i in range(n_bins):
        mask = (y_prob > bin_edges[i]) & (y_prob <= bin_edges[i + 1])
        if mask.sum() > 0:
            bin_centers.append((bin_edges[i] + bin_edges[i + 1]) / 2)
            bin_accuracies.append(y_true[mask].mean())
            bin_counts.append(mask.sum())
            bin_avg_predictions.append(y_prob[mask].mean())

    return {
        "centers": np.array(bin_centers),
        "accuracies": np.array(bin_accuracies),
        "counts": np.array(bin_counts),
        "avg_predictions": np.array(bin_avg_predictions),
    }


def plot_reliability_diagram(y_true, y_prob_uncal, y_prob_cal, save_path):
    """
    Create a professional reliability diagram showing before/after calibration.
    """
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # =========================================================================
    # Plot 1: Before Calibration
    # =========================================================================
    ax1 = axes[0]

    # Compute calibration curve
    uncal_data = compute_calibration_data(y_true, y_prob_uncal, n_bins=10)

    # Perfect calibration line
    ax1.plot([0, 1], [0, 1], "k--", label="Perfect calibration", linewidth=2)

    # Actual calibration curve
    ax1.plot(
        uncal_data["avg_predictions"],
        uncal_data["accuracies"],
        "s-",
        color="#e74c3c",
        markersize=10,
        linewidth=2,
        label="XGBoost (uncalibrated)",
    )

    # Fill the gap to show error
    ax1.fill_between(
        uncal_data["avg_predictions"],
        uncal_data["avg_predictions"],
        uncal_data["accuracies"],
        alpha=0.3,
        color="#e74c3c",
    )

    ax1.set_xlabel("Mean Predicted Probability", fontsize=12)
    ax1.set_ylabel("Fraction of Positives (Actual)", fontsize=12)
    ax1.set_title("BEFORE Calibration", fontsize=14, fontweight="bold")
    ax1.legend(loc="upper left")
    ax1.set_xlim([0, 1])
    ax1.set_ylim([0, 1])
    ax1.grid(True, alpha=0.3)

    # Add ECE annotation
    ece_uncal = np.average(
        np.abs(uncal_data["avg_predictions"] - uncal_data["accuracies"]),
        weights=uncal_data["counts"],
    )
    ax1.annotate(
        f"ECE = {ece_uncal:.3f}",
        xy=(0.05, 0.95),
        fontsize=12,
        fontweight="bold",
        color="#e74c3c",
    )

    # =========================================================================
    # Plot 2: After Calibration
    # =========================================================================
    ax2 = axes[1]

    cal_data = compute_calibration_data(y_true, y_prob_cal, n_bins=10)

    ax2.plot([0, 1], [0, 1], "k--", label="Perfect calibration", linewidth=2)
    ax2.plot(
        cal_data["avg_predictions"],
        cal_data["accuracies"],
        "o-",
        color="#27ae60",
        markersize=10,
        linewidth=2,
        label="XGBoost (calibrated)",
    )

    ax2.fill_between(
        cal_data["avg_predictions"],
        cal_data["avg_predictions"],
        cal_data["accuracies"],
        alpha=0.3,
        color="#27ae60",
    )

    ax2.set_xlabel("Mean Predicted Probability", fontsize=12)
    ax2.set_ylabel("Fraction of Positives (Actual)", fontsize=12)
    ax2.set_title("AFTER Calibration", fontsize=14, fontweight="bold")
    ax2.legend(loc="upper left")
    ax2.set_xlim([0, 1])
    ax2.set_ylim([0, 1])
    ax2.grid(True, alpha=0.3)

    ece_cal = np.average(
        np.abs(cal_data["avg_predictions"] - cal_data["accuracies"]),
        weights=cal_data["counts"],
    )
    ax2.annotate(
        f"ECE = {ece_cal:.3f}",
        xy=(0.05, 0.95),
        fontsize=12,
        fontweight="bold",
        color="#27ae60",
    )

    # =========================================================================
    # Plot 3: Comparison Overlay
    # =========================================================================
    ax3 = axes[2]

    ax3.plot([0, 1], [0, 1], "k--", label="Perfect", linewidth=2)
    ax3.plot(
        uncal_data["avg_predictions"],
        uncal_data["accuracies"],
        "s--",
        color="#e74c3c",
        markersize=8,
        linewidth=2,
        alpha=0.7,
        label=f"Before (ECE={ece_uncal:.3f})",
    )
    ax3.plot(
        cal_data["avg_predictions"],
        cal_data["accuracies"],
        "o-",
        color="#27ae60",
        markersize=8,
        linewidth=2,
        label=f"After (ECE={ece_cal:.3f})",
    )

    ax3.set_xlabel("Mean Predicted Probability", fontsize=12)
    ax3.set_ylabel("Fraction of Positives (Actual)", fontsize=12)
    ax3.set_title("Calibration Comparison", fontsize=14, fontweight="bold")
    ax3.legend(loc="upper left")
    ax3.set_xlim([0, 1])
    ax3.set_ylim([0, 1])
    ax3.grid(True, alpha=0.3)

    # Add improvement annotation
    improvement = (ece_uncal - ece_cal) / ece_uncal * 100
    ax3.annotate(
        f"{improvement:.0f}% improvement!",
        xy=(0.6, 0.15),
        fontsize=14,
        fontweight="bold",
        color="#27ae60",
    )

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    print(f"Saved: {save_path}")
    plt.close()


def plot_probability_distributions(y_true, y_prob_uncal, y_prob_cal, save_path):
    """
    Show how probability distributions change after calibration.
    """
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))

    # =========================================================================
    # Plot 1: Uncalibrated distribution by actual outcome
    # =========================================================================
    ax1 = axes[0, 0]

    churned_uncal = y_prob_uncal[y_true == 1]
    stayed_uncal = y_prob_uncal[y_true == 0]

    ax1.hist(
        stayed_uncal, bins=50, alpha=0.6, label="Actually Stayed", color="#3498db", density=True
    )
    ax1.hist(
        churned_uncal, bins=50, alpha=0.6, label="Actually Churned", color="#e74c3c", density=True
    )
    ax1.set_xlabel("Predicted Probability")
    ax1.set_ylabel("Density")
    ax1.set_title("BEFORE Calibration: Predictions by Outcome")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # =========================================================================
    # Plot 2: Calibrated distribution by actual outcome
    # =========================================================================
    ax2 = axes[0, 1]

    churned_cal = y_prob_cal[y_true == 1]
    stayed_cal = y_prob_cal[y_true == 0]

    ax2.hist(stayed_cal, bins=50, alpha=0.6, label="Actually Stayed", color="#3498db", density=True)
    ax2.hist(
        churned_cal, bins=50, alpha=0.6, label="Actually Churned", color="#e74c3c", density=True
    )
    ax2.set_xlabel("Predicted Probability")
    ax2.set_ylabel("Density")
    ax2.set_title("AFTER Calibration: Predictions by Outcome")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    # =========================================================================
    # Plot 3: Before vs After scatter
    # =========================================================================
    ax3 = axes[1, 0]

    # Sample for visibility
    sample_idx = np.random.choice(len(y_prob_uncal), min(5000, len(y_prob_uncal)), replace=False)

    ax3.scatter(
        y_prob_uncal[sample_idx],
        y_prob_cal[sample_idx],
        alpha=0.3,
        s=10,
        c=y_true[sample_idx],
        cmap="RdYlGn_r",
    )
    ax3.plot([0, 1], [0, 1], "k--", linewidth=2, label="No change")
    ax3.set_xlabel("Uncalibrated Probability")
    ax3.set_ylabel("Calibrated Probability")
    ax3.set_title("Calibration Transformation")
    ax3.legend()
    ax3.grid(True, alpha=0.3)

    # Add annotation
    above_line = (y_prob_cal > y_prob_uncal).mean() * 100
    below_line = (y_prob_cal < y_prob_uncal).mean() * 100
    ax3.annotate(
        f"{above_line:.0f}% moved UP\n(more confident)",
        xy=(0.3, 0.7),
        fontsize=10,
        color="#27ae60",
    )
    ax3.annotate(
        f"{below_line:.0f}% moved DOWN\n(less confident)",
        xy=(0.7, 0.3),
        fontsize=10,
        color="#e74c3c",
    )

    # =========================================================================
    # Plot 4: Metrics comparison
    # =========================================================================
    ax4 = axes[1, 1]

    metrics = {
        "Log Loss": [log_loss(y_true, y_prob_uncal), log_loss(y_true, y_prob_cal)],
        "Brier Score": [
            brier_score_loss(y_true, y_prob_uncal),
            brier_score_loss(y_true, y_prob_cal),
        ],
    }

    x = np.arange(len(metrics))
    width = 0.35

    before_vals = [m[0] for m in metrics.values()]
    after_vals = [m[1] for m in metrics.values()]

    bars1 = ax4.bar(x - width / 2, before_vals, width, label="Before", color="#e74c3c", alpha=0.8)
    bars2 = ax4.bar(x + width / 2, after_vals, width, label="After", color="#27ae60", alpha=0.8)

    ax4.set_ylabel("Score (lower is better)")
    ax4.set_title("Metrics Improvement")
    ax4.set_xticks(x)
    ax4.set_xticklabels(metrics.keys())
    ax4.legend()
    ax4.grid(True, alpha=0.3, axis="y")

    # Add value labels
    for bar, val in zip(bars1, before_vals):
        ax4.annotate(
            f"{val:.3f}",
            xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
            ha="center",
            va="bottom",
            fontsize=10,
        )
    for bar, val in zip(bars2, after_vals):
        ax4.annotate(
            f"{val:.3f}",
            xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
            ha="center",
            va="bottom",
            fontsize=10,
        )

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    print(f"Saved: {save_path}")
    plt.close()


def plot_isotonic_mapping(y_prob_uncal, calibrator, save_path):
    """
    Visualize the isotonic regression mapping function.
    """
    fig, ax = plt.subplots(figsize=(10, 6))

    # Generate smooth range of inputs
    x_range = np.linspace(0.01, 0.99, 500)
    y_calibrated = calibrator.transform(x_range)

    # Plot the mapping
    ax.plot(x_range, y_calibrated, color="#9b59b6", linewidth=3, label="Isotonic mapping")
    ax.plot([0, 1], [0, 1], "k--", linewidth=2, label="Identity (no change)")

    # Fill regions
    ax.fill_between(
        x_range,
        x_range,
        y_calibrated,
        where=(y_calibrated < x_range),
        alpha=0.3,
        color="#e74c3c",
        label="Reduced confidence",
    )
    ax.fill_between(
        x_range,
        x_range,
        y_calibrated,
        where=(y_calibrated > x_range),
        alpha=0.3,
        color="#27ae60",
        label="Increased confidence",
    )

    ax.set_xlabel("Raw Model Probability", fontsize=12)
    ax.set_ylabel("Calibrated Probability", fontsize=12)
    ax.set_title("Isotonic Calibration Mapping Function", fontsize=14, fontweight="bold")
    ax.legend(loc="upper left")
    ax.grid(True, alpha=0.3)
    ax.set_xlim([0, 1])
    ax.set_ylim([0, 1])

    # Add example annotations
    examples = [(0.8, "High confidence"), (0.5, "Medium confidence"), (0.2, "Low confidence")]
    for raw, label in examples:
        cal = calibrator.transform([raw])[0]
        ax.annotate(
            f"{raw:.0%} -> {cal:.0%}",
            xy=(raw, cal),
            xytext=(raw + 0.1, cal - 0.1),
            fontsize=10,
            arrowprops=dict(arrowstyle="->", color="gray"),
        )

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    print(f"Saved: {save_path}")
    plt.close()


def main():
    """Generate all calibration visualizations."""
    print("=" * 60)
    print("CALIBRATION VISUALIZATION")
    print("=" * 60)

    # Create output directory
    output_dir = Path("eval")
    output_dir.mkdir(exist_ok=True)

    # Load data
    X, y, model, calibrator = load_data_and_models()

    if model is None:
        print("ERROR: Could not load model. Run train_models.py first.")
        return

    # Get predictions
    print("\nGenerating predictions...")
    y_prob_uncal = model.predict_proba(X)[:, 1]

    if calibrator is not None:
        y_prob_cal = calibrator.transform(y_prob_uncal)
    else:
        print("WARNING: No calibrator found. Using uncalibrated predictions for both.")
        y_prob_cal = y_prob_uncal

    print(f"  Uncalibrated range: [{y_prob_uncal.min():.3f}, {y_prob_uncal.max():.3f}]")
    print(f"  Calibrated range: [{y_prob_cal.min():.3f}, {y_prob_cal.max():.3f}]")

    # Generate visualizations
    print("\nGenerating visualizations...")

    plot_reliability_diagram(
        y, y_prob_uncal, y_prob_cal, output_dir / "calibration_reliability_diagram.png"
    )

    plot_probability_distributions(
        y, y_prob_uncal, y_prob_cal, output_dir / "calibration_distributions.png"
    )

    if calibrator is not None:
        plot_isotonic_mapping(
            y_prob_uncal, calibrator, output_dir / "calibration_isotonic_mapping.png"
        )

    print("\n" + "=" * 60)
    print("VISUALIZATION COMPLETE")
    print("=" * 60)
    print(f"\nFiles saved to {output_dir}/:")
    print("  - calibration_reliability_diagram.png")
    print("  - calibration_distributions.png")
    print("  - calibration_isotonic_mapping.png")


if __name__ == "__main__":
    main()
