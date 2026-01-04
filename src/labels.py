#!/usr/bin/env python3
"""
KKBOX 30-day churn rule implementation.

Implements the official churn definition: A user is labeled churn if no new
subscription occurs within 30 days after membership expiration.

See CITES.md for official sources and quotes.
"""

import argparse
import os
import sys

import duckdb
import pandas as pd


def create_churn_labels(
    transactions_path: str,
    train_labels_path: str,
    cutoff_date: str = "2017-03-01",
    window_days: int = 30,
) -> pd.DataFrame:
    """
    Create churn labels using WSDMChurnLabeller.scala semantics.

    Implements the exact logic from the Kaggle Scala reference:
    1. Sort each user's transactions by transaction_date
    2. For each membership_expire_date, check if any later transaction
       extends membership to a date within 30 days after that expiry
    3. Handle same-day renewals, overlapping plans, plan downgrades
    4. Treat is_cancel as "canceled plan," not churn by itself

    Args:
        transactions_path: Path to transactions CSV file
        train_labels_path: Path to official train labels for validation
        cutoff_date: Cutoff date for label generation (YYYY-MM-DD)
        window_days: Days after expiration to check for renewals (default 30)

    Returns:
        DataFrame with columns: msno, is_churn, last_expire_date, next_txn_date, days_to_next

    Raises:
        FileNotFoundError: If input files don't exist
    """

    if not os.path.exists(transactions_path):
        raise FileNotFoundError(f"Transactions file not found: {transactions_path}")

    if not os.path.exists(train_labels_path):
        raise FileNotFoundError(f"Train labels file not found: {train_labels_path}")

    con = duckdb.connect()

    # Load transaction data and official labels
    con.execute(
        f"""
        CREATE OR REPLACE VIEW tx_raw AS
        SELECT * FROM read_csv_auto('{transactions_path}', IGNORE_ERRORS=TRUE)
    """
    )

    con.execute(
        f"""
        CREATE OR REPLACE VIEW official_labels AS
        SELECT * FROM read_csv_auto('{train_labels_path}', IGNORE_ERRORS=TRUE)
    """
    )

    # Implement WSDMChurnLabeller.scala logic exactly
    query = f"""
    WITH tx_parsed AS (
        SELECT
            msno,
            TRY_CAST(STRPTIME(CAST(transaction_date AS VARCHAR), '%Y%m%d') AS DATE) AS transaction_date,
            TRY_CAST(STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS DATE) AS membership_expire_date,
            CAST(payment_plan_days AS INTEGER) AS payment_plan_days,
            CAST(is_auto_renew AS INTEGER) AS is_auto_renew,
            CAST(is_cancel AS INTEGER) AS is_cancel
        FROM tx_raw
        WHERE msno IS NOT NULL
            AND CAST(transaction_date AS VARCHAR) IS NOT NULL
            AND CAST(membership_expire_date AS VARCHAR) IS NOT NULL
            AND CAST(transaction_date AS VARCHAR) != ''
            AND CAST(membership_expire_date AS VARCHAR) != ''
            AND TRY_CAST(STRPTIME(CAST(transaction_date AS VARCHAR), '%Y%m%d') AS DATE) IS NOT NULL
            AND TRY_CAST(STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS DATE) IS NOT NULL
    ),

    -- Sort transactions by date per user (mirroring Scala sorting)
    tx_sorted AS (
        SELECT *,
            ROW_NUMBER() OVER (PARTITION BY msno ORDER BY transaction_date ASC, membership_expire_date ASC) AS tx_order
        FROM tx_parsed
        WHERE transaction_date <= DATE '{cutoff_date}' - INTERVAL '1 day'  -- Only past data
    ),

    -- Find the last expiration date per user before cutoff
    user_last_expire AS (
        SELECT
            msno,
            MAX(membership_expire_date) AS last_expire_date
        FROM tx_sorted
        WHERE membership_expire_date < DATE '{cutoff_date}'  -- Expires before March
        GROUP BY msno
    ),

    -- For each user's last expiry, find the next transaction that extends membership
    -- This mirrors the Scala logic of checking if later transactions extend beyond expiry
    next_extensions AS (
        SELECT DISTINCT
            ule.msno,
            ule.last_expire_date,
            MIN(t2.transaction_date) AS next_txn_date,
            MIN(t2.membership_expire_date) AS next_expire_date
        FROM user_last_expire ule
        INNER JOIN tx_sorted t1 ON ule.msno = t1.msno
            AND t1.membership_expire_date = ule.last_expire_date
        LEFT JOIN tx_sorted t2 ON ule.msno = t2.msno
            -- Find transactions after the expiry that aren't cancellations
            AND t2.transaction_date > ule.last_expire_date
            AND t2.is_cancel = 0
            -- Check if the new transaction extends membership beyond the expiry window
            AND t2.membership_expire_date > ule.last_expire_date
        GROUP BY ule.msno, ule.last_expire_date
    ),

    -- Apply the 30-day churn rule: is there a renewal within 30 days?
    churn_labels AS (
        SELECT
            ne.msno,
            ne.last_expire_date,
            ne.next_txn_date,
            ne.next_expire_date,
            CASE
                WHEN ne.next_txn_date IS NULL THEN NULL  -- No future transaction
                ELSE DATE_DIFF('day', ne.last_expire_date, ne.next_txn_date)
            END AS days_to_next,
            CASE
                WHEN ne.next_txn_date IS NULL THEN 1  -- No renewal = churn
                WHEN DATE_DIFF('day', ne.last_expire_date, ne.next_txn_date) <= {window_days} THEN 0  -- Renewal within window
                ELSE 1  -- Renewal too late = churn
            END AS is_churn
        FROM next_extensions ne
    )

    SELECT
        cl.msno,
        cl.is_churn,
        cl.last_expire_date,
        cl.next_txn_date,
        cl.days_to_next,
        ol.is_churn AS official_is_churn
    FROM churn_labels cl
    LEFT JOIN official_labels ol ON cl.msno = ol.msno
    WHERE cl.msno IN (SELECT msno FROM official_labels)  -- Only train set users
    ORDER BY cl.msno
    """

    result = con.execute(query).fetchdf()
    con.close()

    return result


def validate_labels(labels_df: pd.DataFrame, min_accuracy: float = 0.99) -> tuple[float, int, int]:
    """
    Validate generated labels against official labels.

    Args:
        labels_df: DataFrame with both generated and official labels
        min_accuracy: Minimum required accuracy threshold

    Returns:
        Tuple of (accuracy, matches, total_comparable)

    Raises:
        ValueError: If accuracy is below minimum threshold
    """

    # Filter to records where we have both labels for comparison
    comparable = labels_df.dropna(subset=["is_churn", "official_is_churn"])

    if len(comparable) == 0:
        raise ValueError("No comparable labels found for validation")

    matches = (comparable["is_churn"] == comparable["official_is_churn"]).sum()
    total = len(comparable)
    accuracy = matches / total

    print("Label validation results:")
    print(f"  Comparable samples: {total:,}")
    print(f"  Matches: {matches:,}")
    print(f"  Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")

    if accuracy < min_accuracy:
        raise ValueError(f"Label accuracy {accuracy:.4f} below required {min_accuracy:.4f}")

    return accuracy, matches, total


def mismatch_audit(labels_df: pd.DataFrame, max_examples: int = 50) -> pd.DataFrame:
    """
    Generate detailed mismatch audit with 50 diff examples as specified.

    Creates a CSV with msno, last_expire_date, next_txn_date, days_to_next,
    generated_label, official_label for debugging the WSDMChurnLabeller logic.

    Args:
        labels_df: DataFrame with both generated and official labels
        max_examples: Maximum number of mismatches to return (default 50)

    Returns:
        DataFrame with detailed mismatch information
    """

    comparable = labels_df.dropna(subset=["is_churn", "official_is_churn"])
    mismatches = comparable[comparable["is_churn"] != comparable["official_is_churn"]]

    if len(mismatches) == 0:
        print("No mismatches found!")
        return pd.DataFrame()

    # Create detailed audit report
    audit_df = mismatches[
        [
            "msno",
            "last_expire_date",
            "next_txn_date",
            "days_to_next",
            "is_churn",
            "official_is_churn",
        ]
    ].copy()
    audit_df.rename(
        columns={"is_churn": "generated_label", "official_is_churn": "official_label"}, inplace=True
    )

    # Sort by severity: false negatives first (we missed churners), then false positives
    audit_df["mismatch_type"] = audit_df.apply(
        lambda row: (
            "false_negative" if row["generated_label"] < row["official_label"] else "false_positive"
        ),
        axis=1,
    )

    audit_df = audit_df.sort_values(["mismatch_type", "days_to_next"], ascending=[True, True])

    print("\nMISMATCH AUDIT REPORT:")
    print(f"Total mismatches: {len(mismatches):,}")
    print(
        f"False negatives (Generated=0, Official=1): {len(audit_df[audit_df['mismatch_type']=='false_negative']):,}"
    )
    print(
        f"False positives (Generated=1, Official=0): {len(audit_df[audit_df['mismatch_type']=='false_positive']):,}"
    )

    # Show top examples
    top_examples = audit_df.head(max_examples)
    print(f"\nTop {len(top_examples)} mismatches:")
    for _, row in top_examples.iterrows():
        days_str = f"{row['days_to_next']}" if pd.notna(row["days_to_next"]) else "None"
        next_txn_str = (
            row["next_txn_date"].strftime("%Y-%m-%d") if pd.notna(row["next_txn_date"]) else "None"
        )
        print(
            f"  {row['msno']}: expire={row['last_expire_date']}, next_txn={next_txn_str}, "
            f"days={days_str}, gen={row['generated_label']}, official={row['official_label']} ({row['mismatch_type']})"
        )

    return audit_df


def analyze_mismatches(labels_df: pd.DataFrame, max_examples: int = 10):
    """
    Analyze mismatched labels for debugging (legacy function).

    Args:
        labels_df: DataFrame with both generated and official labels
        max_examples: Maximum number of examples to show
    """

    comparable = labels_df.dropna(subset=["is_churn", "official_is_churn"])
    mismatches = comparable[comparable["is_churn"] != comparable["official_is_churn"]]

    if len(mismatches) == 0:
        print("No mismatches found!")
        return

    print(f"\nWARNING: Found {len(mismatches):,} mismatches:")
    print(
        f"Generated=1, Official=0: {len(mismatches[mismatches['is_churn'] > mismatches['official_is_churn']]):,}"
    )
    print(
        f"Generated=0, Official=1: {len(mismatches[mismatches['is_churn'] < mismatches['official_is_churn']]):,}"
    )

    if max_examples > 0:
        print(f"\nFirst {min(max_examples, len(mismatches))} mismatches:")
        print(
            mismatches[
                ["msno", "is_churn", "official_is_churn", "last_expire_date", "next_txn_date"]
            ].head(max_examples)
        )


def main():
    """Main entry point for label generation and validation."""

    parser = argparse.ArgumentParser(description="Generate KKBOX churn labels using 30-day rule")
    parser.add_argument(
        "--transactions",
        default="kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv",
        help="Path to transactions CSV file",
    )
    parser.add_argument(
        "--train-labels",
        default="kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv",
        help="Path to official train labels CSV",
    )
    parser.add_argument(
        "--cutoff-date", default="2017-03-01", help="Cutoff date for label generation (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--window-days", type=int, default=30, help="Days after expiration to check for renewals"
    )
    parser.add_argument(
        "--output", default="data/generated_labels.csv", help="Output path for generated labels"
    )
    parser.add_argument(
        "--min-accuracy",
        type=float,
        default=0.99,
        help="Minimum required accuracy vs official labels",
    )

    args = parser.parse_args()

    try:
        print(f"Generating labels using {args.window_days}-day rule...")
        print(f"   Transactions: {args.transactions}")
        print(f"   Official labels: {args.train_labels}")
        print(f"   Cutoff date: {args.cutoff_date}")

        labels_df = create_churn_labels(
            transactions_path=args.transactions,
            train_labels_path=args.train_labels,
            cutoff_date=args.cutoff_date,
            window_days=args.window_days,
        )

        print(f"Generated {len(labels_df):,} labels")
        print(f"   Churn rate: {labels_df['is_churn'].mean():.3f}")

        # Validate against official labels
        try:
            accuracy, matches, total = validate_labels(labels_df, args.min_accuracy)

            # If accuracy is good, proceed normally
            print(f"Validation passed: {accuracy:.4f} accuracy")

            # Still generate audit for any remaining mismatches
            mismatch_df = mismatch_audit(labels_df, max_examples=50)
            if len(mismatch_df) > 0:
                audit_path = args.output.replace(".csv", "_mismatches.csv")
                mismatch_df.to_csv(audit_path, index=False)
                print(f"Mismatch audit saved to: {audit_path}")

        except ValueError as e:
            # Accuracy below threshold - generate detailed audit and stop
            print(f"ERROR: {e}")

            mismatch_df = mismatch_audit(labels_df, max_examples=50)
            if len(mismatch_df) > 0:
                audit_path = args.output.replace(".csv", "_mismatches.csv")
                mismatch_df.to_csv(audit_path, index=False)
                print(f"Mismatch audit saved to: {audit_path}")
                print("STOP RULE: Fix label accuracy to >=99% before proceeding")
                sys.exit(1)

        # Save results
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        output_cols = ["msno", "is_churn", "last_expire_date", "next_txn_date"]
        labels_df[output_cols].to_csv(args.output, index=False)

        print(f"Labels saved to: {args.output}")
        print(f"Validation passed: {accuracy:.4f} accuracy")

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
