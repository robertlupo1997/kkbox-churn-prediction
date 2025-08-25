#!/usr/bin/env python3
"""
KKBOX Model Training Script

End-to-end training pipeline from SQL features to trained models.
Demonstrates complete ML workflow with proper temporal safeguards.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from features_processor import run_feature_pipeline
from models import run_training_pipeline

def main():
    """Execute complete training pipeline."""
    print("🎵 KKBOX Churn Prediction - Model Training Pipeline")
    print("=" * 60)
    
    # Step 1: Process features from SQL
    print("\n🔧 STEP 1: Feature Engineering")
    features_df = run_feature_pipeline(
        use_synthetic=True,
        sql_file="features/features_simple.sql",
        output_file="features/features_processed.csv"
    )
    
    print(f"✅ Features ready: {features_df.shape}")
    
    # Step 2: Train models
    print("\n🤖 STEP 2: Model Training") 
    results = run_training_pipeline(
        features_path="features/features_processed.csv",
        output_dir="models"
    )
    
    # Step 3: Summary
    print("\n📊 TRAINING COMPLETE - FINAL RESULTS")
    print("=" * 60)
    
    summary = results['summary']
    print(f"Dataset Size: {summary['dataset_size']:,} samples")
    print(f"Feature Count: {summary['feature_count']} features") 
    print(f"Churn Rate: {summary['churn_rate']:.1%}")
    print(f"Best Model: {summary['best_model']}")
    print(f"Best Log Loss: {summary['best_log_loss']:.4f}")
    print(f"Best AUC: {summary['best_auc']:.4f}")
    
    print(f"\n💾 Models saved to: models/")
    print("🎯 Ready for calibration and deployment!")

if __name__ == "__main__":
    main()