CREATE TABLE dim_plans AS
SELECT DISTINCT payment_plan_days AS plan_duration
FROM fact_transactions
WHERE payment_plan_days >= 7
  AND payment_plan_days IS NOT NULL
ORDER BY payment_plan_days;
