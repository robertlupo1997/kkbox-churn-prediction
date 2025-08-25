import argparse
import os
import pandas as pd
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--boundary", default="2017-02-01")
    ap.add_argument("--purge-days", type=int, default=30)
    ap.add_argument("--out", default="data/")
    args = ap.parse_args()
    
    print(f"Extracting with boundary={args.boundary}, purge_days={args.purge_days}")
    print("⚠️  PostgreSQL connection needed - implement SQL COPY in next step per specs")
    
    # Create placeholder files for now
    Path(args.out).mkdir(exist_ok=True)
    
    # TODO: Implement actual SQL extraction:
    # 1. Connect to PostgreSQL using PGURL
    # 2. Export train: label_date < boundary - purge_days  
    # 3. Export val: label_date >= boundary + purge_days
    # 4. Save as parquet files
    
if __name__ == "__main__":
    main()