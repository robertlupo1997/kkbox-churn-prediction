#!/usr/bin/env python3
"""
Tests for new ML engineering modules: temporal_cv and error_analysis.

These tests cover:
- Input validation
- Edge cases
- Basic functionality
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from temporal_cv import TemporalSplit, ChurnTemporalCV, BootstrapMetrics
from error_analysis import ChurnErrorAnalyzer


class TestTemporalSplit:
    """Tests for TemporalSplit class."""

    def test_basic_split(self):
        """Test basic temporal split functionality."""
        df = pd.DataFrame({
            'cutoff_ts': pd.date_range('2017-01-01', '2017-04-30', periods=100),
            'feature1': np.random.randn(100)
        })

        splitter = TemporalSplit(train_end='2017-03-01')
        train_idx, val_idx = splitter.split(df, 'cutoff_ts')

        # Train should be before March, val should be March onwards
        assert len(train_idx) > 0, "Train set should not be empty"
        assert len(val_idx) > 0, "Val set should not be empty"
        assert len(train_idx) + len(val_idx) == len(df), "All samples should be assigned"

        # Verify temporal ordering
        train_dates = df.iloc[train_idx]['cutoff_ts']
        val_dates = df.iloc[val_idx]['cutoff_ts']
        assert train_dates.max() < val_dates.min(), "Train dates should be before val dates"


class TestChurnTemporalCV:
    """Tests for ChurnTemporalCV class."""

    def test_fold_count(self):
        """Test that correct number of folds are generated."""
        cv = ChurnTemporalCV(months=['2017-01', '2017-02', '2017-03', '2017-04'])
        assert cv.get_n_splits() == 3, "Should have 3 folds for 4 months"

    def test_fold_descriptions(self):
        """Test fold description generation."""
        cv = ChurnTemporalCV(months=['2017-01', '2017-02', '2017-03'])
        descriptions = cv.get_fold_description()
        assert len(descriptions) == 2
        assert 'Train' in descriptions[0]
        assert 'Val' in descriptions[0]


class TestBootstrapMetrics:
    """Tests for BootstrapMetrics class."""

    def test_basic_bootstrap(self):
        """Test basic bootstrap computation."""
        np.random.seed(42)
        y_true = np.random.binomial(1, 0.3, 100)
        y_pred = np.clip(y_true + np.random.normal(0, 0.2, 100), 0.01, 0.99)

        bootstrap = BootstrapMetrics(n_bootstrap=50, random_state=42)
        results = bootstrap.compute(y_true, y_pred)

        # Check all metrics are present
        assert 'log_loss' in results
        assert 'auc' in results
        assert 'brier' in results

        # Check each metric has required keys
        for metric in results.values():
            assert 'mean' in metric
            assert 'std' in metric
            assert 'ci_lower' in metric
            assert 'ci_upper' in metric

        # CI should be valid
        for metric in results.values():
            assert metric['ci_lower'] <= metric['mean'] <= metric['ci_upper']

    def test_empty_input_raises(self):
        """Test that empty inputs raise ValueError."""
        bootstrap = BootstrapMetrics()
        try:
            bootstrap.compute(np.array([]), np.array([]))
            assert False, "Should raise ValueError for empty input"
        except ValueError as e:
            assert "empty" in str(e).lower()

    def test_length_mismatch_raises(self):
        """Test that mismatched lengths raise ValueError."""
        bootstrap = BootstrapMetrics()
        try:
            bootstrap.compute(np.array([0, 1, 0]), np.array([0.5, 0.5]))
            assert False, "Should raise ValueError for length mismatch"
        except ValueError as e:
            assert "mismatch" in str(e).lower()

    def test_invalid_probabilities_raises(self):
        """Test that invalid probabilities raise ValueError."""
        bootstrap = BootstrapMetrics()
        try:
            bootstrap.compute(np.array([0, 1, 0]), np.array([0.5, 1.5, 0.3]))
            assert False, "Should raise ValueError for invalid probabilities"
        except ValueError as e:
            assert "probabilities" in str(e).lower() or "[0, 1]" in str(e)

    def test_single_class_raises(self):
        """Test that single-class y_true raises ValueError."""
        bootstrap = BootstrapMetrics()
        try:
            bootstrap.compute(np.array([0, 0, 0]), np.array([0.5, 0.5, 0.5]))
            assert False, "Should raise ValueError for single class"
        except ValueError as e:
            assert "class" in str(e).lower()


class TestChurnErrorAnalyzer:
    """Tests for ChurnErrorAnalyzer class."""

    def test_basic_analysis(self):
        """Test basic error analysis."""
        np.random.seed(42)
        n = 100

        features_df = pd.DataFrame({
            'msno': [f'user_{i}' for i in range(n)],
            'feature1': np.random.randn(n),
            'feature2': np.random.randn(n)
        })

        y_true = np.random.binomial(1, 0.3, n)
        y_pred = np.clip(y_true * 0.7 + np.random.uniform(0, 0.3, n), 0, 1)

        analyzer = ChurnErrorAnalyzer(threshold=0.5)
        results = analyzer.analyze(y_true, y_pred, features_df)

        # Check all sections present
        assert 'summary' in results
        assert 'confidence_analysis' in results
        assert 'segment_analysis' in results
        assert 'business_impact' in results
        assert 'recommendations' in results

        # Check summary contents
        assert 'n_samples' in results['summary']
        assert results['summary']['n_samples'] == n

    def test_empty_input_raises(self):
        """Test that empty inputs raise ValueError."""
        analyzer = ChurnErrorAnalyzer()
        try:
            analyzer.analyze(np.array([]), np.array([]), pd.DataFrame())
            assert False, "Should raise ValueError for empty input"
        except ValueError as e:
            assert "empty" in str(e).lower()

    def test_length_mismatch_raises(self):
        """Test that mismatched lengths raise ValueError."""
        analyzer = ChurnErrorAnalyzer()
        features_df = pd.DataFrame({'x': [1, 2, 3]})
        try:
            analyzer.analyze(np.array([0, 1]), np.array([0.5, 0.5]), features_df)
            assert False, "Should raise ValueError for length mismatch"
        except ValueError as e:
            assert "mismatch" in str(e).lower() or "length" in str(e).lower()


def run_tests():
    """Run all tests and report results."""
    test_classes = [
        TestTemporalSplit,
        TestChurnTemporalCV,
        TestBootstrapMetrics,
        TestChurnErrorAnalyzer
    ]

    total_passed = 0
    total_failed = 0

    for test_class in test_classes:
        print(f"\n{'='*50}")
        print(f"Testing {test_class.__name__}")
        print('='*50)

        instance = test_class()
        methods = [m for m in dir(instance) if m.startswith('test_')]

        for method_name in methods:
            try:
                getattr(instance, method_name)()
                print(f"  ✅ {method_name}")
                total_passed += 1
            except Exception as e:
                print(f"  ❌ {method_name}: {e}")
                total_failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {total_passed} passed, {total_failed} failed")
    print('='*50)

    return total_failed == 0


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
