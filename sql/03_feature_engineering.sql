-- Filename : 03_feature_engineering.sql
-- Purpose  : Feature derivation (churn, tenure, engagement)
-- Author   : Trey Lupo | 2025-04-29

BEGIN;
CREATE SCHEMA IF NOT EXISTS features;

-- user_churn_labels
DROP TABLE IF EXISTS features.user_churn_labels;
CREATE TABLE features.user_churn_labels AS
SELECT
  f.msno,
  f.is_churn,
  MAX(t.membership_expire_date)                         AS last_expiration_date,
  (DATE '2017-03-31' - MAX(t.membership_expire_date))    AS days_since_expiry
FROM fact_churn_labels f
LEFT JOIN fact_transactions t ON t.msno = f.msno
GROUP BY f.msno, f.is_churn;

-- user_tenure_revenue
DROP TABLE IF EXISTS features.user_tenure_revenue;
CREATE TABLE features.user_tenure_revenue AS
SELECT
  t.msno,
  MIN(t.transaction_date)                                                  AS first_txn,
  MAX(t.membership_expire_date)                                            AS last_expire,
  ROUND(((MAX(t.membership_expire_date) - MIN(t.transaction_date))::NUMERIC) / 30, 1) AS tenure_months,
  SUM(t.actual_amount_paid)                                                AS lifetime_value
FROM fact_transactions t
GROUP BY t.msno;

-- user_engagement
DROP TABLE IF EXISTS features.user_engagement;
CREATE TABLE features.user_engagement AS
SELECT
  msno,
  COUNT(DISTINCT log_date)                                                       AS distinct_listening_days,
  AVG(total_secs)                                                                AS avg_secs_per_day,
  SUM(num_25 + num_50 + num_75 + num_985 + num_100)                              AS total_plays,
  (SUM(num_25 + num_50 + num_75 + num_985)::NUMERIC / NULLIF(SUM(num_25 + num_50 + num_75 + num_985 + num_100)::NUMERIC,0)) AS skip_rate
FROM fact_user_logs
GROUP BY msno;

COMMIT;
