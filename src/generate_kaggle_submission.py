#!/usr/bin/env python3
"""
Generate Kaggle submission with calibrated predictions.

Uses:
- Trained LightGBM model (best performer)
- Isotonic calibration for probability correction
- Same feature pipeline as training

NOTE: This script requires test set features to be pre-generated.
The full pipeline would adapt features/features_comprehensive.sql for the test period.
For now, this demonstrates the calibration application workflow.
"""

import argparse
import pickle
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import LabelEncoder


def load_model_and_calibrator():
    """Load trained model and calibrator."""
    with open("models/lightgbm.pkl", "rb") as f:
        model = pickle.load(f)

    cal_path = "models/calibrator_lightgbm.pkl"
    if Path(cal_path).exists():
        with open(cal_path, "rb") as f:
            calibrator = pickle.load(f)
        print("   Loaded calibrator")
    else:
        calibrator = None
        print("   WARNING: No calibrator found, using raw predictions")

    return model, calibrator


def load_test_features(features_path: str):
    """
    Load pre-generated test features.

    In a full implementation, this would:
    1. Read the test user IDs from sample_submission
    2. Generate features using the same SQL pipeline as training
    3. Return feature matrix aligned with submission order
    """
    if not Path(features_path).exists():
        raise FileNotFoundError(
            f"Test features not found at {features_path}. "
            "Generate test features using the same pipeline as training."
        )

    df = pd.read_csv(features_path)

    drop_cols = ["msno", "is_churn", "cutoff_ts", "window", "is_churn_label"]
    X = df.drop([c for c in drop_cols if c in df.columns], axis=1)
    msno = df["msno"]

    # Encode categoricals (same as training)
    for col in ["gender", "most_common_payment_method", "registered_via", "city"]:
        if col in X.columns:
            X[col] = LabelEncoder().fit_transform(X[col].astype(str).fillna("unknown"))

    X = X.fillna(0)
    return X, msno


def main():
    parser = argparse.ArgumentParser(description="Generate Kaggle submission with calibrated predictions")
    parser.add_argument(
        "--features",
        default="eval/features_2017-03-2017-04.csv",
        help="Path to test features CSV (default: validation set for demo)"
    )
    parser.add_argument(
        "--sample",
        default="kkbox-churn-prediction-challenge/data/churn_comp_refresh/sample_submission_v2.csv",
        help="Path to sample submission for format reference"
    )
    parser.add_argument(
        "--out",
        default="submissions/calibrated_submission.csv",
        help="Output path for submission file"
    )
    parser.add_argument(
        "--no-calibration",
        action="store_true",
        help="Skip calibration (use raw predictions)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("KAGGLE SUBMISSION GENERATION")
    print("=" * 60)

    # Load model
    print("\n1. Loading model and calibrator...")
    model, calibrator = load_model_and_calibrator()

    if args.no_calibration:
        calibrator = None
        print("   Calibration disabled by flag")

    # Load test features
    print(f"\n2. Loading features from {args.features}...")
    try:
        X, msno = load_test_features(args.features)
        print(f"   Loaded {len(X):,} samples with {X.shape[1]} features")
    except FileNotFoundError as e:
        print(f"   ERROR: {e}")
        print("\n   To generate test features, adapt features/features_comprehensive.sql")
        print("   for the test period and run with DuckDB.")
        return

    # Generate predictions
    print("\n3. Generating predictions...")
    raw_predictions = model.predict_proba(X)[:, 1]
    print(f"   Raw prediction range: [{raw_predictions.min():.4f}, {raw_predictions.max():.4f}]")
    print(f"   Raw prediction mean: {raw_predictions.mean():.4f}")

    # Apply calibration
    if calibrator is not None:
        print("\n4. Applying calibration...")
        calibrated_predictions = calibrator.transform(raw_predictions)
        print(f"   Calibrated range: [{calibrated_predictions.min():.4f}, {calibrated_predictions.max():.4f}]")
        print(f"   Calibrated mean: {calibrated_predictions.mean():.4f}")
        final_predictions = calibrated_predictions
    else:
        print("\n4. Skipping calibration (not available)")
        final_predictions = raw_predictions

    # Create submission dataframe
    submission = pd.DataFrame({
        "msno": msno,
        "is_churn": final_predictions
    })

    # Ensure predictions are in valid range
    submission["is_churn"] = submission["is_churn"].clip(0.0, 1.0)

    # Save submission
    print(f"\n5. Saving submission to {args.out}")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    submission.to_csv(args.out, index=False)

    # Summary statistics
    print("\n" + "=" * 60)
    print("SUBMISSION SUMMARY")
    print("=" * 60)
    print(f"Total predictions: {len(submission):,}")
    print(f"Mean prediction: {submission['is_churn'].mean():.4f}")
    print(f"Median prediction: {submission['is_churn'].median():.4f}")
    print(f"Std prediction: {submission['is_churn'].std():.4f}")
    print("\nPrediction distribution:")
    print(f"  < 0.1: {(submission['is_churn'] < 0.1).sum():,} ({(submission['is_churn'] < 0.1).mean():.1%})")
    print(f"  0.1-0.5: {((submission['is_churn'] >= 0.1) & (submission['is_churn'] < 0.5)).sum():,}")
    print(f"  >= 0.5: {(submission['is_churn'] >= 0.5).sum():,} ({(submission['is_churn'] >= 0.5).mean():.1%})")
    print(f"\nSaved to: {args.out}")


if __name__ == "__main__":
    main()
