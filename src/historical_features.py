#!/usr/bin/env python3
"""
Historical churn feature generation - VECTORIZED VERSION.

Tracks each user's churn history across time windows and computes:
- last_1_is_churn through last_5_is_churn: Did user churn in last N periods?
- churn_count: Total times user has churned
- churn_rate: Proportion of periods user churned
- transaction_count: Total periods observed
- months_since_last_churn: Recency of last churn event

This implements the key insight from Bryan Gregory's winning solution:
historical churn patterns are highly predictive of future churn.
"""

import argparse
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd


def compute_all_churn_labels(
    con: duckdb.DuckDBPyConnection, v1_path: Path, v2_path: Path
) -> pd.DataFrame:
    """
    Compute churn labels for ALL target months in a single SQL query.
    Returns DataFrame with columns: msno, target_month, is_churn
    """
    targets = [
        201601,
        201602,
        201603,
        201604,
        201605,
        201606,
        201607,
        201608,
        201609,
        201610,
        201611,
        201612,
        201701,
        201702,
        201703,
    ]  # Skip 201704 - no renewal data

    # Build a UNION query for all target months
    union_parts = []
    for target in targets:
        part = f"""
        SELECT
            msno,
            {target} AS target_month,
            CASE WHEN renewal_dt IS NOT NULL THEN 0 ELSE 1 END AS is_churn
        FROM (
            SELECT
                lq.msno,
                MIN(CASE
                    WHEN t2.is_cancel = 0
                        AND t2.txn_date_int > lq.txn_date_int
                        AND DATE_DIFF('day', lq.qual_exp_dt, t2.txn_dt) < 30
                        AND t2.exp_dt > lq.qual_exp_dt
                    THEN t2.txn_dt
                    ELSE NULL
                END) AS renewal_dt
            FROM (
                SELECT msno, txn_dt, exp_dt AS qual_exp_dt, txn_date_int, exp_date_int
                FROM (
                    SELECT
                        msno, txn_dt, exp_dt, txn_date_int, exp_date_int,
                        ROW_NUMBER() OVER (PARTITION BY msno ORDER BY txn_date_int DESC, exp_date_int DESC) AS rn
                    FROM tx
                    WHERE CAST(exp_date_int / 100 AS INTEGER) = {target}
                        AND is_cancel = 0
                        AND CAST(txn_date_int / 100 AS INTEGER) < {target}
                ) WHERE rn = 1
            ) lq
            LEFT JOIN tx t2 ON t2.msno = lq.msno
            GROUP BY lq.msno
        )
        """
        union_parts.append(part)

    # Combine all parts
    union_query = "\nUNION ALL\n".join(union_parts)

    full_query = f"""
    WITH tx_raw AS (
        SELECT * FROM read_csv_auto('{v1_path}', IGNORE_ERRORS=TRUE)
        UNION ALL
        SELECT * FROM read_csv_auto('{v2_path}', IGNORE_ERRORS=TRUE)
    ),
    tx AS (
        SELECT DISTINCT
            msno,
            CAST(transaction_date AS INTEGER) AS txn_date_int,
            CAST(membership_expire_date AS INTEGER) AS exp_date_int,
            TRY_CAST(STRPTIME(CAST(transaction_date AS VARCHAR), '%Y%m%d') AS DATE) AS txn_dt,
            TRY_CAST(STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS DATE) AS exp_dt,
            CAST(is_cancel AS INTEGER) AS is_cancel
        FROM tx_raw
        WHERE msno IS NOT NULL
            AND transaction_date IS NOT NULL
            AND membership_expire_date IS NOT NULL
    )
    {union_query}
    """

    print("Computing churn labels for all months (this may take a few minutes)...")
    result = con.execute(full_query).fetchdf()
    print(f"  Computed {len(result):,} churn observations")
    return result


def generate_historical_features_vectorized(
    churn_history: pd.DataFrame, target_month: int
) -> pd.DataFrame:
    """
    Generate historical churn features using vectorized pandas operations.
    Much faster than per-user iteration.
    """
    print(f"\nGenerating features for {target_month}...")

    # Get chronologically sorted list of all months
    all_months = sorted(churn_history["target_month"].unique())
    target_idx = all_months.index(target_month)
    prior_months = all_months[:target_idx]

    # Get users in target month
    target_users = churn_history[churn_history["target_month"] == target_month][["msno"]].copy()
    print(f"  Target users: {len(target_users):,}")

    if len(prior_months) == 0:
        print("  No prior months available for history")
        # Return empty features for all users
        target_users["last_1_is_churn"] = -1
        target_users["last_2_is_churn"] = -1
        target_users["last_3_is_churn"] = -1
        target_users["last_4_is_churn"] = -1
        target_users["last_5_is_churn"] = -1
        target_users["churn_count"] = -1
        target_users["churn_rate"] = -1.0
        target_users["transaction_count"] = -1
        target_users["months_since_last_churn"] = -1
        return target_users

    # Filter to prior months only
    prior_data = churn_history[churn_history["target_month"].isin(prior_months)].copy()
    prior_data = prior_data.sort_values(["msno", "target_month"])

    # Pivot to get churn per month per user
    # Columns will be months, rows will be users
    pivot = prior_data.pivot_table(
        index="msno",
        columns="target_month",
        values="is_churn",
        aggfunc="max",  # In case of duplicates
    )

    # Reorder columns chronologically
    pivot = pivot[sorted(pivot.columns)]

    # Compute aggregate features per user
    features = pd.DataFrame(index=pivot.index)

    # last_N_is_churn: take the last N columns (most recent months)
    for i in range(1, 6):
        if len(pivot.columns) >= i:
            features[f"last_{i}_is_churn"] = pivot.iloc[:, -i].fillna(-1).astype(int)
        else:
            features[f"last_{i}_is_churn"] = -1

    # Count non-null observations per user
    features["transaction_count"] = pivot.notna().sum(axis=1)
    features["churn_count"] = pivot.sum(axis=1, skipna=True)
    features["churn_rate"] = features["churn_count"] / features["transaction_count"]

    # months_since_last_churn: find the rightmost 1 in each row
    def months_since_last_churn(row):
        churn_positions = np.where(row == 1)[0]
        if len(churn_positions) == 0:
            return -1  # Never churned
        last_churn_idx = churn_positions[-1]
        return len(row) - 1 - last_churn_idx

    features["months_since_last_churn"] = pivot.apply(months_since_last_churn, axis=1)

    # Reset index to get msno as column
    features = features.reset_index()

    # Merge with target users (left join to include all target users)
    result = target_users.merge(features, on="msno", how="left")

    # Fill NaN for users with no history
    for col in [
        "last_1_is_churn",
        "last_2_is_churn",
        "last_3_is_churn",
        "last_4_is_churn",
        "last_5_is_churn",
        "churn_count",
        "transaction_count",
        "months_since_last_churn",
    ]:
        result[col] = result[col].fillna(-1).astype(int)

    result["churn_rate"] = result["churn_rate"].fillna(-1)

    print(f"  Generated {len(result):,} feature rows")
    return result


def main():
    parser = argparse.ArgumentParser(description="Generate historical churn features")
    parser.add_argument(
        "--transactions-v1",
        default="kkbox-churn-prediction-challenge/transactions.csv",
        help="Path to transactions.csv (v1)",
    )
    parser.add_argument(
        "--transactions-v2",
        default="kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv",
        help="Path to transactions_v2.csv",
    )
    parser.add_argument(
        "--output-dir", default="eval", help="Output directory for historical feature files"
    )
    parser.add_argument(
        "--target-months",
        default="201702",
        help="Comma-separated target months (YYYYMM) to generate features for",
    )
    args = parser.parse_args()

    v1_path = Path(args.transactions_v1)
    v2_path = Path(args.transactions_v2)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)

    # Validate paths
    if not v1_path.exists():
        print(f"ERROR: transactions v1 not found: {v1_path}")
        return
    if not v2_path.exists():
        print(f"ERROR: transactions v2 not found: {v2_path}")
        return

    # Connect to DuckDB
    con = duckdb.connect()
    con.execute("SET memory_limit='8GB'")
    con.execute("SET threads=4")

    # Compute all churn labels at once
    churn_history = compute_all_churn_labels(con, v1_path, v2_path)

    # Save churn history
    history_path = output_dir / "churn_history_all.csv"
    churn_history.to_csv(history_path, index=False)
    print(f"Saved churn history to {history_path}")

    # Parse target months
    target_months = [int(m) for m in args.target_months.split(",")]

    # Generate features for each target month
    for target in target_months:
        features_df = generate_historical_features_vectorized(churn_history, target)

        if len(features_df) == 0:
            print(f"  WARNING: No features generated for {target}")
            continue

        output_path = output_dir / f"historical_features_{target}.csv"
        features_df.to_csv(output_path, index=False)
        print(f"  Saved to {output_path}")

        # Show feature distribution
        valid_churn_rate = features_df[features_df["churn_rate"] >= 0]["churn_rate"]
        if len(valid_churn_rate) > 0:
            print(f"  Users with history: {len(valid_churn_rate):,}")
            print(f"  Mean churn_rate: {valid_churn_rate.mean():.3f}")

        for col in ["last_1_is_churn", "churn_count"]:
            vals = features_df[features_df[col] >= 0][col]
            if len(vals) > 0:
                print(f"  {col} distribution: {vals.value_counts().head(5).to_dict()}")


if __name__ == "__main__":
    main()
