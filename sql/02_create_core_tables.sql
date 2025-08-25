-- Filename : 02_create_core_tables.sql
-- Purpose  : Dimension & fact tables + indexes
-- Author   : Trey Lupo | 2025-04-29

BEGIN;

-- dim_members
DROP TABLE IF EXISTS dim_members;
CREATE TABLE dim_members (
  msno              VARCHAR(50) PRIMARY KEY,
  city              INT,
  age               SMALLINT    CHECK (age IS NULL OR age BETWEEN 0 AND 120),
  gender            VARCHAR(10) CHECK (gender IN ('male','female','unknown')),
  registered_via    INT,
  registration_date DATE
);

INSERT INTO dim_members
SELECT
  msno,
  city,
  CASE WHEN bd <= 0 OR bd > 120 THEN NULL ELSE bd END,
  COALESCE(NULLIF(gender, ''), 'unknown'),
  registered_via,
  TO_DATE(registration_init_time, 'YYYYMMDD')
FROM stg.members_v3
WHERE msno IS NOT NULL;
CREATE INDEX idx_dim_members_city ON dim_members(city);

-- fact_transactions
DROP TABLE IF EXISTS fact_transactions;
CREATE TABLE fact_transactions (
  msno                    VARCHAR(50),
  payment_method_id       INT,
  payment_plan_days       INT,
  plan_list_price         INT,
  actual_amount_paid      INT,
  is_auto_renew           BOOLEAN,
  transaction_date        DATE,
  membership_expire_date  DATE,
  is_cancel               BOOLEAN,
  discount_percentage     NUMERIC(5,2)
);

INSERT INTO fact_transactions
SELECT
  msno,
  payment_method_id,
  payment_plan_days,
  plan_list_price,
  actual_amount_paid,
  is_auto_renew::BOOLEAN,
  TO_DATE(transaction_date, 'YYYYMMDD'),
  TO_DATE(membership_expire_date, 'YYYYMMDD'),
  is_cancel::BOOLEAN,
  CASE
    WHEN plan_list_price > 0
    THEN ROUND(((plan_list_price - actual_amount_paid)::NUMERIC / NULLIF(plan_list_price,0)) * 100, 2)
    ELSE 0
  END
FROM stg.transactions
WHERE msno IS NOT NULL;
CREATE INDEX idx_fact_transactions_msno       ON fact_transactions(msno);
CREATE INDEX idx_fact_transactions_trans_date ON fact_transactions(transaction_date);

-- fact_user_logs
DROP TABLE IF EXISTS fact_user_logs;
CREATE TABLE fact_user_logs (
  msno             VARCHAR(50),
  log_date         DATE,
  num_25           INT,
  num_50           INT,
  num_75           INT,
  num_985          INT,
  num_100          INT,
  num_unq          INT,
  total_secs       NUMERIC,
  completion_ratio NUMERIC(5,2),
  skip_ratio       NUMERIC(5,2)
);

INSERT INTO fact_user_logs
SELECT
  msno,
  TO_DATE(log_date, 'YYYYMMDD'),
  num_25, num_50, num_75, num_985, num_100,
  num_unq,
  total_secs,
  CASE
    WHEN (num_25+num_50+num_75+num_985+num_100) > 0
    THEN ROUND((num_100::NUMERIC / NULLIF((num_25+num_50+num_75+num_985+num_100)::NUMERIC,0)) * 100, 2)
    ELSE 0
  END,
  CASE
    WHEN (num_25+num_50+num_75+num_985+num_100) > 0
    THEN ROUND(((num_25+num_50+num_75+num_985)::NUMERIC / NULLIF((num_25+num_50+num_75+num_985+num_100)::NUMERIC,0)) * 100, 2)
    ELSE 0
  END
FROM stg.user_logs
WHERE msno IS NOT NULL;
CREATE INDEX idx_fact_user_logs_msno     ON fact_user_logs(msno);
CREATE INDEX idx_fact_user_logs_log_date ON fact_user_logs(log_date);

-- fact_churn_labels
DROP TABLE IF EXISTS fact_churn_labels;
CREATE TABLE fact_churn_labels (
  msno     VARCHAR(50) PRIMARY KEY,
  is_churn BOOLEAN
);

INSERT INTO fact_churn_labels(msno, is_churn)
SELECT msno, MAX(is_churn)::BOOLEAN
FROM stg.train
WHERE msno IS NOT NULL
GROUP BY msno
ON CONFLICT (msno) DO UPDATE
  SET is_churn = EXCLUDED.is_churn;

COMMIT;