-- Simplified KKBOX Feature Engineering with Temporal Safeguards
-- Focuses on core features with strict leak prevention

WITH
-- Define cutoff dates per sample (February 28, 2017 for training as per official split)
label_index AS (
  SELECT
    tr.msno,
    tr.is_churn,
    DATE '2017-02-28' AS cutoff_ts  -- Official train cutoff per Kaggle spec
  FROM read_csv_auto('${train_path}') tr
  WHERE tr.msno IS NOT NULL
),

-- Parse and filter transactions (90-day lookback, no future data)
tx_features AS (
  SELECT
    li.msno,
    COUNT(*) AS tx_count_total,
    SUM(CASE WHEN CAST(tx.is_cancel AS INTEGER) = 1 THEN 1 ELSE 0 END) AS cancels_total,
    MAX(CAST(tx.payment_plan_days AS INTEGER)) AS plan_days_latest,
    MAX(CAST(tx.is_auto_renew AS INTEGER)) AS auto_renew_latest
  FROM label_index li
  LEFT JOIN read_csv_auto('${transactions_path}') tx ON li.msno = tx.msno
  WHERE tx.msno IS NULL OR (
    TRY_CAST(strptime(CAST(tx.transaction_date AS VARCHAR), '%Y%m%d') AS DATE) <= li.cutoff_ts
    AND TRY_CAST(strptime(CAST(tx.transaction_date AS VARCHAR), '%Y%m%d') AS DATE) >= li.cutoff_ts - INTERVAL '90 days'
  )
  GROUP BY li.msno
),

-- Parse and filter user logs (30-day lookback, no future data)
usage_features AS (
  SELECT
    li.msno,
    COUNT(*) AS logs_30d,
    SUM(COALESCE(CAST(ul.total_secs AS INTEGER), 0)) AS secs_30d,
    SUM(COALESCE(CAST(ul.num_unq AS INTEGER), 0)) AS unq_30d
  FROM label_index li
  LEFT JOIN read_csv_auto('${user_logs_path}') ul ON li.msno = ul.msno
  WHERE ul.msno IS NULL OR (
    TRY_CAST(strptime(CAST(ul.date AS VARCHAR), '%Y%m%d') AS DATE) <= li.cutoff_ts
    AND TRY_CAST(strptime(CAST(ul.date AS VARCHAR), '%Y%m%d') AS DATE) >= li.cutoff_ts - INTERVAL '30 days'
  )
  GROUP BY li.msno
),

-- Demographic features with data cleaning
demo_features AS (
  SELECT
    li.msno,
    CASE
      WHEN m.gender IN ('male', 'female') THEN m.gender
      ELSE 'unknown'
    END AS gender,
    CASE
      WHEN CAST(m.bd AS INTEGER) BETWEEN 10 AND 80 THEN CAST(m.bd AS INTEGER)
      ELSE 25
    END AS age
  FROM label_index li
  LEFT JOIN read_csv_auto('${members_path}') m ON li.msno = m.msno
)

-- Combine all features with proper null handling and type safety
SELECT
  li.msno,
  li.is_churn,
  li.cutoff_ts,

  -- Transaction features (explicit defaults for users with no data)
  CASE WHEN txf.tx_count_total IS NULL THEN 0 ELSE txf.tx_count_total END AS tx_count_total,
  CASE WHEN txf.cancels_total IS NULL THEN 0 ELSE txf.cancels_total END AS cancels_total,
  CASE WHEN txf.plan_days_latest IS NULL THEN 30 ELSE txf.plan_days_latest END AS plan_days_latest,
  CASE WHEN txf.auto_renew_latest IS NULL THEN 0 ELSE txf.auto_renew_latest END AS auto_renew_latest,

  -- Usage features (explicit defaults for inactive users)
  CASE WHEN uf.logs_30d IS NULL THEN 0 ELSE uf.logs_30d END AS logs_30d,
  CASE WHEN uf.secs_30d IS NULL THEN 0 ELSE uf.secs_30d END AS secs_30d,
  CASE WHEN uf.unq_30d IS NULL THEN 0 ELSE uf.unq_30d END AS unq_30d,

  -- Demographic features (explicit defaults)
  CASE WHEN df.gender IS NULL THEN 'unknown' ELSE df.gender END AS gender,
  CASE WHEN df.age IS NULL THEN 25 ELSE df.age END AS age

FROM label_index li
LEFT JOIN tx_features txf ON li.msno = txf.msno
LEFT JOIN usage_features uf ON li.msno = uf.msno
LEFT JOIN demo_features df ON li.msno = df.msno
ORDER BY li.msno;
