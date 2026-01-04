#!/usr/bin/env python3
"""
Run comprehensive error analysis on the trained churn model.

This script:
1. Loads validation data and model
2. Generates predictions (with optional calibration)
3. Runs the error analysis module
4. Outputs detailed report on model weaknesses
"""

import argparse
import pickle
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import LabelEncoder

from error_analysis import run_error_analysis


def load_validation_data(features_path: str):
    """Load validation data for error analysis."""
    val_df = pd.read_csv(features_path)

    drop_cols = ["msno", "is_churn", "cutoff_ts", "window", "is_churn_label"]
    X = val_df.drop([c for c in drop_cols if c in val_df.columns], axis=1)
    y = val_df["is_churn"]

    # Encode categoricals
    for col in ["gender", "most_common_payment_method", "registered_via", "city"]:
        if col in X.columns:
            X[col] = LabelEncoder().fit_transform(X[col].astype(str).fillna("unknown"))

    X = X.fillna(0)
    return X, y, val_df


def main():
    parser = argparse.ArgumentParser(description="Run error analysis on churn model")
    parser.add_argument(
        "--features",
        default="eval/features_2017-03-2017-04.csv",
        help="Path to validation features CSV",
    )
    parser.add_argument("--model", default="models/lightgbm.pkl", help="Path to trained model")
    parser.add_argument("--calibrate", action="store_true", help="Apply calibration to predictions")
    parser.add_argument("--threshold", type=float, default=0.5, help="Classification threshold")
    parser.add_argument(
        "--fp-cost",
        type=float,
        default=10.0,
        help="Cost of false positive (wasted retention spend)",
    )
    parser.add_argument(
        "--fn-cost", type=float, default=50.0, help="Cost of false negative (lost customer LTV)"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("CHURN MODEL ERROR ANALYSIS")
    print("=" * 70)

    # Load data
    print(f"\n1. Loading validation data from {args.features}...")
    X, y, val_df = load_validation_data(args.features)
    print(f"   Samples: {len(X):,}")
    print(f"   Churn rate: {y.mean():.2%}")

    # Load model
    print(f"\n2. Loading model from {args.model}...")
    with open(args.model, "rb") as f:
        model = pickle.load(f)

    # Generate predictions
    print("\n3. Generating predictions...")
    y_pred = model.predict_proba(X)[:, 1]
    print(f"   Raw prediction mean: {y_pred.mean():.4f}")

    # Apply calibration if requested
    if args.calibrate:
        cal_path = args.model.replace(".pkl", "").replace("models/", "models/calibrator_") + ".pkl"
        if Path(cal_path).exists():
            print(f"\n4. Applying calibration from {cal_path}...")
            with open(cal_path, "rb") as f:
                calibrator = pickle.load(f)
            y_pred = calibrator.transform(y_pred)
            print(f"   Calibrated prediction mean: {y_pred.mean():.4f}")
        else:
            print(f"\n4. Calibrator not found at {cal_path}, using raw predictions")

    # Run error analysis
    print(f"\n5. Running error analysis (threshold={args.threshold})...")
    results = run_error_analysis(
        y_true=y.values,
        y_pred=y_pred,
        features_df=val_df,
        threshold=args.threshold,
        fp_cost=args.fp_cost,
        fn_cost=args.fn_cost,
    )

    # Return results for programmatic use
    return results


if __name__ == "__main__":
    main()
