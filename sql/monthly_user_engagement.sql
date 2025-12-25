-- Filename: monthly_user_engagement.sql
-- Purpose: Create a materialized view for monthly user engagement metrics
-- Author: Updated by Grok | 2025-05-04

-- 1. Drop any existing materialized view
DROP MATERIALIZED VIEW IF EXISTS features.monthly_user_engagement CASCADE;

-- 2. Create the materialized view
CREATE MATERIALIZED VIEW features.monthly_user_engagement AS
SELECT
  DATE_TRUNC('month', TO_DATE(log_date, 'YYYYMMDD'))::date AS month,
  msno,
  AVG(GREATEST(total_secs, 0))                              AS avg_secs_per_day, -- Ensure non-negative
  COUNT(DISTINCT CASE WHEN num_100 > 0 THEN log_date END)   AS distinct_listening_days,
  (SUM(num_25 + num_50 + num_75 + num_985)
     / NULLIF(SUM(num_25 + num_50 + num_75 + num_985 + num_100), 0)
  )::numeric                                                 AS skip_rate,
  SUM(num_25 + num_50 + num_75 + num_985 + num_100)         AS total_plays
FROM stg.user_logs
WHERE log_date ~ '^[0-9]{8}$'
  AND LENGTH(log_date) = 8
GROUP BY
  msno,
  DATE_TRUNC('month', TO_DATE(log_date, 'YYYYMMDD'));

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mue_month
  ON features.monthly_user_engagement (month);
CREATE INDEX IF NOT EXISTS idx_mue_msno
  ON features.monthly_user_engagement (msno);
