"""
KKBOX Model Calibration Pipeline

Implements isotonic calibration to improve probability estimates and reliability.
Based on Platt scaling and isotonic regression for better-calibrated predictions.
"""

import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import train_test_split


class ModelCalibrator:
    """
    Model calibration with reliability improvement validation.

    Implements:
    - Isotonic regression calibration
    - Reliability diagram analysis
    - Calibration quality metrics (Brier score, ECE)
    - Before/after calibration comparison
    """

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.calibrated_models = {}
        self.calibration_metrics = {}

    def load_trained_models(self, models_dir: str) -> dict[str, Any]:
        """Load previously trained models and preprocessing objects."""
        models_path = Path(models_dir)

        models = {}
        model_files = list(models_path.glob("*.pkl"))

        for model_file in model_files:
            if model_file.name in ["feature_encoders.pkl", "scaler.pkl"]:
                continue

            model_name = model_file.stem
            with open(model_file, "rb") as f:
                models[model_name] = pickle.load(f)

        # Load preprocessing objects
        with open(models_path / "feature_encoders.pkl", "rb") as f:
            feature_encoders = pickle.load(f)

        with open(models_path / "scaler.pkl", "rb") as f:
            scaler = pickle.load(f)

        return models, feature_encoders, scaler

    def expected_calibration_error(
        self, y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
    ) -> float:
        """
        Calculate Expected Calibration Error (ECE).

        ECE measures the difference between predicted probabilities and actual outcomes
        across probability bins.
        """
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        bin_lowers = bin_boundaries[:-1]
        bin_uppers = bin_boundaries[1:]

        ece = 0
        for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
            # Find samples in this bin
            in_bin = (y_prob > bin_lower) & (y_prob <= bin_upper)
            prop_in_bin = in_bin.mean()

            if prop_in_bin > 0:
                # Calculate accuracy and confidence in this bin
                accuracy_in_bin = y_true[in_bin].mean()
                avg_confidence_in_bin = y_prob[in_bin].mean()

                # Add weighted contribution to ECE
                ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

        return ece

    def reliability_diagram_data(
        self, y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
    ) -> dict[str, np.ndarray]:
        """Generate data for reliability diagram plotting."""
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        bin_lowers = bin_boundaries[:-1]
        bin_uppers = bin_boundaries[1:]

        bin_centers = []
        bin_accuracies = []
        bin_counts = []

        for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
            in_bin = (y_prob > bin_lower) & (y_prob <= bin_upper)

            if in_bin.sum() > 0:
                bin_centers.append((bin_lower + bin_upper) / 2)
                bin_accuracies.append(y_true[in_bin].mean())
                bin_counts.append(in_bin.sum())

        return {
            "bin_centers": np.array(bin_centers),
            "bin_accuracies": np.array(bin_accuracies),
            "bin_counts": np.array(bin_counts),
        }

    def calibrate_model(
        self,
        model,
        X_cal: pd.DataFrame,
        y_cal: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        model_name: str,
    ) -> dict[str, Any]:
        """
        Apply isotonic calibration to a single model.

        Returns:
            calibration_results: Before/after metrics and calibrated model
        """
        # Get uncalibrated predictions
        if model_name == "logistic_regression":
            # Handle scaled input for logistic regression
            X_cal_processed = self.scaler.transform(X_cal) if hasattr(self, "scaler") else X_cal
            X_test_processed = self.scaler.transform(X_test) if hasattr(self, "scaler") else X_test
        else:
            X_cal_processed = X_cal
            X_test_processed = X_test

        y_prob_uncal = model.predict_proba(X_test_processed)[:, 1]
        y_prob_cal_set = model.predict_proba(X_cal_processed)[:, 1]

        # Fit isotonic calibration
        isotonic = IsotonicRegression(out_of_bounds="clip")
        isotonic.fit(y_prob_cal_set, y_cal)

        # Apply calibration
        y_prob_cal = isotonic.transform(y_prob_uncal)

        # Calculate metrics before and after calibration
        uncalibrated_metrics = {
            "log_loss": log_loss(y_test, y_prob_uncal),
            "auc": roc_auc_score(y_test, y_prob_uncal),
            "brier_score": brier_score_loss(y_test, y_prob_uncal),
            "ece": self.expected_calibration_error(y_test, y_prob_uncal),
        }

        calibrated_metrics = {
            "log_loss": log_loss(y_test, y_prob_cal),
            "auc": roc_auc_score(y_test, y_prob_cal),
            "brier_score": brier_score_loss(y_test, y_prob_cal),
            "ece": self.expected_calibration_error(y_test, y_prob_cal),
        }

        # Reliability diagram data
        uncal_reliability = self.reliability_diagram_data(y_test, y_prob_uncal)
        cal_reliability = self.reliability_diagram_data(y_test, y_prob_cal)

        results = {
            "calibrator": isotonic,
            "uncalibrated_metrics": uncalibrated_metrics,
            "calibrated_metrics": calibrated_metrics,
            "uncal_reliability": uncal_reliability,
            "cal_reliability": cal_reliability,
            "improvement": {
                "log_loss_delta": calibrated_metrics["log_loss"] - uncalibrated_metrics["log_loss"],
                "brier_delta": calibrated_metrics["brier_score"]
                - uncalibrated_metrics["brier_score"],
                "ece_delta": calibrated_metrics["ece"] - uncalibrated_metrics["ece"],
                "auc_delta": calibrated_metrics["auc"] - uncalibrated_metrics["auc"],
            },
        }

        return results

    def calibrate_all_models(self, features_path: str, models_dir: str) -> dict[str, Any]:
        """
        Calibrate all trained models and compare improvements.

        Returns:
            calibration_summary: Complete calibration results for all models
        """
        print("🔧 Loading trained models and features...")

        # Load models and features
        models, self.feature_encoders, self.scaler = self.load_trained_models(models_dir)
        df = pd.read_csv(features_path)

        # Prepare features (same as training)
        X = df.drop(["msno", "is_churn", "cutoff_ts"], axis=1, errors="ignore")
        y = df["is_churn"]

        # Handle categorical encoding
        categorical_features = ["gender", "payment_method_latest", "registered_via", "city"]
        for col in categorical_features:
            if col in X.columns and col in self.feature_encoders:
                X[col] = self.feature_encoders[col].transform(X[col].astype(str).fillna("unknown"))
        X = X.fillna(0)

        # Split into calibration and test sets
        X_cal, X_test, y_cal, y_test = train_test_split(
            X, y, test_size=0.3, random_state=self.random_state, stratify=y
        )

        print(f"📊 Calibration set: {len(X_cal)} samples")
        print(f"📊 Test set: {len(X_test)} samples")

        # Calibrate each model
        calibration_results = {}

        for model_name, model in models.items():
            print(f"🔄 Calibrating {model_name}...")

            try:
                results = self.calibrate_model(model, X_cal, y_cal, X_test, y_test, model_name)
                calibration_results[model_name] = results
                self.calibrated_models[model_name] = results["calibrator"]

                # Print improvement summary
                improvement = results["improvement"]
                print(f"  ✅ Log Loss: {improvement['log_loss_delta']:+.4f}")
                print(f"  ✅ Brier Score: {improvement['brier_delta']:+.4f}")
                print(f"  ✅ ECE: {improvement['ece_delta']:+.4f}")

            except Exception as e:
                print(f"  ❌ Failed to calibrate {model_name}: {str(e)}")
                continue

        return calibration_results

    def save_calibrated_models(self, calibration_results: dict[str, Any], output_dir: str) -> None:
        """Save calibrated models and calibration metrics."""
        output_path = Path(output_dir)

        # Save calibrators
        for model_name, results in calibration_results.items():
            calibrator_path = output_path / f"calibrator_{model_name}.pkl"
            with open(calibrator_path, "wb") as f:
                pickle.dump(results["calibrator"], f)

        # Save calibration metrics
        metrics_summary = {}
        for model_name, results in calibration_results.items():
            metrics_summary[model_name] = {
                "uncalibrated": results["uncalibrated_metrics"],
                "calibrated": results["calibrated_metrics"],
                "improvement": results["improvement"],
            }

        with open(output_path / "calibration_metrics.json", "w") as f:
            json.dump(metrics_summary, f, indent=2, default=str)

        print(f"💾 Calibrated models saved to {output_path}")


def run_calibration_pipeline(
    features_path: str = "features/features_processed.csv", models_dir: str = "models"
) -> dict[str, Any]:
    """
    Execute complete model calibration pipeline.

    Returns:
        calibration_summary: All calibration results and improvements
    """
    print("🎯 KKBOX Model Calibration Pipeline")
    print("=" * 50)

    # Initialize calibrator
    calibrator = ModelCalibrator(random_state=42)

    # Run calibration on all models
    calibration_results = calibrator.calibrate_all_models(features_path, models_dir)

    # Print summary
    print("\n📊 CALIBRATION RESULTS SUMMARY")
    print("=" * 50)
    print(f"{'Model':<20} {'Log Loss Δ':<12} {'Brier Δ':<10} {'ECE Δ':<10}")
    print("-" * 50)

    for model_name, results in calibration_results.items():
        improvement = results["improvement"]
        print(
            f"{model_name:<20} {improvement['log_loss_delta']:+8.4f}    "
            f"{improvement['brier_delta']:+6.4f}    {improvement['ece_delta']:+6.4f}"
        )

    # Find most improved model
    if calibration_results:
        best_improvement = min(
            calibration_results.items(), key=lambda x: x[1]["improvement"]["brier_delta"]
        )
        print(f"\n🏆 Most improved (Brier Score): {best_improvement[0]}")

    # Save results
    calibrator.save_calibrated_models(calibration_results, models_dir)

    # Create summary
    summary = {
        "timestamp": datetime.now().isoformat(),
        "models_calibrated": list(calibration_results.keys()),
        "best_improvement": best_improvement[0] if calibration_results else None,
        "total_improvements": len(
            [r for r in calibration_results.values() if r["improvement"]["brier_delta"] < 0]
        ),
    }

    return {"results": calibration_results, "summary": summary, "calibrator": calibrator}


if __name__ == "__main__":
    # Execute calibration pipeline
    results = run_calibration_pipeline()
    print("✅ Calibration pipeline completed!")
