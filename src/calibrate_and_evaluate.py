#!/usr/bin/env python3
"""
Calibrate trained models and evaluate improvement.

This script:
1. Loads trained models (LightGBM, XGBoost)
2. Splits validation data into calibration and test sets
3. Fits isotonic calibration on calibration set
4. Evaluates before/after on test set
5. Saves calibrators for use in submission
"""

import json
import pickle

import numpy as np
import pandas as pd
from sklearn.calibration import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.preprocessing import LabelEncoder


def load_validation_data():
    """Load validation data for calibration."""
    val_df = pd.read_csv("eval/features_2017-03-2017-04.csv")

    drop_cols = ["msno", "is_churn", "cutoff_ts", "window", "is_churn_label"]
    X = val_df.drop([c for c in drop_cols if c in val_df.columns], axis=1)
    y = val_df["is_churn"]

    # Encode categoricals
    for col in ["gender", "most_common_payment_method", "registered_via", "city"]:
        if col in X.columns:
            X[col] = LabelEncoder().fit_transform(X[col].astype(str).fillna("unknown"))

    X = X.fillna(0)
    return X, y, val_df["msno"]


def calibrate_model(model, X, y, model_name):
    """Calibrate a single model using isotonic regression."""
    # Split into calibration and test (50/50)
    n = len(y)
    np.random.seed(42)
    indices = np.random.permutation(n)
    cal_idx = indices[:n//2]
    test_idx = indices[n//2:]

    X_cal, y_cal = X.iloc[cal_idx], y.iloc[cal_idx]
    X_test, y_test = X.iloc[test_idx], y.iloc[test_idx]

    # Get raw predictions
    raw_cal = model.predict_proba(X_cal)[:, 1]
    raw_test = model.predict_proba(X_test)[:, 1]

    # Fit isotonic calibration
    isotonic = IsotonicRegression(out_of_bounds="clip")
    isotonic.fit(raw_cal, y_cal)

    # Apply calibration
    cal_test = isotonic.transform(raw_test)

    # Compute metrics
    results = {
        "before": {
            "log_loss": log_loss(y_test, raw_test),
            "auc": roc_auc_score(y_test, raw_test),
            "brier": brier_score_loss(y_test, raw_test),
        },
        "after": {
            "log_loss": log_loss(y_test, cal_test),
            "auc": roc_auc_score(y_test, cal_test),
            "brier": brier_score_loss(y_test, cal_test),
        },
        "calibrator": isotonic,
    }

    return results


def main():
    print("=" * 60)
    print("MODEL CALIBRATION")
    print("=" * 60)

    # Load data
    print("\n1. Loading validation data...")
    X, y, msno = load_validation_data()
    print(f"   Samples: {len(X):,}")
    print(f"   Churn rate: {y.mean():.2%}")

    # Load models
    print("\n2. Loading trained models...")
    with open("models/lightgbm.pkl", "rb") as f:
        lgb_model = pickle.load(f)
    with open("models/xgboost.pkl", "rb") as f:
        xgb_model = pickle.load(f)

    # Calibrate each model
    print("\n3. Calibrating models...")
    results = {}

    for name, model in [("lightgbm", lgb_model), ("xgboost", xgb_model)]:
        print(f"\n   {name}:")
        r = calibrate_model(model, X, y, name)
        results[name] = r

        print(f"   Before: Log Loss={r['before']['log_loss']:.4f}, AUC={r['before']['auc']:.4f}")
        print(f"   After:  Log Loss={r['after']['log_loss']:.4f}, AUC={r['after']['auc']:.4f}")
        print(f"   Improvement: {(r['before']['log_loss'] - r['after']['log_loss']):.4f} log loss")

        # Save calibrator
        cal_path = f"models/calibrator_{name}.pkl"
        with open(cal_path, "wb") as f:
            pickle.dump(r["calibrator"], f)
        print(f"   Saved: {cal_path}")

    # Save metrics
    metrics = {
        name: {
            "before": r["before"],
            "after": r["after"],
            "improvement": {
                "log_loss": r["before"]["log_loss"] - r["after"]["log_loss"],
                "brier": r["before"]["brier"] - r["after"]["brier"],
            }
        }
        for name, r in results.items()
    }

    with open("models/calibration_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n" + "=" * 60)
    print("CALIBRATION COMPLETE")
    print("=" * 60)
    print(f"Best improvement: LightGBM log loss {metrics['lightgbm']['improvement']['log_loss']:.4f}")


if __name__ == "__main__":
    main()
