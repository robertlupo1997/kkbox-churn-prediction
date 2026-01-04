#!/usr/bin/env python3
"""
Stacked ensemble with out-of-fold predictions.

Level 1: XGBoost, LightGBM, CatBoost base models
Level 2: Logistic regression meta-learner on OOF predictions

Usage:
    python src/stacking.py
"""

import json
import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from catboost import CatBoostClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import LabelEncoder


class StackedEnsemble:
    def __init__(self, n_folds: int = 5, random_state: int = 42):
        self.n_folds = n_folds
        self.random_state = random_state
        self.base_models = {}
        self.meta_model = None

    def _get_base_model_params(self, scale_pos_weight: float):
        """Load tuned params or use defaults."""
        params_path = Path("models/best_hyperparameters.json")
        if params_path.exists():
            with open(params_path) as f:
                tuned = json.load(f)
            print("  Loaded tuned hyperparameters from models/best_hyperparameters.json")
        else:
            tuned = {}
            print("  Using default hyperparameters")

        # XGBoost params
        xgb_params = tuned.get('xgboost', {
            'max_depth': 7,
            'learning_rate': 0.06,
            'n_estimators': 170,
        })
        xgb_params.update({
            'objective': 'binary:logistic',
            'scale_pos_weight': scale_pos_weight,
            'random_state': self.random_state,
            'n_jobs': -1,
        })

        # LightGBM params
        lgb_params = tuned.get('lightgbm', {
            'max_depth': 6,
            'learning_rate': 0.05,
            'n_estimators': 327,
            'num_leaves': 296,
        })
        lgb_params.update({
            'objective': 'binary',
            'scale_pos_weight': scale_pos_weight,
            'random_state': self.random_state,
            'n_jobs': -1,
            'verbose': -1,
        })

        # CatBoost params (not tuned, using reasonable defaults)
        cat_params = {
            'iterations': 200,
            'learning_rate': 0.1,
            'depth': 6,
            'l2_leaf_reg': 3,
            'loss_function': 'Logloss',
            'scale_pos_weight': scale_pos_weight,
            'random_seed': self.random_state,
            'verbose': False,
            'thread_count': -1,
        }

        return xgb_params, lgb_params, cat_params

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: list = None):
        """Train stacked ensemble with out-of-fold predictions."""
        scale_pos_weight = (y == 0).sum() / (y == 1).sum()
        xgb_params, lgb_params, cat_params = self._get_base_model_params(scale_pos_weight)

        n_samples = len(y)
        oof_preds = {
            'xgb': np.zeros(n_samples),
            'lgb': np.zeros(n_samples),
            'cat': np.zeros(n_samples),
        }

        self.base_models = {'xgb': [], 'lgb': [], 'cat': []}

        kfold = StratifiedKFold(n_splits=self.n_folds, shuffle=True, random_state=self.random_state)

        for fold, (train_idx, val_idx) in enumerate(kfold.split(X, y)):
            print(f"\n--- Fold {fold + 1}/{self.n_folds} ---")

            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            # XGBoost
            print("  Training XGBoost...")
            xgb_model = xgb.XGBClassifier(**xgb_params)
            xgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
            oof_preds['xgb'][val_idx] = xgb_model.predict_proba(X_val)[:, 1]
            self.base_models['xgb'].append(xgb_model)
            print(f"    XGB Fold AUC: {roc_auc_score(y_val, oof_preds['xgb'][val_idx]):.4f}")

            # LightGBM
            print("  Training LightGBM...")
            lgb_model = lgb.LGBMClassifier(**lgb_params)
            lgb_model.fit(X_train, y_train, eval_set=[(X_val, y_val)])
            oof_preds['lgb'][val_idx] = lgb_model.predict_proba(X_val)[:, 1]
            self.base_models['lgb'].append(lgb_model)
            print(f"    LGB Fold AUC: {roc_auc_score(y_val, oof_preds['lgb'][val_idx]):.4f}")

            # CatBoost
            print("  Training CatBoost...")
            cat_model = CatBoostClassifier(**cat_params)
            cat_model.fit(X_train, y_train, eval_set=(X_val, y_val))
            oof_preds['cat'][val_idx] = cat_model.predict_proba(X_val)[:, 1]
            self.base_models['cat'].append(cat_model)
            print(f"    CAT Fold AUC: {roc_auc_score(y_val, oof_preds['cat'][val_idx]):.4f}")

        # Stack OOF predictions
        meta_features = np.column_stack([
            oof_preds['xgb'],
            oof_preds['lgb'],
            oof_preds['cat'],
        ])

        # Train meta-model
        print("\n--- Training Meta-Learner ---")
        self.meta_model = LogisticRegression(random_state=self.random_state, max_iter=1000)
        self.meta_model.fit(meta_features, y)
        print(f"  Meta-learner coefficients: XGB={self.meta_model.coef_[0][0]:.3f}, "
              f"LGB={self.meta_model.coef_[0][1]:.3f}, CAT={self.meta_model.coef_[0][2]:.3f}")

        # Overall OOF AUC
        meta_pred = self.meta_model.predict_proba(meta_features)[:, 1]

        print(f"\n{'='*60}")
        print("OUT-OF-FOLD RESULTS (Training Data)")
        print('='*60)
        print(f"  XGBoost OOF AUC:      {roc_auc_score(y, oof_preds['xgb']):.4f}")
        print(f"  LightGBM OOF AUC:     {roc_auc_score(y, oof_preds['lgb']):.4f}")
        print(f"  CatBoost OOF AUC:     {roc_auc_score(y, oof_preds['cat']):.4f}")
        print(f"  Stacked OOF AUC:      {roc_auc_score(y, meta_pred):.4f}")
        print(f"  Stacked OOF Log Loss: {log_loss(y, meta_pred):.4f}")

        # Simple average comparison
        simple_avg = (oof_preds['xgb'] + oof_preds['lgb'] + oof_preds['cat']) / 3
        print(f"  Simple Average AUC:   {roc_auc_score(y, simple_avg):.4f}")

        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Generate predictions using trained ensemble."""
        # Get predictions from all fold models (average across folds)
        xgb_preds = np.mean([m.predict_proba(X)[:, 1] for m in self.base_models['xgb']], axis=0)
        lgb_preds = np.mean([m.predict_proba(X)[:, 1] for m in self.base_models['lgb']], axis=0)
        cat_preds = np.mean([m.predict_proba(X)[:, 1] for m in self.base_models['cat']], axis=0)

        # Stack and predict with meta-model
        meta_features = np.column_stack([xgb_preds, lgb_preds, cat_preds])
        return self.meta_model.predict_proba(meta_features)[:, 1]

    def save(self, path: str = "models/stacked_ensemble.pkl"):
        """Save the ensemble to disk."""
        with open(path, 'wb') as f:
            pickle.dump(self, f)
        print(f"  Saved ensemble to {path}")


def load_window_features(window_files: list) -> pd.DataFrame:
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


def main():
    """Train and evaluate stacked ensemble."""
    print("=" * 60)
    print("STACKED ENSEMBLE TRAINING")
    print("=" * 60)

    # Load data
    print("\n1. Loading Training Data (Jan + Feb 2017)")
    train_files = [
        "eval/features_2017-01-2017-02.csv",
        "eval/features_2017-02-2017-03.csv",
    ]
    val_file = "eval/features_2017-03-2017-04.csv"

    train_df = load_window_features(train_files)

    print("\n2. Loading Validation Data (Mar 2017)")
    val_df = pd.read_csv(val_file)
    print(f"  Loaded: {len(val_df):,} rows")

    # Prepare features
    print("\n3. Preparing Features")
    X_train, y_train = prepare_features(train_df)
    X_val, y_val = prepare_features(val_df)

    feature_names = X_train.columns.tolist()
    print(f"  Train: {X_train.shape[0]:,} samples, {X_train.shape[1]} features")
    print(f"  Val:   {X_val.shape[0]:,} samples, {X_val.shape[1]} features")
    print(f"  Train churn rate: {y_train.mean():.4f}")
    print(f"  Val churn rate:   {y_val.mean():.4f}")

    # Train stacked ensemble
    print("\n4. Training Stacked Ensemble (5-fold)")
    ensemble = StackedEnsemble(n_folds=5)
    ensemble.fit(X_train.values, y_train.values, feature_names=feature_names)

    # Evaluate on validation set
    print("\n5. Evaluating on Validation Set")
    val_pred = ensemble.predict_proba(X_val.values)
    val_auc = roc_auc_score(y_val, val_pred)
    val_logloss = log_loss(y_val, val_pred)

    # Also get individual model predictions on validation
    xgb_val_pred = np.mean([m.predict_proba(X_val.values)[:, 1] for m in ensemble.base_models['xgb']], axis=0)
    lgb_val_pred = np.mean([m.predict_proba(X_val.values)[:, 1] for m in ensemble.base_models['lgb']], axis=0)
    cat_val_pred = np.mean([m.predict_proba(X_val.values)[:, 1] for m in ensemble.base_models['cat']], axis=0)

    print(f"\n{'='*60}")
    print("FINAL VALIDATION RESULTS")
    print('='*60)
    print(f"  XGBoost AUC:          {roc_auc_score(y_val, xgb_val_pred):.4f}")
    print(f"  LightGBM AUC:         {roc_auc_score(y_val, lgb_val_pred):.4f}")
    print(f"  CatBoost AUC:         {roc_auc_score(y_val, cat_val_pred):.4f}")
    print(f"  Simple Average AUC:   {roc_auc_score(y_val, (xgb_val_pred + lgb_val_pred + cat_val_pred)/3):.4f}")
    print(f"  Stacked Ensemble AUC: {val_auc:.4f}")
    print(f"  Stacked Log Loss:     {val_logloss:.4f}")

    # Save ensemble
    print("\n6. Saving Ensemble")
    ensemble.save("models/stacked_ensemble.pkl")

    # Save validation predictions
    val_preds_df = pd.DataFrame({
        'msno': val_df['msno'],
        'is_churn': y_val,
        'xgb_pred': xgb_val_pred,
        'lgb_pred': lgb_val_pred,
        'cat_pred': cat_val_pred,
        'stacked_pred': val_pred,
    })
    val_preds_df.to_csv("eval/stacked_ensemble_predictions.csv", index=False)
    print("  Saved predictions to eval/stacked_ensemble_predictions.csv")

    # Save metrics
    metrics = {
        'n_folds': 5,
        'train_samples': int(len(X_train)),
        'val_samples': int(len(X_val)),
        'validation_results': {
            'xgboost_auc': float(roc_auc_score(y_val, xgb_val_pred)),
            'lightgbm_auc': float(roc_auc_score(y_val, lgb_val_pred)),
            'catboost_auc': float(roc_auc_score(y_val, cat_val_pred)),
            'simple_average_auc': float(roc_auc_score(y_val, (xgb_val_pred + lgb_val_pred + cat_val_pred)/3)),
            'stacked_ensemble_auc': float(val_auc),
            'stacked_ensemble_logloss': float(val_logloss),
        },
        'meta_learner_coefficients': {
            'xgboost': float(ensemble.meta_model.coef_[0][0]),
            'lightgbm': float(ensemble.meta_model.coef_[0][1]),
            'catboost': float(ensemble.meta_model.coef_[0][2]),
        }
    }

    with open('models/stacked_ensemble_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    print("  Saved metrics to models/stacked_ensemble_metrics.json")

    return ensemble


if __name__ == "__main__":
    main()
