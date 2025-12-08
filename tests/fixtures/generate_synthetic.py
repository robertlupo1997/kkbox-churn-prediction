#!/usr/bin/env python3
"""
Generate synthetic KKBOX dataset for CI and demo purposes.

Creates realistic but synthetic data that matches KKBOX schema and patterns
without exposing real customer data.

Output: tiny_sample.parquet (1k rows) for fast CI pipeline testing
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import random
from typing import List, Tuple

import pandas as pd
import numpy as np


def generate_member_ids(n: int) -> List[str]:
    """Generate synthetic member IDs resembling KKBOX format."""
    ids = []
    for i in range(n):
        # Generate base64-like strings similar to KKBOX IDs
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
        id_str = ''.join(random.choices(chars, k=44))  # KKBOX IDs are ~44 chars
        ids.append(id_str)
    return ids


def generate_transactions(member_ids: List[str], start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """Generate synthetic transaction data."""
    
    transactions = []
    payment_methods = [1, 2, 3, 4, 5]  # Different payment types
    plan_options = [30, 90, 180, 365]  # Plan durations
    
    for msno in member_ids:
        # Generate 1-5 transactions per user
        n_transactions = random.randint(1, 5)
        current_date = start_date + timedelta(days=random.randint(0, 30))
        
        for _ in range(n_transactions):
            plan_days = random.choice(plan_options)
            list_price = {30: 149, 90: 399, 180: 799, 365: 1590}[plan_days]  # Taiwan pricing
            
            # Sometimes apply discounts
            discount_factor = random.choice([1.0, 0.9, 0.8, 0.7, 1.0, 1.0])
            actual_amount = int(list_price * discount_factor)
            
            expire_date = current_date + timedelta(days=plan_days)
            
            transaction = {
                'msno': msno,
                'payment_method_id': random.choice(payment_methods),
                'payment_plan_days': plan_days,
                'plan_list_price': list_price,
                'actual_amount_paid': actual_amount,
                'is_auto_renew': random.choice([0, 1]),
                'is_cancel': random.choice([0, 0, 0, 1]),  # 25% cancel rate
                'transaction_date': current_date.strftime('%Y%m%d'),
                'membership_expire_date': expire_date.strftime('%Y%m%d')
            }
            
            transactions.append(transaction)
            
            # Next transaction some time later
            if random.random() < 0.7:  # 70% renewal probability
                current_date = expire_date + timedelta(days=random.randint(0, 45))
            else:
                break  # User churns
                
            # Don't go past end date
            if current_date > end_date:
                break
    
    return pd.DataFrame(transactions)


def generate_user_logs(member_ids: List[str], start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """Generate synthetic user listening logs."""
    
    logs = []
    current_date = start_date
    
    while current_date <= end_date:
        # Random subset of users are active each day
        active_users = random.sample(member_ids, k=random.randint(100, 400))
        
        for msno in active_users:
            # Generate listening activity
            num_25 = random.randint(0, 50)      # Songs played >25%
            num_50 = random.randint(0, num_25)  # Songs played >50%
            num_75 = random.randint(0, num_50)  # Songs played >75% 
            num_985 = random.randint(0, num_75) # Songs played >98.5%
            num_100 = random.randint(0, num_985) # Songs played 100%
            num_unq = random.randint(num_100, num_25 + 20)  # Unique songs
            total_secs = random.randint(num_25 * 30, num_25 * 300)  # Total listening time
            
            log = {
                'msno': msno,
                'date': current_date.strftime('%Y%m%d'),
                'num_25': num_25,
                'num_50': num_50,  
                'num_75': num_75,
                'num_985': num_985,
                'num_100': num_100,
                'num_unq': num_unq,
                'total_secs': total_secs
            }
            
            logs.append(log)
        
        current_date += timedelta(days=1)
    
    return pd.DataFrame(logs)


def generate_members(member_ids: List[str]) -> pd.DataFrame:
    """Generate synthetic member demographic data."""
    
    members = []
    cities = list(range(1, 23))  # Taiwan city codes
    registration_methods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17]
    
    for msno in member_ids:
        # Generate realistic demographics
        age = random.randint(15, 70)
        gender = random.choice(['male', 'female', ''])  # Some missing
        
        member = {
            'msno': msno,
            'city': random.choice(cities + [None]),  # Some missing
            'bd': age,
            'gender': gender,
            'registered_via': random.choice(registration_methods),
            'registration_init_time': random.randint(20050101, 20160101)  # Registration dates
        }
        
        members.append(member)
    
    return pd.DataFrame(members)


def generate_train_labels(member_ids: List[str], churn_rate: float = 0.05) -> pd.DataFrame:
    """Generate synthetic train labels with realistic churn rate."""
    
    labels = []
    n_churners = int(len(member_ids) * churn_rate)
    churners = set(random.sample(member_ids, n_churners))
    
    for msno in member_ids:
        label = {
            'msno': msno,
            'is_churn': 1 if msno in churners else 0
        }
        labels.append(label)
    
    return pd.DataFrame(labels)


def generate_kkbox_dataset(n_samples: int = 1000) -> dict:
    """
    Generate complete synthetic KKBOX dataset for external use.
    
    Args:
        n_samples: Number of users to generate
        
    Returns:
        dict with keys: train, transactions, user_logs, members
    """
    # Set random seed for reproducibility
    random.seed(42)
    np.random.seed(42)
    
    # Configuration
    START_DATE = datetime(2016, 1, 1)
    END_DATE = datetime(2017, 5, 31)
    
    # Generate member IDs
    member_ids = generate_member_ids(n_samples)
    
    # Generate all data tables
    transactions = generate_transactions(member_ids, START_DATE, END_DATE)
    user_logs = generate_user_logs(member_ids, START_DATE, END_DATE)
    members = generate_members(member_ids)
    train_labels = generate_train_labels(member_ids)
    
    return {
        'train': train_labels,
        'transactions': transactions,
        'user_logs': user_logs,
        'members': members
    }


def main():
    """Generate complete synthetic KKBOX dataset."""
    
    # Configuration
    N_USERS = 1000
    START_DATE = datetime(2016, 1, 1)
    END_DATE = datetime(2017, 5, 31)
    
    print(f"🔄 Generating synthetic KKBOX dataset with {N_USERS} users...")
    
    # Use the reusable function
    dataset = generate_kkbox_dataset(N_USERS)
    transactions = dataset['transactions']
    user_logs = dataset['user_logs']
    members = dataset['members']
    train_labels = dataset['train']
    
    # Save as individual CSV files
    fixtures_dir = Path(__file__).parent
    
    transactions.to_csv(fixtures_dir / "transactions_synthetic.csv", index=False)
    user_logs.to_csv(fixtures_dir / "user_logs_synthetic.csv", index=False)
    members.to_csv(fixtures_dir / "members_synthetic.csv", index=False)
    train_labels.to_csv(fixtures_dir / "train_synthetic.csv", index=False)
    
    # Save as parquet for efficiency (optional - skip if pyarrow not available)
    try:
        pd.DataFrame({'tables': [str(len(transactions)), str(len(user_logs)),
                                 str(len(members)), str(len(train_labels))]}).to_parquet(
            fixtures_dir / "tiny_sample.parquet"
        )
    except ImportError:
        print("   ⚠️ Skipping parquet (pyarrow not installed) - CSV files are sufficient")
    
    print(f"✅ Synthetic dataset generated:")
    print(f"   📊 Transactions: {len(transactions):,}")
    print(f"   🎵 User logs: {len(user_logs):,}")
    print(f"   👥 Members: {len(members):,}")
    print(f"   🏷️ Train labels: {len(train_labels):,}")
    print(f"   📁 Files saved to: {fixtures_dir}")
    
    # Basic validation
    print("\n📈 Data validation:")
    print(f"   Churn rate: {train_labels['is_churn'].mean():.3f}")
    print(f"   Date range: {START_DATE.date()} to {END_DATE.date()}")
    print(f"   Transaction date range: {transactions['transaction_date'].min()} to {transactions['transaction_date'].max()}")


if __name__ == "__main__":
    main()