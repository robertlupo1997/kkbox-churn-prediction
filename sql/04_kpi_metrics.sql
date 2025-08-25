-- Filename : 04_kpi_metrics.sql
-- Purpose  : Materialized KPI views (monthly & region/plan)
-- Author   : Trey Lupo | 2025-04-29

BEGIN;
CREATE SCHEMA IF NOT EXISTS kpi;

-- ---------------- monthly_summary ----------------
DROP MATERIALIZED VIEW IF EXISTS kpi.monthly_summary;
CREATE MATERIALIZED VIEW kpi.monthly_summary AS
WITH tx AS (
  SELECT
    DATE_TRUNC('month', transaction_date)::DATE                                       AS month,
    msno,
    is_churn,
    (actual_amount_paid::NUMERIC / NULLIF(payment_plan_days,0))                       AS daily_rate,
    payment_plan_days,
    transaction_date,
    membership_expire_date,
    (plan_list_price > actual_amount_paid)                                            AS is_discount
  FROM fact_transactions
  JOIN fact_churn_labels USING (msno)
)
SELECT
  month,
  COUNT(DISTINCT msno) FILTER (WHERE is_churn = FALSE)                                AS active_subscribers,
  COUNT(DISTINCT msno) FILTER (WHERE is_churn = TRUE)                                 AS churned_users,
  ROUND(
    (COUNT(DISTINCT msno) FILTER (WHERE is_churn = TRUE)::NUMERIC
     / NULLIF(COUNT(DISTINCT msno)::NUMERIC,0)
    ) * 100
  , 2)                                                                                 AS churn_rate,
  SUM(daily_rate * LEAST(payment_plan_days, membership_expire_date - transaction_date)) AS total_mrr,
  ROUND(
    (SUM(daily_rate * LEAST(payment_plan_days, membership_expire_date - transaction_date))::NUMERIC
     / NULLIF(COUNT(DISTINCT msno) FILTER (WHERE is_churn = FALSE)::NUMERIC,0)
    ), 2)                                                                              AS arpu,
  ROUND(
    (
      (SUM(daily_rate * LEAST(payment_plan_days, membership_expire_date - transaction_date))::NUMERIC
       / NULLIF(COUNT(DISTINCT msno) FILTER (WHERE is_churn = FALSE)::NUMERIC,0)
      )
      * (
        SELECT PERCENTILE_CONT(0.5)
               WITHIN GROUP (ORDER BY tenure_months)
        FROM features.user_tenure_revenue
      )::NUMERIC
    ), 2)                                                                              AS clv,
  ROUND(
    (COUNT(*) FILTER (WHERE is_discount)::NUMERIC
     / NULLIF(COUNT(*)::NUMERIC,0)
    ) * 100
  , 2)                                                                                 AS promo_uptake_rate
FROM tx
GROUP BY month
ORDER BY month;

-- ---------------- region_plan_summary ----------------
DROP MATERIALIZED VIEW IF EXISTS kpi.region_plan_summary;
CREATE MATERIALIZED VIEW kpi.region_plan_summary AS
WITH city_region AS (
  SELECT DISTINCT city,
    CASE
      WHEN city IN (1,2,3,4,5)  THEN 'North'
      WHEN city IN (6,7,8,9,10) THEN 'South'
      ELSE 'Other'
    END AS region
  FROM dim_members
),
base AS (
  SELECT
    DATE_TRUNC('month', t.transaction_date)::DATE    AS month,
    cr.region,
    t.payment_plan_days                             AS plan_duration,
    COUNT(DISTINCT t.msno)                          AS subscribers,
    COUNT(DISTINCT t.msno) FILTER (WHERE c.is_churn) AS churned_users,
    SUM(t.actual_amount_paid)::NUMERIC               AS total_mrr
  FROM fact_transactions t
  JOIN fact_churn_labels c USING (msno)
  JOIN dim_members       d USING (msno)
  JOIN city_region       cr ON cr.city = d.city
  GROUP BY 1,2,3
)
SELECT
  month,
  region,
  plan_duration,
  subscribers,
  churned_users,
  ROUND(
    (churned_users::NUMERIC
     / NULLIF(subscribers::NUMERIC,0)
    ) * 100
  , 2)                                                 AS churn_rate,
  total_mrr
FROM base
ORDER BY month, region, plan_duration;

COMMIT;