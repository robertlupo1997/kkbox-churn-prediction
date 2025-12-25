#!/usr/bin/env python3
"""
Comprehensive tests for KKBOX 30-day churn rule implementation.

Tests cover:
- Basic churn rule logic
- Edge cases (same-day renewals, long gaps)
- Date parsing and boundary conditions
- Validation against official labels
- Error handling for malformed data
"""

import os

# Add src to path for imports
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest

sys.path.append(str(Path(__file__).parent.parent / "src"))

from labels import analyze_mismatches, create_churn_labels, validate_labels


class TestChurnLabels:
    """Test suite for 30-day churn rule implementation."""

    @pytest.fixture
    def sample_transactions(self):
        """Create sample transaction data for testing."""
        data = [
            # User 1: Churns - expires 2017-02-15, no renewal within 30 days
            {
                "msno": "user1",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            # User 2: Renews - expires 2017-02-15, renews on 2017-02-20 (5 days later)
            {
                "msno": "user2",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user2",
                "membership_expire_date": "20170320",
                "transaction_date": "20170220",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            # User 3: Edge case - renews on exactly day 30 (should not be churn)
            {
                "msno": "user3",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user3",
                "membership_expire_date": "20170320",
                "transaction_date": "20170317",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            # User 4: Late renewal (day 31 - should be churn)
            {
                "msno": "user4",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user4",
                "membership_expire_date": "20170320",
                "transaction_date": "20170318",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            # User 5: Cancellation within window (should still be churn)
            {
                "msno": "user5",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user5",
                "membership_expire_date": "20170320",
                "transaction_date": "20170220",
                "payment_plan_days": 0,
                "is_auto_renew": 0,
                "is_cancel": 1,
            },
        ]
        return pd.DataFrame(data)

    @pytest.fixture
    def sample_official_labels(self):
        """Create sample official labels for validation."""
        data = [
            {"msno": "user1", "is_churn": 1},
            {"msno": "user2", "is_churn": 0},
            {"msno": "user3", "is_churn": 0},
            {"msno": "user4", "is_churn": 1},
            {"msno": "user5", "is_churn": 1},
        ]
        return pd.DataFrame(data)

    def test_basic_churn_rule(self, sample_transactions, sample_official_labels):
        """Test basic 30-day churn rule logic."""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            sample_transactions.to_csv(f.name, index=False)
            tx_path = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            sample_official_labels.to_csv(f.name, index=False)
            labels_path = f.name

        try:
            result = create_churn_labels(
                transactions_path=tx_path,
                train_labels_path=labels_path,
                cutoff_date="2017-03-01",
                window_days=30,
            )

            # Check that all users are present
            assert len(result) == 5
            assert set(result["msno"]) == {"user1", "user2", "user3", "user4", "user5"}

            # Check churn labels
            user_labels = result.set_index("msno")["is_churn"].to_dict()

            assert user_labels["user1"] == 1, "User1 should churn (no renewal)"
            assert user_labels["user2"] == 0, "User2 should not churn (renewed day 5)"
            assert user_labels["user3"] == 0, "User3 should not churn (renewed day 30)"
            assert user_labels["user4"] == 1, "User4 should churn (renewed day 31)"
            assert user_labels["user5"] == 1, "User5 should churn (cancellation, not renewal)"

        finally:
            os.unlink(tx_path)
            os.unlink(labels_path)

    def test_validation_accuracy(self, sample_transactions, sample_official_labels):
        """Test label validation against official labels."""

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            sample_transactions.to_csv(f.name, index=False)
            tx_path = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            sample_official_labels.to_csv(f.name, index=False)
            labels_path = f.name

        try:
            result = create_churn_labels(tx_path, labels_path, "2017-03-01")

            # Should achieve 100% accuracy on this test case
            accuracy, matches, total = validate_labels(result, min_accuracy=0.99)

            assert accuracy == 1.0, f"Expected 100% accuracy, got {accuracy:.4f}"
            assert matches == 5, f"Expected 5 matches, got {matches}"
            assert total == 5, f"Expected 5 comparable, got {total}"

        finally:
            os.unlink(tx_path)
            os.unlink(labels_path)

    def test_edge_case_same_day_renewal(self):
        """Test edge case: renewal on same day as expiration."""

        tx_data = [
            {
                "msno": "user1",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user1",
                "membership_expire_date": "20170320",
                "transaction_date": "20170215",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
        ]

        official_data = [{"msno": "user1", "is_churn": 0}]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(tx_data).to_csv(f.name, index=False)
            tx_path = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(official_data).to_csv(f.name, index=False)
            labels_path = f.name

        try:
            result = create_churn_labels(tx_path, labels_path, "2017-03-01")

            # Same day renewal should NOT be churn (renewal is after expiration)
            assert result.iloc[0]["is_churn"] == 0, "Same-day renewal should not be churn"

        finally:
            os.unlink(tx_path)
            os.unlink(labels_path)

    def test_multiple_expirations_per_user(self):
        """Test users with multiple expiration dates - should use the last one."""

        tx_data = [
            # Multiple expirations for same user
            {
                "msno": "user1",
                "membership_expire_date": "20170115",
                "transaction_date": "20170101",
                "payment_plan_days": 15,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user1",
                "membership_expire_date": "20170215",
                "transaction_date": "20170116",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            # No renewal after 2017-02-15
        ]

        official_data = [{"msno": "user1", "is_churn": 1}]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(tx_data).to_csv(f.name, index=False)
            tx_path = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(official_data).to_csv(f.name, index=False)
            labels_path = f.name

        try:
            result = create_churn_labels(tx_path, labels_path, "2017-03-01")

            # Should use latest expiration date (2017-02-15)
            assert result.iloc[0]["expire_date"].strftime("%Y-%m-%d") == "2017-02-15"
            assert result.iloc[0]["is_churn"] == 1, "User should churn from latest expiration"

        finally:
            os.unlink(tx_path)
            os.unlink(labels_path)

    def test_malformed_dates(self):
        """Test handling of malformed date data."""

        tx_data = [
            {
                "msno": "user1",
                "membership_expire_date": "20170215",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user2",
                "membership_expire_date": None,
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
            {
                "msno": "user3",
                "membership_expire_date": "invalid",
                "transaction_date": "20170101",
                "payment_plan_days": 30,
                "is_auto_renew": 0,
                "is_cancel": 0,
            },
        ]

        official_data = [{"msno": "user1", "is_churn": 1}]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(tx_data).to_csv(f.name, index=False)
            tx_path = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            pd.DataFrame(official_data).to_csv(f.name, index=False)
            labels_path = f.name

        try:
            result = create_churn_labels(tx_path, labels_path, "2017-03-01")

            # Should only include user1 (valid date)
            assert len(result) == 1
            assert result.iloc[0]["msno"] == "user1"

        finally:
            os.unlink(tx_path)
            os.unlink(labels_path)

    def test_file_not_found_error(self):
        """Test error handling for missing files."""

        with pytest.raises(FileNotFoundError, match="Transactions file not found"):
            create_churn_labels(
                transactions_path="nonexistent_transactions.csv",
                train_labels_path="nonexistent_labels.csv",
            )

    def test_low_accuracy_error(self):
        """Test validation error when accuracy is too low."""

        # Create mismatched labels
        labels_data = pd.DataFrame(
            {
                "msno": ["user1", "user2"],
                "is_churn": [1, 0],  # Generated labels
                "official_is_churn": [0, 1],  # Opposite official labels
                "expire_date": ["2017-02-15", "2017-02-15"],
                "next_renewal_date": [None, None],
            }
        )

        with pytest.raises(ValueError, match="Label accuracy .* below required"):
            validate_labels(labels_data, min_accuracy=0.99)

    def test_no_comparable_labels_error(self):
        """Test validation error when no official labels are available."""

        labels_data = pd.DataFrame(
            {
                "msno": ["user1", "user2"],
                "is_churn": [1, 0],
                "official_is_churn": [None, None],  # No official labels
                "expire_date": ["2017-02-15", "2017-02-15"],
                "next_renewal_date": [None, None],
            }
        )

        with pytest.raises(ValueError, match="No comparable labels found"):
            validate_labels(labels_data)

    def test_analyze_mismatches(self, capsys):
        """Test mismatch analysis output."""

        # Create data with some mismatches
        labels_data = pd.DataFrame(
            {
                "msno": ["user1", "user2", "user3"],
                "is_churn": [1, 0, 1],
                "official_is_churn": [1, 1, 0],  # user2 and user3 are mismatches
                "expire_date": ["2017-02-15", "2017-02-15", "2017-02-15"],
                "next_renewal_date": [None, None, None],
            }
        )

        analyze_mismatches(labels_data, max_examples=5)

        captured = capsys.readouterr()
        assert "Found 2 mismatches" in captured.out
        assert "Generated=1, Official=0: 1" in captured.out
        assert "Generated=0, Official=1: 1" in captured.out


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
