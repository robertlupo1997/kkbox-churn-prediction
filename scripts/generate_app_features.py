"""Generate app_features.csv from comprehensive features."""

from pathlib import Path

import pandas as pd


def main():
    # Load comprehensive features
    features_path = Path("features/features_comprehensive.parquet")
    if not features_path.exists():
        features_path = Path("features/features_comprehensive.csv")

    df = (
        pd.read_csv(features_path)
        if features_path.suffix == ".csv"
        else pd.read_parquet(features_path)
    )

    # Sample 10,000 users stratified by churn
    # Ensure mix of high/medium/low risk users
    n_samples = min(10000, len(df))

    if "is_churn" in df.columns:
        # Stratified sample
        churned = df[df["is_churn"] == 1]
        retained = df[df["is_churn"] == 0]

        # Sample proportionally but ensure at least 1000 churners
        n_churned = min(2000, len(churned))
        n_retained = min(n_samples - n_churned, len(retained))

        sampled = pd.concat(
            [
                churned.sample(n=n_churned, random_state=42),
                retained.sample(n=n_retained, random_state=42),
            ]
        )
    else:
        sampled = df.sample(n=n_samples, random_state=42)

    # Save to eval/app_features.csv
    output_path = Path("eval/app_features.csv")
    sampled.to_csv(output_path, index=False)
    print(f"Generated {len(sampled):,} users -> {output_path}")
    print(f"  Churned: {sampled['is_churn'].sum():,}")
    print(f"  Retained: {(~sampled['is_churn'].astype(bool)).sum():,}")


if __name__ == "__main__":
    main()
