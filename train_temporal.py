#!/usr/bin/env python3
"""
Temporal Training Script for KKBOX Churn Prediction

Trains models with proper temporal splits:
- Training: Jan + Feb 2017 data (cutoffs: 2017-01-31, 2017-02-28)
- Validation: Mar 2017 data (cutoff: 2017-03-31)

This ensures no future data leaks into training.
"""

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score, brier_score_loss
from sklearn.preprocessing import LabelEncoder, StandardScaler

def load_window_features(window_files: list[str]) -> pd.DataFrame:
    """Load and concatenate multiple window feature files."""
    dfs = []
    for f in window_files:
        df = pd.read_csv(f)
        print(f"  Loaded {f}: {len(df):,} rows")
        dfs.append(df)
    combined = pd.concat(dfs, ignore_index=True)
    print(f"  Combined: {len(combined):,} rows")
    return combined

def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Prepare features, dropping metadata columns."""
    drop_cols = ["msno", "is_churn", "cutoff_ts", "window", "is_churn_label"]
    X = df.drop([c for c in drop_cols if c in df.columns], axis=1)
    y = df["is_churn"]

    # Encode categoricals
    for col in ["gender", "most_common_payment_method", "registered_via", "city"]:
        if col in X.columns:
            X[col] = LabelEncoder().fit_transform(X[col].astype(str).fillna("unknown"))

    X = X.fillna(0)
    return X, y

def train_and_evaluate():
    print("=" * 60)
    print("KKBOX Temporal Training Pipeline")
    print("=" * 60)

    # Define windows
    train_files = [
        "eval/features_2017-01-2017-02.csv",
        "eval/features_2017-02-2017-03.csv",
    ]
    val_file = "eval/features_2017-03-2017-04.csv"

    # Load data
    print("\n1. Loading Training Data (Jan + Feb 2017)")
    train_df = load_window_features(train_files)

    print("\n2. Loading Validation Data (Mar 2017)")
    val_df = pd.read_csv(val_file)
    print(f"  Loaded: {len(val_df):,} rows")

    # Prepare features
    print("\n3. Preparing Features")
    X_train, y_train = prepare_features(train_df)
    X_val, y_val = prepare_features(val_df)

    print(f"  Train: {X_train.shape[0]:,} samples, {X_train.shape[1]} features")
    print(f"  Val:   {X_val.shape[0]:,} samples, {X_val.shape[1]} features")
    print(f"  Train churn rate: {y_train.mean():.3f}")
    print(f"  Val churn rate:   {y_val.mean():.3f}")

    # Train models
    print("\n4. Training Models")

    models = {}
    metrics = {}

    # Logistic Regression
    print("  Training Logistic Regression...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(X_train_scaled, y_train)
    lr_pred = lr.predict_proba(X_val_scaled)[:, 1]

    models["logistic_regression"] = lr
    metrics["logistic_regression"] = {
        "log_loss": log_loss(y_val, lr_pred),
        "auc": roc_auc_score(y_val, lr_pred),
        "brier": brier_score_loss(y_val, lr_pred),
    }
    print(f"    AUC: {metrics['logistic_regression']['auc']:.4f}")

    # Random Forest
    print("  Training Random Forest...")
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    rf_pred = rf.predict_proba(X_val)[:, 1]

    models["random_forest"] = rf
    metrics["random_forest"] = {
        "log_loss": log_loss(y_val, rf_pred),
        "auc": roc_auc_score(y_val, rf_pred),
        "brier": brier_score_loss(y_val, rf_pred),
    }
    print(f"    AUC: {metrics['random_forest']['auc']:.4f}")

    # XGBoost
    print("  Training XGBoost...")
    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()

    xgb_model = xgb.XGBClassifier(
        objective="binary:logistic",
        max_depth=6,
        learning_rate=0.1,
        n_estimators=200,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1,
    )
    xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    xgb_pred = xgb_model.predict_proba(X_val)[:, 1]

    models["xgboost"] = xgb_model
    metrics["xgboost"] = {
        "log_loss": log_loss(y_val, xgb_pred),
        "auc": roc_auc_score(y_val, xgb_pred),
        "brier": brier_score_loss(y_val, xgb_pred),
    }
    print(f"    AUC: {metrics['xgboost']['auc']:.4f}")

    # LightGBM (Bryan Gregory used 12% LightGBM in winning ensemble)
    print("  Training LightGBM...")
    lgb_model = lgb.LGBMClassifier(
        objective="binary",
        max_depth=7,
        num_leaves=256,
        learning_rate=0.05,
        n_estimators=240,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    lgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)])
    lgb_pred = lgb_model.predict_proba(X_val)[:, 1]

    models["lightgbm"] = lgb_model
    metrics["lightgbm"] = {
        "log_loss": log_loss(y_val, lgb_pred),
        "auc": roc_auc_score(y_val, lgb_pred),
        "brier": brier_score_loss(y_val, lgb_pred),
    }
    print(f"    AUC: {metrics['lightgbm']['auc']:.4f}")

    # XGB + LGB Ensemble (88% XGB + 12% LGB as per winning solution)
    print("  Creating XGB+LGB Ensemble (88/12 weights)...")
    ensemble_pred = 0.88 * xgb_pred + 0.12 * lgb_pred

    metrics["xgb_lgb_ensemble"] = {
        "log_loss": log_loss(y_val, ensemble_pred),
        "auc": roc_auc_score(y_val, ensemble_pred),
        "brier": brier_score_loss(y_val, ensemble_pred),
    }
    print(f"    AUC: {metrics['xgb_lgb_ensemble']['auc']:.4f}")

    # Also try 50/50 ensemble
    ensemble_50_pred = 0.5 * xgb_pred + 0.5 * lgb_pred
    metrics["xgb_lgb_50_50"] = {
        "log_loss": log_loss(y_val, ensemble_50_pred),
        "auc": roc_auc_score(y_val, ensemble_50_pred),
        "brier": brier_score_loss(y_val, ensemble_50_pred),
    }
    print(f"    AUC (50/50): {metrics['xgb_lgb_50_50']['auc']:.4f}")

    # Save models
    print("\n5. Saving Models")
    output_dir = Path("models")
    output_dir.mkdir(exist_ok=True)

    for name, model in models.items():
        with open(output_dir / f"{name}.pkl", "wb") as f:
            pickle.dump(model, f)
        print(f"  Saved {name}.pkl")

    # Save XGBoost in native format using the booster
    models["xgboost"].get_booster().save_model(str(output_dir / "xgb.json"))
    print(f"  Saved xgb.json")

    # Save LightGBM in native format
    models["lightgbm"].booster_.save_model(str(output_dir / "lgb.txt"))
    print(f"  Saved lgb.txt")

    # Save scaler
    with open(output_dir / "scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    # Save metrics
    training_summary = {
        "split_type": "temporal",
        "train_windows": ["2017-01-2017-02", "2017-02-2017-03"],
        "val_window": "2017-03-2017-04",
        "train_samples": int(len(X_train)),
        "val_samples": int(len(X_val)),
        "train_churn_rate": float(y_train.mean()),
        "val_churn_rate": float(y_val.mean()),
        "feature_count": int(X_train.shape[1]),
        "models": {k: {kk: float(vv) for kk, vv in v.items()} for k, v in metrics.items()},
    }

    with open(output_dir / "training_metrics.json", "w") as f:
        json.dump(training_summary, f, indent=2)
    print("  Saved training_metrics.json")

    # Summary
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE - TEMPORAL SPLIT RESULTS")
    print("=" * 60)
    print(f"Train: Jan+Feb 2017 ({len(X_train):,} samples)")
    print(f"Val:   Mar 2017 ({len(X_val):,} samples)")
    print()
    print("Model Performance (Validation):")
    print("-" * 40)
    for name, m in metrics.items():
        print(f"  {name:20s} AUC: {m['auc']:.4f}  LogLoss: {m['log_loss']:.4f}")
    print()
    print("Best model by AUC:", max(metrics, key=lambda k: metrics[k]["auc"]))

    return metrics

if __name__ == "__main__":
    train_and_evaluate()
