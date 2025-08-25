-- Filename : 06_predictive_features.sql
-- Purpose  : Flattened dataset for ML (one row per user)
-- Author   : Trey Lupo | 2025-04-29

BEGIN;
CREATE SCHEMA IF NOT EXISTS model;

DROP TABLE IF EXISTS model.churn_dataset;
CREATE TABLE model.churn_dataset AS
SELECT
  l.msno,
  l.is_churn,
  tr.tenure_months,
  tr.lifetime_value,
  eg.avg_secs_per_day,
  eg.skip_rate,
  eg.distinct_listening_days
FROM fact_churn_labels l
LEFT JOIN features.user_tenure_revenue tr USING (msno)
LEFT JOIN features.user_engagement     eg USING (msno);

CREATE INDEX idx_churn_dataset_is_churn ON model.churn_dataset(is_churn);
COMMIT;