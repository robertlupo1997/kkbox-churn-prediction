#!/usr/bin/env python3
"""Generate synthetic app_features.csv for API demo purposes."""

import random
import numpy as np
import pandas as pd
from pathlib import Path

# The model was trained with these 8 features only
MODEL_FEATURES = [
    "plan_days_latest",
    "auto_renew_latest",
    "cancels_total",
    "tx_count_total",
    "logs_30d",
    "secs_30d",
    "unq_30d",
    "bd",  # birth year / age
]


def generate_member_id() -> str:
    """Generate a base64-like member ID."""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    return "".join(random.choices(chars, k=28))


def generate_member_features(risk_profile: str) -> dict:
    """Generate features for a member based on risk profile."""

    features = {"msno": generate_member_id()}

    # Set base values based on risk profile
    if risk_profile == "high":
        cancel_base = random.randint(2, 5)
        auto_renew = 0
        plan_days = random.choice([30, 30, 30, 90])
        activity_base = random.uniform(0.1, 0.4)
        is_churn = random.choice([1, 1, 1, 0])  # 75% churn
    elif risk_profile == "medium":
        cancel_base = random.randint(0, 2)
        auto_renew = random.choice([0, 1])
        plan_days = random.choice([30, 90, 180])
        activity_base = random.uniform(0.4, 0.7)
        is_churn = random.choice([1, 0, 0, 0])  # 25% churn
    else:  # low risk
        cancel_base = random.randint(0, 1)
        auto_renew = random.choice([1, 1, 1, 0])
        plan_days = random.choice([90, 180, 365])
        activity_base = random.uniform(0.6, 0.95)
        is_churn = random.choice([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])  # 10% churn

    # Core 8 features that the model uses
    features["plan_days_latest"] = plan_days
    features["auto_renew_latest"] = auto_renew
    features["cancels_total"] = cancel_base
    features["tx_count_total"] = random.randint(1, 10 + cancel_base * 2)
    features["logs_30d"] = int(30 * activity_base)
    features["secs_30d"] = int(activity_base * 3600 * 2 * features["logs_30d"])  # ~2 hours per active day
    features["unq_30d"] = int(features["logs_30d"] * random.uniform(10, 30))  # unique songs
    features["bd"] = random.randint(1985, 2005)  # birth year (age proxy)

    features["is_churn"] = is_churn

    return features


def main():
    """Generate synthetic app_features.csv."""
    random.seed(42)
    np.random.seed(42)

    n_samples = 500

    # Distribution: 15% high, 25% medium, 60% low risk
    risk_distribution = (
        ["high"] * int(n_samples * 0.15) +
        ["medium"] * int(n_samples * 0.25) +
        ["low"] * int(n_samples * 0.60)
    )
    random.shuffle(risk_distribution)

    print(f"Generating {n_samples} synthetic members...")

    members = []
    for risk_profile in risk_distribution:
        members.append(generate_member_features(risk_profile))

    df = pd.DataFrame(members)

    # Reorder columns to have msno first, then features, then is_churn
    cols = ["msno"] + MODEL_FEATURES + ["is_churn"]
    df = df[cols]

    # Save to eval directory
    output_path = Path(__file__).parent.parent / "eval" / "app_features.csv"
    output_path.parent.mkdir(exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} members with {len(MODEL_FEATURES)} features")
    print(f"Features: {MODEL_FEATURES}")
    print(f"Churn rate: {df['is_churn'].mean():.2%}")
    print(f"Saved to: {output_path}")

    # Print sample
    print("\nSample data:")
    print(df.head())


if __name__ == "__main__":
    main()
