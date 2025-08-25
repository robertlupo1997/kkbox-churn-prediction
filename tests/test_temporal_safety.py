#!/usr/bin/env python3
"""
Test temporal safety in feature engineering.

Verifies that no future data leaks into features by fabricating test data
with events after the cutoff and asserting zero rows contain future information.
"""

import tempfile
from pathlib import Path
import pandas as pd
import duckdb

def test_no_future_data_leakage():
    """
    Test that fabricated future events don't leak into features.
    
    Creates synthetic data with:
    1. Cutoff date: 2017-02-28
    2. Some user_logs with dates AFTER cutoff (2017-03-01, 2017-03-02)
    3. Some transactions with dates AFTER cutoff
    
    Asserts that feature engineering returns zero future events.
    """
    
    # Create temporary test data
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Train labels
        train_data = pd.DataFrame({
            'msno': ['user1', 'user2', 'user3'],
            'is_churn': [0, 1, 0]
        })
        train_path = temp_path / "train.csv"
        train_data.to_csv(train_path, index=False)
        
        # Transactions: mix of past and future dates
        tx_data = pd.DataFrame({
            'msno': ['user1', 'user1', 'user2', 'user2', 'user3'],
            'transaction_date': [20170228, 20170301, 20170227, 20170302, 20170226],  # Some future!
            'payment_plan_days': [30, 30, 30, 30, 30],
            'is_auto_renew': [1, 1, 0, 1, 1],
            'is_cancel': [0, 0, 0, 0, 0]
        })
        tx_path = temp_path / "transactions.csv"
        tx_data.to_csv(tx_path, index=False)
        
        # User logs: mix of past and future dates  
        logs_data = pd.DataFrame({
            'msno': ['user1', 'user1', 'user1', 'user2', 'user2', 'user3'],
            'date': [20170227, 20170228, 20170301, 20170226, 20170302, 20170225],  # Some future!
            'total_secs': [3600, 1800, 7200, 2400, 5400, 900],
            'num_unq': [10, 5, 20, 8, 15, 3]
        })
        logs_path = temp_path / "user_logs.csv"
        logs_data.to_csv(logs_path, index=False)
        
        # Members data
        members_data = pd.DataFrame({
            'msno': ['user1', 'user2', 'user3'],
            'gender': ['male', 'female', 'male'],
            'bd': [25, 30, 35]
        })
        members_path = temp_path / "members.csv"
        members_data.to_csv(members_path, index=False)
        
        # Read the feature SQL template
        sql_template_path = Path(__file__).parent.parent / "features" / "features_simple.sql"
        with open(sql_template_path, 'r') as f:
            sql_template = f.read()
        
        # Substitute paths
        sql_query = sql_template.replace('${train_path}', str(train_path))
        sql_query = sql_query.replace('${transactions_path}', str(tx_path))
        sql_query = sql_query.replace('${user_logs_path}', str(logs_path))
        sql_query = sql_query.replace('${members_path}', str(members_path))
        
        # Execute feature engineering
        con = duckdb.connect()
        result = con.execute(sql_query).fetchdf()
        con.close()
        
        # Verify no future data leaked
        print(f"Feature engineering returned {len(result)} rows")
        print(f"Cutoff date: 2017-02-28")
        
        # Check specific user feature values to ensure future data didn't leak
        user1_features = result[result['msno'] == 'user1'].iloc[0]
        user2_features = result[result['msno'] == 'user2'].iloc[0]
        
        # user1 had logs on 20170227, 20170228 (past) and 20170301 (future)
        # Only past logs should count: 3600 + 1800 = 5400 total_secs
        assert user1_features['secs_30d'] == 5400, f"Expected 5400, got {user1_features['secs_30d']}"
        
        # user1 had transactions on 20170228 (past) and 20170301 (future)  
        # Only past transactions should count: 1 transaction
        assert user1_features['tx_count_total'] == 1, f"Expected 1, got {user1_features['tx_count_total']}"
        
        # user2 had logs on 20170226 (past) and 20170302 (future)
        # Only past logs should count: 2400 total_secs
        assert user2_features['secs_30d'] == 2400, f"Expected 2400, got {user2_features['secs_30d']}"
        
        # Verify cutoff_ts is correct
        assert all(result['cutoff_ts'] == '2017-02-28'), "All cutoff timestamps should be 2017-02-28"
        
        print("✅ No future data leakage detected")


def test_feature_sql_date_parsing():
    """Test that date parsing handles edge cases correctly."""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Test data with various date formats and edge cases
        train_data = pd.DataFrame({
            'msno': ['user1'],
            'is_churn': [0]
        })
        train_path = temp_path / "train.csv"
        train_data.to_csv(train_path, index=False)
        
        # Transactions with edge case dates
        tx_data = pd.DataFrame({
            'msno': ['user1', 'user1'],
            'transaction_date': [20170228, ''],  # Valid date and empty string
            'payment_plan_days': [30, 30],
            'is_auto_renew': [1, 0],
            'is_cancel': [0, 0]
        })
        tx_path = temp_path / "transactions.csv"
        tx_data.to_csv(tx_path, index=False)
        
        # User logs with edge case dates
        logs_data = pd.DataFrame({
            'msno': ['user1'],
            'date': [20170227],
            'total_secs': [3600],
            'num_unq': [10]
        })
        logs_path = temp_path / "user_logs.csv"
        logs_data.to_csv(logs_path, index=False)
        
        # Members data
        members_data = pd.DataFrame({
            'msno': ['user1'],
            'gender': ['male'],
            'bd': [25]
        })
        members_path = temp_path / "members.csv"
        members_data.to_csv(members_path, index=False)
        
        # Read and execute SQL
        sql_template_path = Path(__file__).parent.parent / "features" / "features_simple.sql"
        with open(sql_template_path, 'r') as f:
            sql_template = f.read()
        
        sql_query = sql_template.replace('${train_path}', str(train_path))
        sql_query = sql_query.replace('${transactions_path}', str(tx_path))
        sql_query = sql_query.replace('${user_logs_path}', str(logs_path))
        sql_query = sql_query.replace('${members_path}', str(members_path))
        
        # Should not raise errors despite malformed dates
        con = duckdb.connect()
        result = con.execute(sql_query).fetchdf()
        con.close()
        
        assert len(result) == 1, "Should return 1 user"
        assert result.iloc[0]['tx_count_total'] == 1, "Should count only valid transactions"
        
        print("✅ Date parsing handles edge cases correctly")


if __name__ == "__main__":
    test_no_future_data_leakage()
    test_feature_sql_date_parsing()
    print("All temporal safety tests passed!")