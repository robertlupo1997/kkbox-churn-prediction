#!/usr/bin/env python3
"""
KKBOX Model Training Script

End-to-end training pipeline from SQL features to trained models.
Demonstrates complete ML workflow with proper temporal safeguards.

Usage:
    python train_models.py                              # Use synthetic data (default)
    python train_models.py --features path/to/features  # Use pre-built features
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from models import run_training_pipeline


def load_features(features_path: str) -> pd.DataFrame:
    """Load features from CSV or Parquet file."""
    path = Path(features_path)

    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    elif path.suffix == ".csv":
        return pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")


def main():
    """Execute complete training pipeline."""
    parser = argparse.ArgumentParser(description="Train KKBOX churn prediction models")
    parser.add_argument(
        "--features",
        type=str,
        default=None,
        help="Path to pre-built features file (CSV or Parquet)",
    )
    args = parser.parse_args()

    print("KKBOX Churn Prediction - Model Training Pipeline")
    print("=" * 60)

    if args.features:
        # Use pre-built features (comprehensive features from real data)
        print("\nSTEP 1: Loading Pre-Built Features")
        print(f"   Source: {args.features}")

        features_df = load_features(args.features)
        features_path = args.features

        print(f"Features loaded: {features_df.shape[0]:,} samples x {features_df.shape[1]} columns")

        # Save as CSV for models.py compatibility if parquet
        if args.features.endswith(".parquet"):
            csv_path = args.features.replace(".parquet", ".csv")
            features_df.to_csv(csv_path, index=False)
            features_path = csv_path
            print(f"   Converted to CSV: {csv_path}")
    else:
        # Generate features from SQL (synthetic data)
        print("\nSTEP 1: Feature Engineering (Synthetic Data)")
        from features_processor import run_feature_pipeline

        features_df = run_feature_pipeline(
            use_synthetic=True,
            sql_file="features/features_simple.sql",
            output_file="features/features_processed.csv",
        )
        features_path = "features/features_processed.csv"
        print(f"Features ready: {features_df.shape}")

    # Step 2: Train models
    print("\nSTEP 2: Model Training")
    results = run_training_pipeline(features_path=features_path, output_dir="models")

    # Step 3: Summary
    print("\nTRAINING COMPLETE - FINAL RESULTS")
    print("=" * 60)

    summary = results["summary"]
    print(f"Dataset Size: {summary['dataset_size']:,} samples")
    print(f"Feature Count: {summary['feature_count']} features")
    print(f"Churn Rate: {summary['churn_rate']:.1%}")
    print(f"Best Model: {summary['best_model']}")
    print(f"Best Log Loss: {summary['best_log_loss']:.4f}")
    print(f"Best AUC: {summary['best_auc']:.4f}")

    print("\nModels saved to: models/")
    print("Ready for calibration and deployment!")


if __name__ == "__main__":
    main()
