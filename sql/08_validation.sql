-- Filename : 08_validation.sql
-- Purpose  : Smoke-tests to catch pipeline regressions
-- Author   : Trey Lupo | 2025-04-29

BEGIN;

-- Row‐count checks
CREATE TEMP TABLE validation_counts AS
SELECT 'dim_members'                    AS table_name, COUNT(*) AS row_count FROM dim_members
UNION ALL SELECT 'fact_transactions',        COUNT(*) FROM fact_transactions
UNION ALL SELECT 'fact_user_logs',           COUNT(*) FROM fact_user_logs
UNION ALL SELECT 'fact_churn_labels',        COUNT(*) FROM fact_churn_labels
UNION ALL SELECT 'features.user_churn_labels', COUNT(*) FROM features.user_churn_labels
UNION ALL SELECT 'features.user_tenure_revenue', COUNT(*) FROM features.user_tenure_revenue
UNION ALL SELECT 'features.user_engagement', COUNT(*) FROM features.user_engagement
UNION ALL SELECT 'model.churn_dataset',       COUNT(*) FROM model.churn_dataset
UNION ALL SELECT 'model.churn_risk_scores',   COUNT(*) FROM model.churn_risk_scores
UNION ALL SELECT 'kpi.monthly_summary',       COUNT(*) FROM kpi.monthly_summary
UNION ALL SELECT 'kpi.region_plan_summary',   COUNT(*) FROM kpi.region_plan_summary;

\echo '--- validation row counts ---'
TABLE validation_counts;

-- Critical assertion: monthly_summary must not be empty
DO $$
DECLARE
  bad_cnt INT;
BEGIN
  SELECT row_count INTO bad_cnt
    FROM validation_counts
   WHERE table_name = 'kpi.monthly_summary'
     AND row_count = 0;
  IF FOUND THEN
    RAISE EXCEPTION 'kpi.monthly_summary has 0 rows!';
  END IF;
END $$;

COMMIT;
