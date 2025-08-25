-- Filename : 07_churn_risk_scoring.sql
-- Purpose  : Simple rule-based churn risk buckets
-- Author   : Trey Lupo | 2025-04-29

BEGIN;
DROP TABLE IF EXISTS model.churn_risk_scores;
CREATE TABLE model.churn_risk_scores AS
SELECT
  msno,
  CASE
    WHEN is_churn                                                            THEN 'Lost'
    WHEN tenure_months <  3 OR avg_secs_per_day < 120                        THEN 'High'
    WHEN tenure_months BETWEEN 3 AND 12 OR skip_rate > 0.3                   THEN 'Medium'
    ELSE 'Low'
  END                                                                             AS risk_bucket
FROM model.churn_dataset;

CREATE INDEX idx_risk_scores_bucket ON model.churn_risk_scores(risk_bucket);
COMMIT;