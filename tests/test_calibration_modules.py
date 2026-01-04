#!/usr/bin/env python3
"""
Tests for calibration, stacking, and hyperparameter tuning modules.

These tests verify that modules can be imported and key classes/functions exist.
"""

import pytest


class TestCalibrateAndEvaluate:
    """Tests for src/calibrate_and_evaluate.py module."""

    def test_module_imports(self):
        """Test that the module can be imported."""
        from src import calibrate_and_evaluate

        assert calibrate_and_evaluate is not None

    def test_load_validation_data_exists(self):
        """Test that load_validation_data function exists."""
        from src.calibrate_and_evaluate import load_validation_data

        assert callable(load_validation_data)

    def test_calibrate_model_exists(self):
        """Test that calibrate_model function exists."""
        from src.calibrate_and_evaluate import calibrate_model

        assert callable(calibrate_model)

    def test_main_exists(self):
        """Test that main function exists."""
        from src.calibrate_and_evaluate import main

        assert callable(main)


class TestStacking:
    """Tests for src/stacking.py module."""

    def test_module_imports(self):
        """Test that the module can be imported."""
        from src import stacking

        assert stacking is not None

    def test_stacked_ensemble_class_exists(self):
        """Test that StackedEnsemble class exists."""
        from src.stacking import StackedEnsemble

        assert StackedEnsemble is not None

    def test_stacked_ensemble_instantiation(self):
        """Test that StackedEnsemble can be instantiated."""
        from src.stacking import StackedEnsemble

        ensemble = StackedEnsemble(n_folds=3, random_state=42)
        assert ensemble.n_folds == 3
        assert ensemble.random_state == 42

    def test_stacked_ensemble_has_fit_method(self):
        """Test that StackedEnsemble has fit method."""
        from src.stacking import StackedEnsemble

        ensemble = StackedEnsemble()
        assert hasattr(ensemble, "fit")
        assert callable(ensemble.fit)

    def test_stacked_ensemble_has_predict_proba_method(self):
        """Test that StackedEnsemble has predict_proba method."""
        from src.stacking import StackedEnsemble

        ensemble = StackedEnsemble()
        assert hasattr(ensemble, "predict_proba")
        assert callable(ensemble.predict_proba)

    def test_stacked_ensemble_has_save_method(self):
        """Test that StackedEnsemble has save method."""
        from src.stacking import StackedEnsemble

        ensemble = StackedEnsemble()
        assert hasattr(ensemble, "save")
        assert callable(ensemble.save)

    def test_load_window_features_exists(self):
        """Test that load_window_features function exists."""
        from src.stacking import load_window_features

        assert callable(load_window_features)

    def test_prepare_features_exists(self):
        """Test that prepare_features function exists."""
        from src.stacking import prepare_features

        assert callable(prepare_features)


class TestHyperparameterTuning:
    """Tests for src/hyperparameter_tuning.py module."""

    def test_module_imports(self):
        """Test that the module can be imported."""
        from src import hyperparameter_tuning

        assert hyperparameter_tuning is not None

    def test_load_data_exists(self):
        """Test that load_data function exists."""
        from src.hyperparameter_tuning import load_data

        assert callable(load_data)

    def test_prepare_features_exists(self):
        """Test that prepare_features function exists."""
        from src.hyperparameter_tuning import prepare_features

        assert callable(prepare_features)

    def test_objective_xgb_exists(self):
        """Test that objective_xgb function exists."""
        from src.hyperparameter_tuning import objective_xgb

        assert callable(objective_xgb)

    def test_objective_lgb_exists(self):
        """Test that objective_lgb function exists."""
        from src.hyperparameter_tuning import objective_lgb

        assert callable(objective_lgb)

    def test_run_tuning_exists(self):
        """Test that run_tuning function exists."""
        from src.hyperparameter_tuning import run_tuning

        assert callable(run_tuning)
