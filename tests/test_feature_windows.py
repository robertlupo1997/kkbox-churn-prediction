#!/usr/bin/env python3
"""
Comprehensive tests for temporal feature windows and leakage prevention.

Tests ensure:
- No future data usage in feature engineering
- Proper as-of date enforcement across all tables
- Window boundaries are correctly implemented
- Edge cases around cutoff dates are handled safely
"""

import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest
import duckdb

# Add src to path for imports
import sys
sys.path.append(str(Path(__file__).parent.parent / "src"))


class TestFeatureWindows:
    """Test suite for temporal feature window validation."""
    
    @pytest.fixture
    def sample_train_data(self):
        """Sample training data with cutoff at 2017-03-01."""
        return pd.DataFrame([
            {"msno": "user1", "is_churn": 1},
            {"msno": "user2", "is_churn": 0},
            {"msno": "user3", "is_churn": 1}
        ])
    
    @pytest.fixture  
    def sample_transactions(self):
        """Sample transactions spanning cutoff date."""
        data = [
            # User1: transactions before cutoff (valid)
            {"msno": "user1", "transaction_date": "20170215", "membership_expire_date": "20170315",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1},
             
            # User1: transaction after cutoff (should be excluded)
            {"msno": "user1", "transaction_date": "20170305", "membership_expire_date": "20170405", 
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1},
             
            # User2: only transactions before cutoff
            {"msno": "user2", "transaction_date": "20170101", "membership_expire_date": "20170201",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 120,
             "is_auto_renew": 0, "is_cancel": 0, "payment_method_id": 2},
            {"msno": "user2", "transaction_date": "20170210", "membership_expire_date": "20170310",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 0, "is_cancel": 0, "payment_method_id": 2},
             
            # User3: no transactions (should get default values)
        ]
        return pd.DataFrame(data)
    
    @pytest.fixture
    def sample_user_logs(self):  
        """Sample user logs spanning cutoff date."""
        data = [
            # User1: logs before cutoff (valid)
            {"msno": "user1", "date": "20170225", "num_25": 50, "num_50": 30, "num_75": 20,
             "num_985": 15, "num_100": 10, "num_unq": 45, "total_secs": 7200},
            {"msno": "user1", "date": "20170228", "num_25": 30, "num_50": 20, "num_75": 15,
             "num_985": 10, "num_100": 5, "num_unq": 25, "total_secs": 4800},
             
            # User1: logs after cutoff (should be excluded)  
            {"msno": "user1", "date": "20170305", "num_25": 100, "num_50": 80, "num_75": 60,
             "num_985": 50, "num_100": 40, "num_unq": 90, "total_secs": 14400},
             
            # User2: only logs before cutoff
            {"msno": "user2", "date": "20170210", "num_25": 20, "num_50": 15, "num_75": 10,
             "num_985": 8, "num_100": 5, "num_unq": 18, "total_secs": 3600},
            {"msno": "user2", "date": "20170220", "num_25": 40, "num_50": 25, "num_75": 18,
             "num_985": 12, "num_100": 8, "num_unq": 35, "total_secs": 6000},
             
            # User3: no logs (should get default values)
        ]
        return pd.DataFrame(data)
    
    @pytest.fixture
    def sample_members(self):
        """Sample member demographics."""
        return pd.DataFrame([
            {"msno": "user1", "city": 1, "bd": 25, "gender": "male", 
             "registered_via": 7, "registration_init_time": "20160101"},
            {"msno": "user2", "city": 13, "bd": 30, "gender": "female",
             "registered_via": 9, "registration_init_time": "20150601"}, 
            {"msno": "user3", "city": None, "bd": 99, "gender": "",
             "registered_via": 4, "registration_init_time": "20161201"}
        ])
    
    def create_temp_files(self, train_data, transactions, user_logs, members):
        """Helper to create temporary CSV files for testing."""
        files = {}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            train_data.to_csv(f.name, index=False)
            files['train_path'] = f.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            transactions.to_csv(f.name, index=False)
            files['transactions_path'] = f.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            user_logs.to_csv(f.name, index=False)
            files['user_logs_path'] = f.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            members.to_csv(f.name, index=False)
            files['members_path'] = f.name
            
        return files
    
    def cleanup_temp_files(self, files):
        """Helper to clean up temporary files."""
        for file_path in files.values():
            if os.path.exists(file_path):
                os.unlink(file_path)
    
    def test_no_future_data_leakage(self, sample_train_data, sample_transactions, 
                                  sample_user_logs, sample_members):
        """Test that no future data (after 2017-03-01) is included in features."""
        
        files = self.create_temp_files(sample_train_data, sample_transactions, 
                                     sample_user_logs, sample_members)
        
        try:
            # Read and execute features SQL
            with open('features/features.sqlx', 'r') as f:
                sql_template = f.read()
                
            # Substitute file paths
            sql = sql_template.replace('${train_path}', files['train_path'])
            sql = sql.replace('${transactions_path}', files['transactions_path'])
            sql = sql.replace('${user_logs_path}', files['user_logs_path'])
            sql = sql.replace('${members_path}', files['members_path'])
            
            con = duckdb.connect()
            result = con.execute(sql).fetchdf()
            con.close()
            
            # Verify results
            assert len(result) == 3, "Should have 3 users"
            
            # User1 should only have pre-cutoff transaction (not the 2017-03-05 one)
            user1 = result[result['msno'] == 'user1'].iloc[0]
            assert user1['tx_count_total'] == 1, "User1 should have only 1 transaction (pre-cutoff)"
            
            # User1 should only have pre-cutoff logs (2 days, not the 2017-03-05 one)
            assert user1['logs_30d'] == 2, "User1 should have only 2 log days (pre-cutoff)"
            assert user1['secs_30d'] == 12000, "User1 should have 12000 total seconds (7200+4800)"
            
            # User2 should have all transactions (both pre-cutoff)  
            user2 = result[result['msno'] == 'user2'].iloc[0]
            assert user2['tx_count_total'] == 2, "User2 should have 2 transactions"
            assert user2['logs_30d'] == 2, "User2 should have 2 log days"
            
            # User3 should have default values (no data)
            user3 = result[result['msno'] == 'user3'].iloc[0] 
            assert user3['tx_count_total'] == 0, "User3 should have 0 transactions"
            assert user3['logs_30d'] == 0, "User3 should have 0 log days"
            
        finally:
            self.cleanup_temp_files(files)
    
    def test_temporal_window_boundaries(self, sample_train_data, sample_transactions,
                                      sample_user_logs, sample_members):
        """Test that feature windows respect 30-day and 90-day boundaries."""
        
        # Create data with specific dates to test window boundaries
        old_transactions = pd.DataFrame([
            # Transaction 91 days before cutoff (should be excluded from 90-day window)
            {"msno": "user1", "transaction_date": "20161201", "membership_expire_date": "20170101",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1},
             
            # Transaction 89 days before cutoff (should be included)  
            {"msno": "user1", "transaction_date": "20161203", "membership_expire_date": "20170103",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1}
        ])
        
        old_logs = pd.DataFrame([
            # Log 31 days before cutoff (should be excluded from 30-day window)
            {"msno": "user1", "date": "20170129", "num_25": 25, "num_50": 15, "num_75": 10,
             "num_985": 8, "num_100": 5, "num_unq": 20, "total_secs": 3600},
             
            # Log 29 days before cutoff (should be included)
            {"msno": "user1", "date": "20170131", "num_25": 30, "num_50": 20, "num_75": 15,
             "num_985": 10, "num_100": 8, "num_unq": 25, "total_secs": 4800}
        ])
        
        files = self.create_temp_files(sample_train_data, old_transactions, 
                                     old_logs, sample_members)
        
        try:
            with open('features/features.sqlx', 'r') as f:
                sql_template = f.read()
                
            sql = sql_template.replace('${train_path}', files['train_path'])
            sql = sql.replace('${transactions_path}', files['transactions_path']) 
            sql = sql.replace('${user_logs_path}', files['user_logs_path'])
            sql = sql.replace('${members_path}', files['members_path'])
            
            con = duckdb.connect()
            result = con.execute(sql).fetchdf()
            con.close()
            
            user1 = result[result['msno'] == 'user1'].iloc[0]
            
            # Should include only the transaction from 2016-12-03 (within 90-day window)
            assert user1['tx_count_total'] == 1, "Should include only 1 transaction (within 90-day window)"
            
            # Should include only the log from 2017-01-31 (within 30-day window)  
            assert user1['logs_30d'] == 1, "Should include only 1 log day (within 30-day window)"
            assert user1['secs_30d'] == 4800, "Should have 4800 seconds from included log"
            
        finally:
            self.cleanup_temp_files(files)
    
    def test_malformed_data_handling(self, sample_train_data, sample_members):
        """Test handling of malformed dates and missing data."""
        
        bad_transactions = pd.DataFrame([
            # Valid transaction
            {"msno": "user1", "transaction_date": "20170215", "membership_expire_date": "20170315",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1},
             
            # Invalid date formats (should be excluded)
            {"msno": "user2", "transaction_date": "invalid", "membership_expire_date": "20170315", 
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149,
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1},
            {"msno": "user3", "transaction_date": None, "membership_expire_date": "20170315",
             "payment_plan_days": 30, "plan_list_price": 149, "actual_amount_paid": 149, 
             "is_auto_renew": 1, "is_cancel": 0, "payment_method_id": 1}
        ])
        
        bad_logs = pd.DataFrame([
            # Valid log
            {"msno": "user1", "date": "20170225", "num_25": 50, "num_50": 30, "num_75": 20,
             "num_985": 15, "num_100": 10, "num_unq": 45, "total_secs": 7200},
             
            # Invalid date formats (should be excluded)
            {"msno": "user2", "date": "bad_date", "num_25": 25, "num_50": 15, "num_75": 10,
             "num_985": 8, "num_100": 5, "num_unq": 20, "total_secs": 3600},
            {"msno": "user3", "date": None, "num_25": 40, "num_50": 25, "num_75": 18,
             "num_985": 12, "num_100": 8, "num_unq": 35, "total_secs": 6000}
        ])
        
        files = self.create_temp_files(sample_train_data, bad_transactions,
                                     bad_logs, sample_members)
        
        try:
            with open('features/features.sqlx', 'r') as f:
                sql_template = f.read()
                
            sql = sql_template.replace('${train_path}', files['train_path'])
            sql = sql.replace('${transactions_path}', files['transactions_path'])
            sql = sql.replace('${user_logs_path}', files['user_logs_path'])  
            sql = sql.replace('${members_path}', files['members_path'])
            
            con = duckdb.connect()
            result = con.execute(sql).fetchdf()
            con.close()
            
            # Should have all 3 users with appropriate defaults for missing data
            assert len(result) == 3
            
            user1 = result[result['msno'] == 'user1'].iloc[0]
            user2 = result[result['msno'] == 'user2'].iloc[0]
            user3 = result[result['msno'] == 'user3'].iloc[0]
            
            # User1 should have valid data
            assert user1['tx_count_total'] == 1
            assert user1['logs_30d'] == 1
            
            # User2 and User3 should have default values due to invalid dates
            assert user2['tx_count_total'] == 0  # Invalid transaction date
            assert user2['logs_30d'] == 0       # Invalid log date
            assert user3['tx_count_total'] == 0  # Null transaction date
            assert user3['logs_30d'] == 0       # Null log date
            
        finally:
            self.cleanup_temp_files(files)
    
    def test_demographic_data_cleaning(self, sample_train_data, sample_transactions, sample_user_logs):
        """Test demographic data cleaning and default value assignment."""
        
        messy_members = pd.DataFrame([
            # Valid demographics
            {"msno": "user1", "city": 1, "bd": 25, "gender": "male",
             "registered_via": 7, "registration_init_time": "20160101"},
             
            # Out-of-range age (should be defaulted)
            {"msno": "user2", "city": 13, "bd": 150, "gender": "female", 
             "registered_via": 9, "registration_init_time": "20150601"},
             
            # Missing/invalid gender and city
            {"msno": "user3", "city": "invalid", "bd": 5, "gender": "",
             "registered_via": 4, "registration_init_time": "20161201"}
        ])
        
        files = self.create_temp_files(sample_train_data, sample_transactions,
                                     sample_user_logs, messy_members)
        
        try:
            with open('features/features.sqlx', 'r') as f:
                sql_template = f.read()
                
            sql = sql_template.replace('${train_path}', files['train_path'])
            sql = sql.replace('${transactions_path}', files['transactions_path'])
            sql = sql.replace('${user_logs_path}', files['user_logs_path'])
            sql = sql.replace('${members_path}', files['members_path'])
            
            con = duckdb.connect()
            result = con.execute(sql).fetchdf()
            con.close()
            
            user1 = result[result['msno'] == 'user1'].iloc[0]
            user2 = result[result['msno'] == 'user2'].iloc[0]  
            user3 = result[result['msno'] == 'user3'].iloc[0]
            
            # User1 should have original valid data
            assert user1['age'] == 25
            assert user1['gender'] == 'male'
            assert user1['city'] == 1
            
            # User2 should have age defaulted due to out-of-range value
            assert user2['age'] == 25  # Default age
            assert user2['gender'] == 'female'  # Valid gender preserved
            
            # User3 should have defaults for invalid data
            assert user3['age'] == 25      # Default age (5 is out of range)
            assert user3['gender'] == 'unknown'  # Empty string becomes 'unknown'
            assert pd.isna(user3['city'])  # Invalid city becomes null
            
        finally:
            self.cleanup_temp_files(files)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])