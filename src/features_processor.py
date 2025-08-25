"""
KKBOX Feature Processing Pipeline

Executes SQL feature engineering and prepares data for model training.
Bridges DuckDB SQL queries with Python ML pipeline.
"""

import shutil
import tempfile
from pathlib import Path

import duckdb
import pandas as pd


class FeatureProcessor:
    """
    Process KKBOX features using DuckDB SQL queries.

    Handles:
    - SQL query execution with parameter substitution
    - Data validation and quality checks
    - Feature engineering pipeline orchestration
    """

    def __init__(self, db_path: str = ":memory:"):
        """Initialize DuckDB connection."""
        self.conn = duckdb.connect(db_path)

    def process_features(
        self, sql_file: str, data_paths: dict[str, str], output_path: str
    ) -> pd.DataFrame:
        """
        Execute SQL feature engineering pipeline.

        Args:
            sql_file: Path to SQL feature engineering file
            data_paths: Dictionary mapping template variables to file paths
            output_path: Where to save processed features

        Returns:
            df: Processed feature dataframe
        """
        # Read SQL template
        with open(sql_file) as f:
            sql_template = f.read()

        # Substitute file paths
        sql_query = sql_template
        for var, path in data_paths.items():
            sql_query = sql_query.replace(f"${{{var}}}", path)

        print("🔄 Executing feature engineering SQL...")
        print(f"📊 Data sources: {list(data_paths.keys())}")

        # Execute query
        try:
            result = self.conn.execute(sql_query).fetchdf()
            print(f"✅ Features generated: {len(result)} rows, {result.shape[1]} columns")

            # Save results
            result.to_csv(output_path, index=False)
            print(f"💾 Features saved to: {output_path}")

            return result

        except Exception as e:
            print(f"❌ SQL execution failed: {str(e)}")
            raise

    def validate_features(self, df: pd.DataFrame) -> dict[str, any]:
        """
        Validate processed features for quality and completeness.

        Returns:
            validation_report: Quality metrics and flags
        """
        validation = {
            "total_rows": len(df),
            "total_features": df.shape[1],
            "missing_values": df.isnull().sum().to_dict(),
            "churn_rate": df["is_churn"].mean() if "is_churn" in df.columns else None,
            "feature_types": df.dtypes.to_dict(),
        }

        # Check for temporal leakage indicators
        if "cutoff_ts" in df.columns:
            validation["cutoff_dates"] = df["cutoff_ts"].unique().tolist()

        # Feature distribution stats
        numeric_cols = df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) > 0:
            validation["numeric_summary"] = df[numeric_cols].describe().to_dict()

        return validation


def prepare_synthetic_data() -> dict[str, str]:
    """
    Set up synthetic data files for feature processing.

    Returns:
        data_paths: File paths for SQL template substitution
    """
    import sys

    sys.path.append("/mnt/c/Users/Trey/Downloads/KKBOX_PROJECT")

    from tests.fixtures.generate_synthetic import generate_kkbox_dataset

    # Create temporary directory
    temp_dir = Path(tempfile.mkdtemp())
    print(f"📁 Creating synthetic data in {temp_dir}")

    # Generate synthetic dataset
    synthetic_data = generate_kkbox_dataset(n_samples=1000)

    # Save individual CSV files
    data_paths = {}
    for table_name, df in synthetic_data.items():
        file_path = temp_dir / f"{table_name}.csv"
        df.to_csv(file_path, index=False)
        data_paths[f"{table_name}_path"] = str(file_path)
        print(f"✅ {table_name}: {len(df)} records")

    return data_paths


def run_feature_pipeline(
    use_synthetic: bool = True,
    sql_file: str = "features/features_simple.sql",
    output_file: str = "features/features_processed.csv",
) -> pd.DataFrame:
    """
    Execute complete feature processing pipeline.

    Args:
        use_synthetic: Whether to use synthetic data (default for demo)
        sql_file: SQL feature engineering file
        output_file: Output CSV file path

    Returns:
        processed_features: Feature dataframe ready for modeling
    """
    print("🚀 Starting KKBOX Feature Processing Pipeline")

    # Initialize processor
    processor = FeatureProcessor()

    # Prepare data paths
    if use_synthetic:
        data_paths = prepare_synthetic_data()
    else:
        # Production data paths (would be provided)
        raise NotImplementedError("Production data paths not configured")

    # Ensure output directory exists
    Path(output_file).parent.mkdir(exist_ok=True, parents=True)

    try:
        # Process features
        features_df = processor.process_features(sql_file, data_paths, output_file)

        # Validate results
        validation = processor.validate_features(features_df)
        print("\n📊 Feature Validation Summary:")
        print(f"  Rows: {validation['total_rows']}")
        print(f"  Features: {validation['total_features']}")
        print(f"  Churn Rate: {validation['churn_rate']:.3f}")
        print(f"  Missing Values: {sum(validation['missing_values'].values())} total")

        return features_df

    finally:
        # Cleanup temporary files
        if use_synthetic and "temp_dir" in locals():
            shutil.rmtree(temp_dir, ignore_errors=True)
            print("🧹 Cleaned up temporary files")


if __name__ == "__main__":
    # Execute pipeline with synthetic data
    features = run_feature_pipeline()
    print("✅ Feature processing completed!")
