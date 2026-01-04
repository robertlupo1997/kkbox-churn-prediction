#!/usr/bin/env python3
"""
Hyperparameter optimization using Optuna.

Optimizes:
1. XGBoost parameters
2. LightGBM parameters

Usage:
    python src/hyperparameter_tuning.py --n-trials 100
"""

import argparse
import json
from pathlib import Path

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import LabelEncoder


def load_data():
    """Load training and validation data."""
    train_files = [
        "eval/features_2017-01-2017-02.csv",
        "eval/features_2017-02-2017-03.csv",
    ]
    val_file = "eval/features_2017-03-2017-04.csv"

    train_dfs = [pd.read_csv(f) for f in train_files]
    train_df = pd.concat(train_dfs, ignore_index=True)
    val_df = pd.read_csv(val_file)

    return train_df, val_df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Prepare features for modeling."""
    drop_cols = ["msno", "is_churn", "cutoff_ts", "window", "is_churn_label"]
    X = df.drop([c for c in drop_cols if c in df.columns], axis=1)
    y = df["is_churn"]

    # Encode categoricals
    for col in ["gender", "most_common_payment_method", "registered_via", "city"]:
        if col in X.columns:
            X[col] = LabelEncoder().fit_transform(X[col].astype(str).fillna("unknown"))

    X = X.fillna(0)
    return X, y


def objective_xgb(trial, X_train, y_train, X_val, y_val, scale_pos_weight):
    """Optuna objective for XGBoost."""
    params = {
        'objective': 'binary:logistic',
        'eval_metric': 'logloss',
        'max_depth': trial.suggest_int('max_depth', 4, 10),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'n_estimators': trial.suggest_int('n_estimators', 100, 500),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        'scale_pos_weight': scale_pos_weight,
        'random_state': 42,
        'n_jobs': -1,
    }

    model = xgb.XGBClassifier(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )

    y_pred = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, y_pred)

    return auc


def objective_lgb(trial, X_train, y_train, X_val, y_val, scale_pos_weight):
    """Optuna objective for LightGBM."""
    params = {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'max_depth': trial.suggest_int('max_depth', 4, 10),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'n_estimators': trial.suggest_int('n_estimators', 100, 500),
        'num_leaves': trial.suggest_int('num_leaves', 31, 512),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        'scale_pos_weight': scale_pos_weight,
        'random_state': 42,
        'n_jobs': -1,
        'verbose': -1,
    }

    model = lgb.LGBMClassifier(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)]
    )

    y_pred = model.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, y_pred)

    return auc


def run_tuning(n_trials: int = 100):
    """Run hyperparameter tuning for XGBoost and LightGBM."""
    print("Loading data...")
    train_df, val_df = load_data()

    print("Preparing features...")
    X_train, y_train = prepare_features(train_df)
    X_val, y_val = prepare_features(val_df)

    print(f"Train: {X_train.shape}, Val: {X_val.shape}")
    print(f"Train churn rate: {y_train.mean():.4f}")
    print(f"Val churn rate: {y_val.mean():.4f}")

    # Calculate class weight for imbalanced data
    scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    print(f"Scale pos weight: {scale_pos_weight:.2f}")

    # Tune XGBoost
    print(f"\n{'='*60}")
    print("Tuning XGBoost...")
    print('='*60)

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study_xgb = optuna.create_study(direction='maximize')
    study_xgb.optimize(
        lambda trial: objective_xgb(trial, X_train, y_train, X_val, y_val, scale_pos_weight),
        n_trials=n_trials,
        show_progress_bar=True
    )

    print(f"\nBest XGBoost AUC: {study_xgb.best_value:.4f}")
    print(f"Best XGBoost params: {study_xgb.best_params}")

    # Tune LightGBM
    print(f"\n{'='*60}")
    print("Tuning LightGBM...")
    print('='*60)

    study_lgb = optuna.create_study(direction='maximize')
    study_lgb.optimize(
        lambda trial: objective_lgb(trial, X_train, y_train, X_val, y_val, scale_pos_weight),
        n_trials=n_trials,
        show_progress_bar=True
    )

    print(f"\nBest LightGBM AUC: {study_lgb.best_value:.4f}")
    print(f"Best LightGBM params: {study_lgb.best_params}")

    # Save best params
    best_params = {
        'xgboost': study_xgb.best_params,
        'xgboost_auc': study_xgb.best_value,
        'lightgbm': study_lgb.best_params,
        'lightgbm_auc': study_lgb.best_value,
    }

    output_path = Path('models/best_hyperparameters.json')
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(best_params, f, indent=2)

    print(f"\nSaved best parameters to {output_path}")

    # Summary
    print(f"\n{'='*60}")
    print("HYPERPARAMETER TUNING COMPLETE")
    print('='*60)
    print(f"XGBoost Best AUC: {study_xgb.best_value:.4f}")
    print(f"LightGBM Best AUC: {study_lgb.best_value:.4f}")

    return best_params


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hyperparameter tuning with Optuna")
    parser.add_argument('--n-trials', type=int, default=100,
                        help='Number of trials for each model (default: 100)')
    args = parser.parse_args()

    run_tuning(args.n_trials)
