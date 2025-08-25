#!/usr/bin/env python3
"""
Integration test for the complete KKBOX pipeline.
Tests synthetic data flow through all components.
"""

import sys
from pathlib import Path

import pandas as pd


def test_synthetic_backtest():
    """Test backtest functionality with synthetic data."""
    print("🧪 Testing synthetic backtest pipeline...")

    # Use synthetic data for testing
    try:
        import duckdb

        from src.backtest import build_features, labels_for_expire_month

        # Test with synthetic data paths
        syn_path = Path("tests/fixtures")
        con = duckdb.connect()

        print("  ✅ Backtest imports successful")

        # Test feature building
        features = build_features(
            con,
            sql_path=Path("features/features_simple.sql"),
            cutoff=pd.Timestamp("2017-02-28").date(),
            train_path=syn_path / "train_synthetic.csv",
            transactions_path=syn_path / "transactions_synthetic.csv",
            user_logs_path=syn_path / "user_logs_synthetic.csv",
            members_path=syn_path / "members_synthetic.csv",
        )
        print(f"  ✅ Features built: {len(features)} rows")

        # Test label building
        labels = labels_for_expire_month(con, syn_path / "transactions_synthetic.csv", "2017-02")
        print(f"  ✅ Labels built: {len(labels)} rows, churn rate: {labels['is_churn'].mean():.3f}")

        return True

    except Exception as e:
        print(f"  ❌ Backtest test failed: {e}")
        return False


def test_psi():
    """Test PSI calculation."""
    print("🧪 Testing PSI calculation...")

    try:
        import numpy as np

        from src.psi import psi_numeric

        # Test PSI calculation with simple data
        a = np.random.normal(0, 1, 1000)
        b = np.random.normal(0.1, 1.2, 1000)  # Slightly different distribution

        psi_val = psi_numeric(a, b, bins=10)
        print(f"  ✅ PSI calculation: {psi_val:.4f}")

        return True

    except Exception as e:
        print(f"  ❌ PSI test failed: {e}")
        return False


def test_models_exist():
    """Check that trained models exist."""
    print("🧪 Testing model availability...")

    models_dir = Path("models")
    expected_models = ["xgboost.pkl", "random_forest.pkl", "logistic_regression.pkl"]

    found_models = []
    for model_file in expected_models:
        if (models_dir / model_file).exists():
            found_models.append(model_file)
            print(f"  ✅ Found: {model_file}")
        else:
            print(f"  ⚠️  Missing: {model_file}")

    return len(found_models) > 0


def test_app_features():
    """Check that app features are available."""
    print("🧪 Testing app features...")

    app_features_path = Path("eval/app_features.csv")
    if app_features_path.exists():
        df = pd.read_csv(app_features_path)
        print(f"  ✅ App features: {len(df)} rows, {df.shape[1]} columns")

        # Check required columns
        required_cols = ["msno"]
        missing_cols = [col for col in required_cols if col not in df.columns]

        if missing_cols:
            print(f"  ⚠️  Missing columns: {missing_cols}")
            return False
        else:
            print("  ✅ All required columns present")
            return True
    else:
        print(f"  ❌ App features not found at {app_features_path}")
        return False


def main():
    """Run all integration tests."""
    print("🎵 KKBOX Integration Test Suite")
    print("=" * 50)

    tests = [
        ("Synthetic Backtest", test_synthetic_backtest),
        ("PSI Calculation", test_psi),
        ("Model Availability", test_models_exist),
        ("App Features", test_app_features),
    ]

    results = []
    for test_name, test_func in tests:
        print(f"\n🔄 {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"  ❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))

    print("\n📊 INTEGRATION TEST RESULTS")
    print("=" * 50)

    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<20s}: {status}")
        if result:
            passed += 1

    print(f"\nOverall: {passed}/{len(results)} tests passed")

    if passed == len(results):
        print("\n🎉 All integration tests passed! Pipeline ready for real data.")
    else:
        print(f"\n⚠️  {len(results) - passed} tests failed. Check errors above.")

    return passed == len(results)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
