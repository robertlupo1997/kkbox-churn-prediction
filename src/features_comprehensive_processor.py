"""
Comprehensive Feature Processor for KKBOX Churn Prediction
Generates 100+ features from real Kaggle data using DuckDB
"""

import time
from pathlib import Path

import duckdb

# Configuration
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "kkbox-churn-prediction-challenge"
FEATURES_SQL = BASE_DIR / "features" / "features_comprehensive.sql"
OUTPUT_DIR = BASE_DIR / "features"

# Real data paths
TRAIN_PATH = DATA_DIR / "train.csv"
TRANSACTIONS_PATH = DATA_DIR / "transactions.csv"
USER_LOGS_PATH = DATA_DIR / "user_logs.csv"
MEMBERS_PATH = DATA_DIR / "members_v3.csv"


def check_data_exists():
    """Verify all required data files exist."""
    required_files = [
        ("train.csv", TRAIN_PATH),
        ("transactions.csv", TRANSACTIONS_PATH),
        ("user_logs.csv", USER_LOGS_PATH),
        ("members_v3.csv", MEMBERS_PATH),
    ]

    missing = []
    for name, path in required_files:
        if not path.exists():
            missing.append(name)
        else:
            size_mb = path.stat().st_size / (1024 * 1024)
            print(f"  {name}: {size_mb:.1f} MB")

    if missing:
        raise FileNotFoundError(f"Missing data files: {missing}")

    return True


def run_feature_engineering():
    """Run comprehensive feature engineering SQL on real data."""

    print("=" * 60)
    print("KKBOX Comprehensive Feature Engineering")
    print("=" * 60)

    # Check data
    print("\n1. Checking data files...")
    check_data_exists()

    # Read SQL template
    print("\n2. Loading feature SQL...")
    with open(FEATURES_SQL) as f:
        sql_template = f.read()

    # Substitute paths
    sql = sql_template.replace("${train_path}", str(TRAIN_PATH).replace("\\", "/"))
    sql = sql.replace("${transactions_path}", str(TRANSACTIONS_PATH).replace("\\", "/"))
    sql = sql.replace("${user_logs_path}", str(USER_LOGS_PATH).replace("\\", "/"))
    sql = sql.replace("${members_path}", str(MEMBERS_PATH).replace("\\", "/"))

    # Run with DuckDB
    print("\n3. Running feature engineering (this may take 10-30 minutes)...")
    print("   Processing 30GB user_logs + 1.7GB transactions...")

    start_time = time.time()

    # Configure DuckDB for large data
    con = duckdb.connect()
    con.execute("SET memory_limit = '8GB'")
    con.execute("SET threads = 4")

    # Execute and fetch results
    result = con.execute(sql).fetchdf()

    elapsed = time.time() - start_time
    print(f"\n   Completed in {elapsed/60:.1f} minutes")

    # Save results
    output_csv = OUTPUT_DIR / "features_comprehensive.csv"
    output_parquet = OUTPUT_DIR / "features_comprehensive.parquet"

    print("\n4. Saving features...")
    print(f"   Shape: {result.shape[0]:,} rows x {result.shape[1]} columns")

    # Save as parquet (faster for training)
    result.to_parquet(output_parquet, index=False)
    print(f"   Saved: {output_parquet}")

    # Also save CSV for inspection
    result.to_csv(output_csv, index=False)
    print(f"   Saved: {output_csv}")

    # Print feature summary
    print("\n5. Feature Summary:")
    print(f"   Total features: {result.shape[1] - 3}")  # Exclude msno, is_churn, cutoff_ts
    print(f"   Total samples: {result.shape[0]:,}")
    print(f"   Churn rate: {result['is_churn'].mean():.2%}")

    # Show sample feature names
    feature_cols = [c for c in result.columns if c not in ["msno", "is_churn", "cutoff_ts"]]
    print("\n   Feature categories:")
    print(
        f"   - Transaction features: {len([c for c in feature_cols if 'tx_' in c or 'paid' in c or 'cancel' in c])}"
    )
    print(
        f"   - Log features: {len([c for c in feature_cols if 'log' in c or 'secs' in c or 'unq' in c or 'plays' in c or 'active' in c or 'completion' in c])}"
    )
    print(
        f"   - Member features: {len([c for c in feature_cols if c in ['city', 'age', 'gender', 'registered_via', 'tenure_days']])}"
    )
    print(f"   - Trend features: {len([c for c in feature_cols if 'trend' in c or 'rate' in c])}")

    con.close()

    print("\n" + "=" * 60)
    print("Feature engineering complete!")
    print("=" * 60)

    return result


if __name__ == "__main__":
    run_feature_engineering()
