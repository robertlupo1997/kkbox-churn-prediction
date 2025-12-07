"""
KKBOX Churn Prediction Model Training Pipeline

Implements baseline models and XGBoost with comprehensive evaluation metrics.
Follows temporal safeguards and official competition standards.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import pickle
import warnings
from typing import Dict, Tuple, Any, Optional
import json
from datetime import datetime

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# Import temporal CV utilities (try both relative and absolute imports)
HAS_TEMPORAL_CV = False
try:
    from src.temporal_cv import TemporalSplit, ChurnTemporalCV, BootstrapMetrics
    HAS_TEMPORAL_CV = True
except ImportError:
    try:
        from temporal_cv import TemporalSplit, ChurnTemporalCV, BootstrapMetrics
        HAS_TEMPORAL_CV = True
    except ImportError:
        pass  # Will use fallback random splits
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    log_loss, roc_auc_score, precision_recall_curve, 
    classification_report, confusion_matrix
)
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.dummy import DummyClassifier
import xgboost as xgb

warnings.filterwarnings('ignore')

class ModelTrainer:
    """
    KKBOX churn prediction model trainer with temporal safety validation.
    
    Implements:
    - Baseline models (dummy, logistic regression, random forest)
    - XGBoost with hyperparameter optimization
    - Comprehensive evaluation with competition metrics
    - Model persistence and metadata tracking
    """
    
    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.models = {}
        self.metrics = {}
        self.feature_encoders = {}
        self.scaler = StandardScaler()
        
    def prepare_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Prepare features for model training with proper encoding.
        
        Args:
            df: Feature dataframe with target column 'is_churn'
            
        Returns:
            X: Processed features
            y: Target variable
        """
        # Separate features and target
        X = df.drop(['msno', 'is_churn', 'cutoff_ts'], axis=1, errors='ignore')
        y = df['is_churn']
        
        # Handle categorical features
        categorical_features = ['gender', 'payment_method_latest', 'registered_via', 'city']
        
        for col in categorical_features:
            if col in X.columns:
                if col not in self.feature_encoders:
                    self.feature_encoders[col] = LabelEncoder()
                    X[col] = self.feature_encoders[col].fit_transform(
                        X[col].astype(str).fillna('unknown')
                    )
                else:
                    X[col] = self.feature_encoders[col].transform(
                        X[col].astype(str).fillna('unknown')
                    )
        
        # Fill remaining nulls
        X = X.fillna(0)
        
        return X, y
    
    def train_baseline_models(self, X_train: pd.DataFrame, y_train: pd.Series, 
                            X_val: pd.DataFrame, y_val: pd.Series) -> Dict[str, Any]:
        """
        Train baseline models for comparison.
        
        Returns:
            metrics: Performance metrics for all baseline models
        """
        baseline_metrics = {}
        
        # 1. Dummy classifier (most frequent class)
        dummy = DummyClassifier(strategy='most_frequent', random_state=self.random_state)
        dummy.fit(X_train, y_train)
        
        dummy_pred = dummy.predict_proba(X_val)[:, 1]
        baseline_metrics['dummy_most_frequent'] = {
            'log_loss': log_loss(y_val, dummy_pred),
            'auc': roc_auc_score(y_val, dummy_pred),
            'model_type': 'baseline'
        }
        
        # 2. Dummy classifier (stratified)
        dummy_strat = DummyClassifier(strategy='stratified', random_state=self.random_state)
        dummy_strat.fit(X_train, y_train)
        
        dummy_strat_pred = dummy_strat.predict_proba(X_val)[:, 1]
        baseline_metrics['dummy_stratified'] = {
            'log_loss': log_loss(y_val, dummy_strat_pred),
            'auc': roc_auc_score(y_val, dummy_strat_pred),
            'model_type': 'baseline'
        }
        
        # 3. Logistic Regression
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        logreg = LogisticRegression(
            random_state=self.random_state,
            max_iter=1000,
            class_weight='balanced'
        )
        logreg.fit(X_train_scaled, y_train)
        
        logreg_pred = logreg.predict_proba(X_val_scaled)[:, 1]
        baseline_metrics['logistic_regression'] = {
            'log_loss': log_loss(y_val, logreg_pred),
            'auc': roc_auc_score(y_val, logreg_pred),
            'model_type': 'linear'
        }
        
        # 4. Random Forest
        rf = RandomForestClassifier(
            n_estimators=100,
            random_state=self.random_state,
            class_weight='balanced',
            n_jobs=-1
        )
        rf.fit(X_train, y_train)
        
        rf_pred = rf.predict_proba(X_val)[:, 1]
        baseline_metrics['random_forest'] = {
            'log_loss': log_loss(y_val, rf_pred),
            'auc': roc_auc_score(y_val, rf_pred),
            'model_type': 'ensemble'
        }
        
        # Store models
        self.models.update({
            'dummy_most_frequent': dummy,
            'dummy_stratified': dummy_strat,
            'logistic_regression': logreg,
            'random_forest': rf
        })
        
        return baseline_metrics
    
    def train_xgboost(self, X_train: pd.DataFrame, y_train: pd.Series,
                     X_val: pd.DataFrame, y_val: pd.Series) -> Dict[str, Any]:
        """
        Train XGBoost model with competition-optimized hyperparameters.
        
        Returns:
            metrics: XGBoost performance metrics and feature importance
        """
        # Calculate scale_pos_weight for class imbalance
        scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
        
        # XGBoost hyperparameters optimized for log loss
        xgb_params = {
            'objective': 'binary:logistic',
            'eval_metric': 'logloss',
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 200,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'scale_pos_weight': scale_pos_weight,
            'random_state': self.random_state,
            'n_jobs': -1
        }
        
        # Train with early stopping
        xgb_model = xgb.XGBClassifier(**xgb_params)
        
        xgb_model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False
        )
        
        # Predictions
        xgb_pred = xgb_model.predict_proba(X_val)[:, 1]
        
        # Feature importance
        feature_importance = dict(zip(
            X_train.columns, 
            xgb_model.feature_importances_
        ))
        
        # Sort by importance
        feature_importance = dict(
            sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        )
        
        xgb_metrics = {
            'log_loss': log_loss(y_val, xgb_pred),
            'auc': roc_auc_score(y_val, xgb_pred),
            'feature_importance': feature_importance,
            'model_type': 'gradient_boosting',
            'best_iteration': xgb_model.best_iteration if hasattr(xgb_model, 'best_iteration') else len(xgb_model.evals_result()['validation_0']['logloss'])
        }
        
        self.models['xgboost'] = xgb_model
        
        return xgb_metrics
    
    def evaluate_model(self, model_name: str, X_test: pd.DataFrame, 
                      y_test: pd.Series) -> Dict[str, Any]:
        """
        Comprehensive model evaluation with competition metrics.
        """
        model = self.models[model_name]
        
        # Handle scaling for logistic regression
        if model_name == 'logistic_regression':
            X_test_processed = self.scaler.transform(X_test)
        else:
            X_test_processed = X_test
        
        # Predictions
        pred_proba = model.predict_proba(X_test_processed)[:, 1]
        pred_binary = model.predict(X_test_processed)
        
        # Core metrics
        metrics = {
            'log_loss': log_loss(y_test, pred_proba),
            'auc': roc_auc_score(y_test, pred_proba),
            'accuracy': (pred_binary == y_test).mean()
        }
        
        # Precision-Recall metrics
        precision, recall, thresholds = precision_recall_curve(y_test, pred_proba)
        f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
        best_f1_idx = np.argmax(f1_scores)
        
        metrics.update({
            'best_f1': f1_scores[best_f1_idx],
            'best_threshold': thresholds[best_f1_idx],
            'precision_at_best_f1': precision[best_f1_idx],
            'recall_at_best_f1': recall[best_f1_idx]
        })
        
        # Confusion matrix at best F1 threshold
        pred_binary_f1 = (pred_proba >= thresholds[best_f1_idx]).astype(int)
        cm = confusion_matrix(y_test, pred_binary_f1)
        
        metrics['confusion_matrix'] = {
            'tn': int(cm[0, 0]), 'fp': int(cm[0, 1]),
            'fn': int(cm[1, 0]), 'tp': int(cm[1, 1])
        }
        
        return metrics
    
    def save_models(self, output_dir: str) -> None:
        """Save trained models and metadata with harmonized formats."""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Save models with format harmonization
        for name, model in self.models.items():
            # Primary format: pickle
            model_path = output_path / f"{name}.pkl"
            with open(model_path, 'wb') as f:
                pickle.dump(model, f)
            
            # Special handling for XGBoost: save both JSON and PKL formats
            if name == 'xgboost':
                try:
                    json_path = output_path / "xgboost.json"
                    model.save_model(str(json_path))
                    print(f"  XGBoost saved in both formats: .pkl and .json")
                except Exception as e:
                    print(f"  Warning: Could not save XGBoost JSON format: {e}")
            
            # Use joblib for scikit-learn models (better compatibility)
            if name in ['random_forest', 'logistic_regression']:
                try:
                    import joblib
                    joblib_path = output_path / f"{name}_joblib.pkl"
                    joblib.dump(model, joblib_path)
                    print(f"  {name} saved with joblib compatibility")
                except ImportError:
                    pass  # joblib not available, pickle is fine
        
        # Save feature encoders and scaler
        with open(output_path / "feature_encoders.pkl", 'wb') as f:
            pickle.dump(self.feature_encoders, f)
        
        with open(output_path / "scaler.pkl", 'wb') as f:
            pickle.dump(self.scaler, f)
        
        # Save metrics
        with open(output_path / "training_metrics.json", 'w') as f:
            json.dump(self.metrics, f, indent=2, default=str)
        
        print(f"Models and metadata saved to {output_path}")

def run_training_pipeline(features_path: str, output_dir: str = "models",
                         use_temporal_split: bool = True,
                         train_cutoff: str = "2017-02-01") -> Dict[str, Any]:
    """
    Execute complete model training pipeline.

    Args:
        features_path: Path to processed features CSV
        output_dir: Directory to save models and results
        use_temporal_split: If True, use time-based train/val split (recommended).
                           If False, use random stratified split.
        train_cutoff: Date cutoff for temporal split (training uses data before this date)

    Returns:
        comprehensive_metrics: All model performance metrics
    """
    print("🚀 Starting KKBOX Churn Model Training Pipeline")

    # Load features
    print(f"📊 Loading features from {features_path}")
    df = pd.read_csv(features_path)

    # Validate temporal safety
    print(f"🔍 Validating data: {len(df)} samples, {df['is_churn'].mean():.3f} churn rate")

    # Initialize trainer
    trainer = ModelTrainer(random_state=42)

    # Prepare features (keep original df for temporal splitting)
    X, y = trainer.prepare_features(df)
    print(f"✅ Features prepared: {X.shape[1]} features, {len(X)} samples")

    # Train/validation split
    if use_temporal_split and HAS_TEMPORAL_CV and 'cutoff_ts' in df.columns:
        print(f"📅 Using TEMPORAL split (cutoff: {train_cutoff})")
        splitter = TemporalSplit(train_end=train_cutoff)
        train_idx, val_idx = splitter.split(df, time_column='cutoff_ts')

        if len(train_idx) == 0 or len(val_idx) == 0:
            print("⚠️ Temporal split failed (insufficient data), falling back to random split")
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
        else:
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
    else:
        print("📅 Using RANDOM stratified split (consider temporal split for production)")
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    
    print(f"📊 Train: {len(X_train)} samples, Val: {len(X_val)} samples")
    
    # Train baseline models
    print("🔄 Training baseline models...")
    baseline_metrics = trainer.train_baseline_models(X_train, y_train, X_val, y_val)
    
    # Train XGBoost
    print("🔄 Training XGBoost...")
    xgb_metrics = trainer.train_xgboost(X_train, y_train, X_val, y_val)
    
    # Combine all metrics
    all_metrics = {**baseline_metrics, 'xgboost': xgb_metrics}
    trainer.metrics = all_metrics
    
    # Print results
    print("\n📊 Model Performance Summary (Log Loss | AUC):")
    print("=" * 50)
    for model_name, metrics in all_metrics.items():
        log_loss_val = metrics['log_loss']
        auc_val = metrics['auc']
        print(f"{model_name:20s}: {log_loss_val:.4f} | {auc_val:.4f}")
    
    # Identify best model
    best_model = min(all_metrics.keys(), key=lambda k: all_metrics[k]['log_loss'])
    print(f"\n🏆 Best model (Log Loss): {best_model}")
    
    # Save everything
    trainer.save_models(output_dir)
    
    # Compute bootstrap confidence intervals for best model
    bootstrap_ci = None
    if HAS_TEMPORAL_CV:
        try:
            print("\n📊 Computing bootstrap confidence intervals...")
            best_model_obj = trainer.models[best_model]

            # Get predictions for bootstrap
            if best_model == 'logistic_regression':
                X_val_processed = trainer.scaler.transform(X_val)
            else:
                X_val_processed = X_val.values if hasattr(X_val, 'values') else X_val

            y_val_pred = best_model_obj.predict_proba(X_val_processed)[:, 1]

            bootstrap = BootstrapMetrics(n_bootstrap=500, random_state=42)
            bootstrap_ci = bootstrap.compute(y_val.values, y_val_pred)

            print(f"  Log Loss: {bootstrap_ci['log_loss']['mean']:.4f} "
                  f"({bootstrap_ci['log_loss']['ci_lower']:.4f} - {bootstrap_ci['log_loss']['ci_upper']:.4f})")
            print(f"  AUC: {bootstrap_ci['auc']['mean']:.4f} "
                  f"({bootstrap_ci['auc']['ci_lower']:.4f} - {bootstrap_ci['auc']['ci_upper']:.4f})")
        except Exception as e:
            print(f"  ⚠️ Bootstrap CI computation failed: {e}")

    # Add training metadata
    training_summary = {
        'timestamp': datetime.now().isoformat(),
        'dataset_size': len(df),
        'feature_count': X.shape[1],
        'churn_rate': float(y.mean()),
        'best_model': best_model,
        'best_log_loss': float(all_metrics[best_model]['log_loss']),
        'best_auc': float(all_metrics[best_model]['auc']),
        'models_trained': list(all_metrics.keys()),
        'split_type': 'temporal' if (use_temporal_split and HAS_TEMPORAL_CV) else 'random',
        'bootstrap_ci': bootstrap_ci
    }

    return {
        'metrics': all_metrics,
        'summary': training_summary,
        'trainer': trainer
    }

if __name__ == "__main__":
    # Example usage
    features_path = "features/features_processed.csv" 
    results = run_training_pipeline(features_path)
    print("✅ Training pipeline completed!")