#!/usr/bin/env python3
"""
KKBOX Churn Prediction - Full Pipeline

This script runs the complete pipeline from feature generation to model training.
It orchestrates all phases of the model improvement plan.

Usage:
    python run_full_pipeline.py [--skip-features] [--skip-tuning]

Options:
    --skip-features  Skip feature regeneration (use existing eval/*.csv files)
    --skip-tuning    Skip hyperparameter tuning (use existing best_hyperparameters.json)
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_command(cmd: str, description: str, timeout: int = 3600) -> bool:
    """Run a command and check for success."""
    print(f"\n{'='*60}")
    print(f"STEP: {description}")
    print('='*60)
    print(f"Running: {cmd}")
    print()

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            timeout=timeout,
            capture_output=False
        )

        if result.returncode != 0:
            print(f"\nFAILED: {description}")
            print(f"Return code: {result.returncode}")
            return False

        print(f"\nSUCCESS: {description}")
        return True

    except subprocess.TimeoutExpired:
        print(f"\nTIMEOUT: {description} (exceeded {timeout}s)")
        return False
    except Exception as e:
        print(f"\nERROR: {description}")
        print(f"Exception: {e}")
        return False


def check_prerequisites() -> bool:
    """Check that all required files exist."""
    required_files = [
        "features/features_comprehensive.sql",
        "src/backtest.py",
        "src/historical_features.py",
        "train_temporal.py",
    ]

    missing = []
    for f in required_files:
        if not Path(f).exists():
            missing.append(f)

    if missing:
        print("ERROR: Missing required files:")
        for f in missing:
            print(f"  - {f}")
        return False

    return True


def check_data_files() -> bool:
    """Check that data files exist."""
    data_files = [
        "kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv",
        "kkbox-churn-prediction-challenge/data/churn_comp_refresh/user_logs_v2.csv",
        "kkbox-churn-prediction-challenge/members_v3.csv",
    ]

    missing = []
    for f in data_files:
        if not Path(f).exists():
            missing.append(f)

    if missing:
        print("WARNING: Some data files not found:")
        for f in missing:
            print(f"  - {f}")
        print("Feature regeneration may fail. Use --skip-features if features already exist.")
        return False

    return True


def main():
    parser = argparse.ArgumentParser(description="Run full KKBOX churn prediction pipeline")
    parser.add_argument('--skip-features', action='store_true',
                        help='Skip feature regeneration')
    parser.add_argument('--skip-tuning', action='store_true',
                        help='Skip hyperparameter tuning')
    parser.add_argument('--skip-stacking', action='store_true',
                        help='Skip stacked ensemble training')
    args = parser.parse_args()

    start_time = datetime.now()

    print("=" * 60)
    print("KKBOX CHURN PREDICTION - FULL PIPELINE")
    print("=" * 60)
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Check prerequisites
    print("Checking prerequisites...")
    if not check_prerequisites():
        sys.exit(1)
    print("  All required scripts found.")

    # Track which steps completed
    completed_steps = []

    # Phase 1-3: Feature Generation (optional)
    if not args.skip_features:
        check_data_files()

        # Generate historical features
        if run_command(
            "python src/historical_features.py",
            "Phase 2: Generate historical churn features",
            timeout=1800
        ):
            completed_steps.append("historical_features")
        else:
            print("WARNING: Historical features generation failed, continuing...")

        # Regenerate main features with updated SQL
        if run_command(
            "python src/backtest.py "
            "--transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv "
            "--user-logs kkbox-churn-prediction-challenge/data/churn_comp_refresh/user_logs_v2.csv "
            "--members kkbox-churn-prediction-challenge/members_v3.csv "
            "--train-placeholder kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv "
            "--features-sql features/features_comprehensive.sql "
            "--windows '2017-01:2017-02,2017-02:2017-03,2017-03:2017-04'",
            "Phase 3: Regenerate features with winner SQL",
            timeout=3600
        ):
            completed_steps.append("feature_generation")
        else:
            print("WARNING: Feature generation failed, continuing with existing features...")
    else:
        print("\nSkipping feature generation (--skip-features)")
        # Check that feature files exist
        feature_files = [
            "eval/features_2017-01-2017-02.csv",
            "eval/features_2017-02-2017-03.csv",
            "eval/features_2017-03-2017-04.csv",
        ]
        for f in feature_files:
            if not Path(f).exists():
                print(f"ERROR: Feature file not found: {f}")
                print("Cannot continue without features. Remove --skip-features flag.")
                sys.exit(1)
        print("  Using existing feature files.")
        completed_steps.append("feature_generation")

    # Phase 4: Hyperparameter Tuning (optional)
    if not args.skip_tuning:
        if run_command(
            "python src/hyperparameter_tuning.py --n-trials 50",
            "Phase 4: Hyperparameter tuning with Optuna",
            timeout=7200
        ):
            completed_steps.append("hyperparameter_tuning")
        else:
            print("WARNING: Hyperparameter tuning failed, continuing with defaults...")
    else:
        print("\nSkipping hyperparameter tuning (--skip-tuning)")
        if Path("models/best_hyperparameters.json").exists():
            print("  Using existing tuned hyperparameters.")
            completed_steps.append("hyperparameter_tuning")
        else:
            print("  No tuned hyperparameters found, will use defaults.")

    # Phase 5: Stacked Ensemble (optional)
    if not args.skip_stacking:
        if run_command(
            "python src/stacking.py",
            "Phase 5: Train stacked ensemble",
            timeout=3600
        ):
            completed_steps.append("stacked_ensemble")
        else:
            print("WARNING: Stacked ensemble training failed, continuing...")
    else:
        print("\nSkipping stacked ensemble (--skip-stacking)")

    # Phase 6: Final Training
    if run_command(
        "python train_temporal.py",
        "Phase 6: Final model training with all improvements",
        timeout=1800
    ):
        completed_steps.append("final_training")
    else:
        print("ERROR: Final training failed!")
        sys.exit(1)

    # Summary
    end_time = datetime.now()
    duration = end_time - start_time

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    print(f"Started:  {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Finished: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Duration: {duration}")
    print()
    print("Completed steps:")
    for step in completed_steps:
        print(f"  - {step}")
    print()

    # Load and display final metrics
    metrics_path = Path("models/training_metrics.json")
    if metrics_path.exists():
        with open(metrics_path) as f:
            metrics = json.load(f)
        print("Final Model Performance:")
        print("-" * 40)
        for name, m in sorted(metrics["models"].items(), key=lambda x: -x[1]["auc"]):
            print(f"  {name:20s} AUC: {m['auc']:.4f}")
        print()
        best = max(metrics["models"].items(), key=lambda x: x[1]["auc"])
        print(f"Best Model: {best[0]} (AUC: {best[1]['auc']:.4f})")

    print("\nOutput files:")
    print("  - models/training_metrics.json")
    print("  - models/best_hyperparameters.json")
    print("  - models/lightgbm.pkl")
    print("  - models/xgboost.pkl")
    if Path("models/stacked_ensemble.pkl").exists():
        print("  - models/stacked_ensemble.pkl")


if __name__ == "__main__":
    main()
