#!/usr/bin/env python3
import argparse
import os

import duckdb
import numpy as np
import pandas as pd

FEATS = [
    "plan_days_latest",
    "auto_renew_latest",
    "cancels_total",
    "tx_count_total",
    "logs_30d",
    "secs_30d",
    "unq_30d",
    "bd",
]


def prep(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # Convert to numeric and clip bd
    df["bd"] = pd.to_numeric(df["bd"], errors="coerce").clip(10, 80).fillna(30)
    # Convert to numeric and log-transform heavy-tailed features
    for c in ["logs_30d", "secs_30d", "unq_30d", "tx_count_total", "cancels_total"]:
        df[c] = np.log1p(pd.to_numeric(df[c], errors="coerce").fillna(0))
    # Also convert plan_days_latest and auto_renew_latest to numeric
    df["plan_days_latest"] = pd.to_numeric(df["plan_days_latest"], errors="coerce").fillna(0)
    df["auto_renew_latest"] = pd.to_numeric(df["auto_renew_latest"], errors="coerce").fillna(0)
    return df


def load_calibrator(path: str):
    if not os.path.exists(path):
        return None
    z = np.load(path)
    x, y = z["x"], z["y"]

    # piecewise-linear isotonic transform
    def f(p):
        return np.interp(p, x, y, left=y[0], right=y[-1])

    return f


def main():
    import xgboost as xgb

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--data-dir", default="kkbox-churn-prediction-challenge/data/churn_comp_refresh"
    )
    ap.add_argument(
        "--sample",
        default="kkbox-churn-prediction-challenge/data/churn_comp_refresh/sample_submission_v2.csv",
    )
    ap.add_argument("--start", default="2017-04-01")  # test window start (default = Apr)
    ap.add_argument("--end", default="2017-05-01")  # test window end (exclusive)
    ap.add_argument("--model", default="models/xgb.json")
    ap.add_argument("--cal", default="models/calibrator_isotonic.npz")
    ap.add_argument("--out", default="submissions/final_submission.csv")
    args = ap.parse_args()

    os.makedirs("submissions", exist_ok=True)

    # 1) Build features in DuckDB, restricted to msno in sample
    con = duckdb.connect()
    con.execute(f"SET threads TO {os.cpu_count() or 4}")
    con.execute(
        f"CREATE VIEW sample AS SELECT * FROM read_csv_auto('{args.sample}', IGNORE_ERRORS=TRUE)"
    )
    con.execute(
        "CREATE VIEW members AS SELECT * FROM read_csv_auto('kkbox-churn-prediction-challenge/members_v3.csv', IGNORE_ERRORS=TRUE)"
    )
    con.execute(
        f"CREATE VIEW tx AS SELECT * FROM read_csv_auto('{args.data_dir}/transactions_v2.csv', IGNORE_ERRORS=TRUE)"
    )
    con.execute(
        f"CREATE VIEW logs AS SELECT * FROM read_csv_auto('{args.data_dir}/user_logs_v2.csv', IGNORE_ERRORS=TRUE)"
    )

    print(f"🔄 Building features for test period {args.start} to {args.end}")

    con.execute(
        f"""
    CREATE OR REPLACE TABLE to_pred AS
    WITH tx_norm AS (
      SELECT msno,
             STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS expire_date,
             payment_plan_days, is_auto_renew, is_cancel
      FROM tx
    ),
    last_exp AS (
      SELECT msno,
             MAX(expire_date) FILTER (WHERE expire_date >= DATE '{args.start}' AND expire_date < DATE '{args.end}') AS label_date
      FROM tx_norm GROUP BY msno
    ),
    tx_agg AS (
      SELECT t.msno,
             MAX(t.payment_plan_days) AS plan_days_latest,
             MAX(t.is_auto_renew)     AS auto_renew_latest,
             SUM(CASE WHEN t.is_cancel=1 THEN 1 ELSE 0 END) AS cancels_total,
             COUNT(*) AS tx_count_total
      FROM tx_norm t JOIN last_exp e USING (msno)
      WHERE t.expire_date < e.label_date
      GROUP BY t.msno
    ),
    logs_norm AS (
      SELECT msno, STRPTIME(CAST(date AS VARCHAR), '%Y%m%d') AS log_date, num_25, num_50, num_75, num_985, num_100, num_unq, total_secs
      FROM logs
    ),
    logs_30 AS (
      SELECT l.msno,
             COUNT(*) AS logs_30d,
             SUM(COALESCE(l.total_secs,0)) AS secs_30d,
             SUM(COALESCE(l.num_unq,0))    AS unq_30d
      FROM logs_norm l JOIN last_exp e USING (msno)
      WHERE l.log_date >= e.label_date - INTERVAL 30 DAY AND l.log_date < e.label_date
      GROUP BY l.msno
    ),
    members_clean AS (
      SELECT msno,
             CAST(COALESCE(NULLIF(gender,''),'unknown') AS VARCHAR) AS gender,
             TRY_CAST(city AS INTEGER) AS city,
             TRY_CAST(bd AS INTEGER)   AS bd
      FROM members
    ),
    joined AS (
      SELECT
        s.msno,
        e.label_date,
        tx.plan_days_latest, tx.auto_renew_latest, tx.cancels_total, tx.tx_count_total,
        COALESCE(l.logs_30d,0) AS logs_30d, COALESCE(l.secs_30d,0) AS secs_30d, COALESCE(l.unq_30d,0) AS unq_30d,
        m.gender, m.city, m.bd
      FROM sample s
      LEFT JOIN last_exp e USING (msno)
      LEFT JOIN tx_agg tx USING (msno)
      LEFT JOIN logs_30 l USING (msno)
      LEFT JOIN members_clean m USING (msno)
    )
    SELECT * FROM joined
    """
    )

    tbl = con.execute("SELECT * FROM to_pred").fetch_arrow_table()
    df = tbl.to_pandas()

    print(f"📊 Built features for {len(df):,} users")

    # fill NAs for unseen users gracefully
    for c in [
        "plan_days_latest",
        "auto_renew_latest",
        "cancels_total",
        "tx_count_total",
        "logs_30d",
        "secs_30d",
        "unq_30d",
        "bd",
    ]:
        if c not in df.columns:
            df[c] = 0
    df = prep(df)

    # 2) Predict with XGB
    print("🔮 Generating predictions...")
    bst = xgb.Booster(model_file=args.model)
    dva = xgb.DMatrix(df[FEATS].fillna(0), feature_names=FEATS)
    p = bst.predict(dva)

    # 3) Optional isotonic calibration
    cal = load_calibrator(args.cal)
    if cal is not None:
        print("📐 Applying isotonic calibration...")
        p = cal(p)
    else:
        print("⚠️  No calibration file found, using raw predictions")

    # Clip to [0,1] and write CSV
    p = np.clip(p, 0.0, 1.0)
    out = pd.DataFrame({"msno": df["msno"].values, "is_churn": p})
    out.to_csv(args.out, index=False)

    print("📈 Prediction stats:")
    print(f"  Min: {p.min():.4f}")
    print(f"  Max: {p.max():.4f}")
    print(f"  Mean: {p.mean():.4f}")
    print(f"✅ Saved {len(out):,} predictions → {args.out}")


if __name__ == "__main__":
    main()
