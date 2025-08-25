#!/usr/bin/env python3
import duckdb, os, sys, time, json, pathlib

DATA = os.environ.get("DATA_DIR", "kkbox-churn-prediction-challenge/data/churn_comp_refresh")
out_dir = pathlib.Path("data")
out_dir.mkdir(exist_ok=True)

con = duckdb.connect()
con.execute(f"SET threads TO {os.cpu_count() or 4}")

print(f"🔄 Loading CSVs from {DATA}")

# Register CSVs
con.execute(f"CREATE OR REPLACE VIEW train AS SELECT * FROM read_csv_auto('{DATA}/train_v2.csv', IGNORE_ERRORS=TRUE)")
con.execute(f"CREATE OR REPLACE VIEW members AS SELECT * FROM read_csv_auto('kkbox-churn-prediction-challenge/members_v3.csv', IGNORE_ERRORS=TRUE)")
con.execute(f"CREATE OR REPLACE VIEW tx AS SELECT * FROM read_csv_auto('{DATA}/transactions_v2.csv', IGNORE_ERRORS=TRUE)")
con.execute(f"CREATE OR REPLACE VIEW logs AS SELECT * FROM read_csv_auto('{DATA}/user_logs_v2.csv', IGNORE_ERRORS=TRUE)")

print("📊 Creating leak-safe feature dataset...")

# Cohort split: Train on Mar 2017, Validate on Apr 2017 (data-driven split)
con.execute("""
CREATE OR REPLACE TABLE joined AS
WITH tx_norm AS (
  SELECT
    msno,
    STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS expire_date,
    payment_plan_days,
    is_auto_renew,
    is_cancel
  FROM tx
),
last_exp AS (
  SELECT
    msno,
    -- choose the last expire date within Mar–Apr 2017 to be the per-user label_date
    MAX(expire_date) FILTER (
      WHERE expire_date >= DATE '2017-03-01'
        AND expire_date <  DATE '2017-05-01'
    ) AS label_date
  FROM tx_norm
  GROUP BY msno
),
tx_agg AS (
  SELECT
    t.msno,
    MAX(t.payment_plan_days) AS plan_days_latest,
    MAX(t.is_auto_renew) AS auto_renew_latest,
    SUM(CASE WHEN t.is_cancel=1 THEN 1 ELSE 0 END) AS cancels_total,
    COUNT(*) AS tx_count_total
  FROM tx_norm t
  JOIN last_exp e USING (msno)
  WHERE t.expire_date < e.label_date
  GROUP BY t.msno
),
logs_norm AS (
  SELECT msno,
         STRPTIME(CAST(date AS VARCHAR), '%Y%m%d') AS log_date,
         num_25, num_50, num_75, num_985, num_100, num_unq, total_secs
  FROM logs
),
logs_30 AS (
  SELECT
    l.msno,
    COUNT(*) AS logs_30d,
    SUM(COALESCE(l.total_secs,0)) AS secs_30d,
    SUM(COALESCE(l.num_unq,0)) AS unq_30d
  FROM logs_norm l
  JOIN last_exp e USING (msno)
  WHERE l.log_date >= e.label_date - INTERVAL 30 DAY
    AND l.log_date <  e.label_date
  GROUP BY l.msno
),
members_clean AS (
  SELECT
    msno,
    CAST(COALESCE(NULLIF(gender,''),'unknown') AS VARCHAR) AS gender,
    TRY_CAST(city AS INTEGER) AS city,
    TRY_CAST(bd AS INTEGER) AS bd
  FROM members
)
SELECT
  tr.msno,
  CAST(tr.is_churn AS INTEGER) AS is_churn,
  e.label_date,
  tx.plan_days_latest,
  tx.auto_renew_latest,
  tx.cancels_total,
  tx.tx_count_total,
  COALESCE(l.logs_30d,0) AS logs_30d,
  COALESCE(l.secs_30d,0) AS secs_30d,
  COALESCE(l.unq_30d,0)  AS unq_30d,
  m.gender, m.city, m.bd
FROM train tr
LEFT JOIN last_exp e USING (msno)
LEFT JOIN tx_agg tx USING (msno)
LEFT JOIN logs_30 l USING (msno)
LEFT JOIN members_clean m USING (msno)
WHERE e.label_date IS NOT NULL
""")

# Write train/val with cohort split: Mar = train, Apr = val
print("💾 Writing train.parquet (Mar 2017 cohort)")
con.execute("""
COPY (
  SELECT * FROM joined
  WHERE label_date >= DATE '2017-03-01'
    AND label_date <  DATE '2017-04-01'
) TO 'data/train.parquet' (FORMAT PARQUET);
""")

print("💾 Writing val.parquet (Apr 2017 cohort)")
con.execute("""
COPY (
  SELECT * FROM joined
  WHERE label_date >= DATE '2017-04-01'
    AND label_date <  DATE '2017-05-01'
) TO 'data/val.parquet' (FORMAT PARQUET);
""")

# Fail early if no data
total_rows = con.execute("SELECT COUNT(*) FROM joined").fetchone()[0]
assert total_rows > 0, "No rows in joined dataset - check CSV paths and data"

# Sanity checks: rows per month and base rates
print("📈 Cohort Analysis:")
cohort_analysis = con.execute("""
SELECT strftime(label_date, '%Y-%m') AS ym,
       COUNT(*) AS n,
       AVG(is_churn) AS pos_rate
FROM joined
WHERE label_date BETWEEN DATE '2017-03-01' AND DATE '2017-04-30'
GROUP BY 1 ORDER BY 1
""").fetchall()

for row in cohort_analysis:
    print(f"  {row[0]}: {row[1]:,} users, {row[2]:.3f} churn rate")

# Leakage guard: check for logs on/after label_date using joined table
leaks = con.execute("""
WITH user_logs AS (
  SELECT msno, STRPTIME(CAST(date AS VARCHAR), '%Y%m%d') AS log_date FROM logs
)
SELECT COUNT(*) AS leaks
FROM user_logs l
JOIN joined j USING(msno) 
WHERE l.log_date >= j.label_date
""").fetchone()[0]

if leaks > 0:
    print(f"⚠️  WARNING: {leaks:,} log entries found on/after label_date (data leakage!)")
else:
    print("✅ No data leakage detected in logs")

# Transaction leakage guard: expire dates should not be on/after label_date  
tx_leaks = con.execute("""
WITH tx_dates AS (
  SELECT msno, STRPTIME(CAST(membership_expire_date AS VARCHAR), '%Y%m%d') AS expire_date
  FROM tx
)
SELECT COUNT(*) AS tx_leaks
FROM tx_dates t
JOIN joined j USING(msno)
WHERE t.expire_date >= j.label_date
""").fetchone()[0]

if tx_leaks > 0:
    print(f"⚠️  WARNING: {tx_leaks:,} transaction expire dates found on/after label_date!")
else:
    print("✅ No transaction leakage detected")

# Basic report
stats = con.execute("SELECT COUNT(*) n, AVG(is_churn) AS pos_rate FROM joined").fetchone()
train_stats = con.execute("SELECT COUNT(*) n, AVG(is_churn) AS pos_rate FROM joined WHERE label_date >= DATE '2017-03-01' AND label_date < DATE '2017-04-01'").fetchone()
val_stats = con.execute("SELECT COUNT(*) n, AVG(is_churn) AS pos_rate FROM joined WHERE label_date >= DATE '2017-04-01' AND label_date < DATE '2017-05-01'").fetchone()

pathlib.Path("eval").mkdir(exist_ok=True)
summary = {
    "total_rows": int(stats[0]), 
    "total_pos_rate": float(stats[1] or 0),
    "train_rows": int(train_stats[0]),
    "train_pos_rate": float(train_stats[1] or 0),
    "val_rows": int(val_stats[0]),
    "val_pos_rate": float(val_stats[1] or 0),
    "boundary": "cohort Mar -> Apr 2017",
    "purge_days": 0
}

pathlib.Path("eval/dataset_summary.json").write_text(json.dumps(summary, indent=2))

print("✅ Dataset creation complete!")
print(f"📈 Total: {summary['total_rows']:,} rows, {summary['total_pos_rate']:.3f} churn rate")
print(f"🚂 Train: {summary['train_rows']:,} rows, {summary['train_pos_rate']:.3f} churn rate")
print(f"🎯 Val: {summary['val_rows']:,} rows, {summary['val_pos_rate']:.3f} churn rate")