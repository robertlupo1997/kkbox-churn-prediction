-- Filename : 05_analysis_queries.sql
-- Purpose  : Ad-hoc analyses for reporting & README
-- Author   : Trey Lupo | 2025-04-29

-- 1) Churn trend over time
SELECT * FROM kpi.monthly_summary ORDER BY month;

-- 2) Top 3 high-churn region/plan combos (subs > 100)
SELECT * FROM kpi.region_plan_summary
WHERE subscribers > 100
ORDER BY churn_rate DESC
LIMIT 3;

-- 3) Cohort retention sample
WITH cohort AS (
  SELECT
    msno,
    DATE_TRUNC('month', first_txn) AS cohort_month
  FROM features.user_tenure_revenue
)
SELECT
  cohort_month,
  COUNT(*)                               AS cohort_size,
  ROUND((COUNT(*) FILTER (WHERE NOT is_churn)::NUMERIC / NULLIF(COUNT(*)::NUMERIC,0)) * 100, 1) AS retention_pct
FROM cohort
JOIN fact_churn_labels USING (msno)
GROUP BY cohort_month
ORDER BY cohort_month;
