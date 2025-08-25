KKBOX Churn Prediction: SQL Data Pipeline
This repository contains a SQL-based data pipeline for the KKBOX Churn Prediction Challenge, transforming raw CSV data (~400M rows) into actionable business insights and machine learning-ready features. The pipeline is built with PostgreSQL, designed for scalability, and optimized for a Windows 11 environment. Below, I outline the data engineering and data analyst contributions, provide a step-by-step logic walkthrough, and demonstrate the pipeline's value for both technical and business stakeholders.
Project Overview
The pipeline processes KKBOX's user data (members, transactions, user logs, and churn labels) to:

Ingest and clean ~400M rows of raw CSV data.
Engineer features for churn prediction (e.g., tenure, engagement, lifetime value).
Compute KPIs such as churn rate, ARPU, CLV, and promo uptake for business reporting.
Generate predictive features and rule-based churn risk scores.
Validate data integrity with automated checks.

The pipeline is orchestrated via a master.sql script, executing nine modular SQL scripts in sequence. It handles large-scale data efficiently, enforces data quality, and produces outputs ready for dashboards (e.g., Power BI) and machine learning workflows.
Data Engineering and Data Analyst Responsibilities
The pipeline separates data engineering (building robust, scalable infrastructure) and data analyst (deriving business insights) tasks to ensure maintainability and clarity. Below is a breakdown of responsibilities for each script, aligned with the pipeline’s stages.



Pipeline Stage
Data Engineering Tasks
Data Analyst Tasks



00_create_staging_tables.sql
- Created stg schema with unlogged tables for fast CSV loading.- Defined minimal VARCHAR and NUMERIC columns to match raw data.- Ensured schema isolation for staging.
- None


01_ingest_data.sql
- Implemented robust \copy commands with Windows-compatible absolute paths.- Added \set ON_ERROR_STOP on for error handling.- Suppressed output to NUL for Windows compatibility.- Logged row counts (e.g., 410,502,905 rows in stg.user_logs).- Ran ANALYZE for query planner optimization.
- None


02_create_core_tables.sql
- Designed production schemas: dim_members, fact_transactions, fact_user_logs, fact_churn_labels.- Enforced data types (e.g., DATE, BOOLEAN), constraints (e.g., CHECK age BETWEEN 0 AND 120), and primary/foreign keys.- Added indexes (e.g., idx_fact_user_logs_msno) for query performance.- Handled v1/v2 data merges with ON CONFLICT.
- None


03_feature_engineering.sql
- Created features schema for derived tables.
- Derived user-level features:  - user_churn_labels: Churn status, last expiration date, days since expiry.  - user_tenure_revenue: Tenure (months), lifetime value.  - user_engagement: Listening days, avg. seconds/day, skip rate.


04_kpi_metrics.sql
- Created kpi schema for materialized views.- Optimized views for dashboard performance.
- Built materialized views:  - kpi.monthly_summary: Active subscribers, churn rate, MRR, ARPU, CLV, promo uptake (e.g., March 2017: 5.95% churn, $155.39 ARPU).  - kpi.region_plan_summary: Churn and MRR by region and plan duration.


05_analysis_queries.sql
- None
- Wrote ad-hoc queries for business insights:  - Churn trends (e.g., 8-10% monthly churn).  - Top high-churn region/plan combos (e.g., North, 410-day plan: 100% churn).  - Cohort retention (e.g., 45.3% retention for March 2017 cohort).


06_predictive_features.sql
- Created model schema for ML datasets.- Added index on is_churn for query efficiency.
- Flattened features into model.churn_dataset (1 row/user) with tenure, lifetime value, engagement metrics.


07_churn_risk_scoring.sql
- Created index on risk_bucket for performance.
- Applied rule-based scoring to model.churn_risk_scores (e.g., High risk: tenure < 3 months or avg. seconds/day < 120).


08_validation.sql
- Built smoke tests for row counts (e.g., 410,502,905 rows in fact_user_logs).- Added assertions to fail on empty tables (e.g., kpi.monthly_summary).
- None


master.sql
- Orchestrated scripts with \set ON_ERROR_STOP on.- Used absolute Windows paths for \i commands.- Provided clear pipeline stage logging (e.g., *** Creating core tables).
- None


Key Takeaways

Data Engineering: Focused on scalability (handling 400M+ rows), performance (indexes, unlogged tables), and reliability (error handling, validation).
Data Analyst: Translated business needs into SQL logic, delivering KPIs, predictive features, and actionable insights for stakeholders.

End-to-End Logic Walkthrough
The pipeline transforms raw CSVs into a structured data warehouse, engineered features, KPIs, and predictive scores. Below is a step-by-step explanation of the data flow, designed to be clear for both technical and non-technical audiences.
A. Raw Ingestion & Staging (00_create_staging_tables.sql, 01_ingest_data.sql)
Why: Raw CSVs (~400M rows across members, transactions, user logs, churn labels, and submissions) need a lightweight landing zone for initial loading.

Engineering:
Created unlogged stg.* tables (e.g., stg.members_v3, stg.user_logs) with minimal types (VARCHAR, NUMERIC) to match CSV formats.
Used \copy to bulk-load v1 and v2 CSVs (e.g., 410,502,905 rows into stg.user_logs).
Logged row counts for transparency (e.g., 6,769,473 rows in stg.members_v3).
Ran ANALYZE to optimize query planning.


Output: Staging tables populated with raw data, ready for cleansing.

B. Core Table Construction (02_create_core_tables.sql)
Why: Raw data must be cleansed, typed, and structured into a star schema for analysis.

Engineering:
dim_members: Cast registration_init_time to DATE, validated age (0-120), set gender to unknown for nulls, enforced msno as primary key (6,769,473 rows).
fact_transactions: Converted dates to DATE, cast is_auto_renew and is_cancel to BOOLEAN, calculated discount_percentage, added indexes on msno and transaction_date (22,978,755 rows).
fact_user_logs: Converted log_date to DATE, computed completion_ratio and skip_ratio, indexed msno and log_date (410,502,905 rows).
fact_churn_labels: Merged v1/v2 churn labels with ON CONFLICT, ensured msno uniqueness (1,082,190 rows).


Output: Production-ready fact and dimension tables with enforced data quality.

C. Feature Engineering (03_feature_engineering.sql)
Why: Raw facts need to be aggregated into user-level features for modeling and KPIs.

Analyst:
features.user_churn_labels: Computed last expiration date and days since expiry for each user (1,082,190 rows).
features.user_tenure_revenue: Calculated first transaction, last expiry, tenure (months), and lifetime value (2,426,143 rows).
features.user_engagement: Aggregated listening days, average seconds/day, skip rate, and total plays (5,339,422 rows).


Output: User-level features for downstream analysis and modeling.

D. KPI Materialization (04_kpi_metrics.sql)
Why: Pre-aggregated metrics enable fast dashboarding and reporting.

Analyst:
kpi.monthly_summary (27 rows):
Active Subscribers: Users not churned in the month (e.g., 923,587 in March 2017).
Churn Rate: churned_users / total_users * 100 (e.g., 5.95% in March 2017).
MRR: Prorated revenue based on daily rate and active days (e.g., $143.5M in March 2017).
ARPU: MRR / active_subscribers (e.g., $155.39 in March 2017).
CLV: ARPU * median(tenure_months) (e.g., $1,553.89 in March 2017).
Promo Uptake: Percentage of discounted transactions (e.g., 0.49% in March 2017).


kpi.region_plan_summary (1,499 rows): Broke down subscribers, churn rate, and MRR by region (North, South, Other) and plan duration.


Output: Materialized views for Power BI dashboards and stakeholder reports.

E. Analysis Queries (05_analysis_queries.sql)
Why: Answer key business questions to inform strategy.

Analyst:
Churn Trends: Showed monthly churn rates (8-10%, dropping to 5.95% in March 2017).
High-Churn Combos: Identified top region/plan pairs (e.g., North, 410-day plan: 100% churn in Jan 2017).
Cohort Retention: Calculated retention by signup month (e.g., 45.3% for March 2017 cohort).


Output: Actionable insights for retention strategies and marketing campaigns.

F. Predictive Dataset & Scoring (06_predictive_features.sql, 07_churn_risk_scoring.sql)
Why: Prepare data for machine learning and provide quick churn risk insights.

Analyst:
model.churn_dataset: Flattened features (tenure, lifetime value, engagement) into one row per user (1,082,190 rows).
model.churn_risk_scores: Assigned risk buckets:
Lost: Already churned.
High: Tenure < 3 months or avg. seconds/day < 120.
Medium: Tenure 3-12 months or skip rate > 0.3.
Low: Otherwise.




Output: ML-ready dataset and rule-based churn scores for prioritization.

G. Validation (08_validation.sql)
Why: Ensure pipeline reliability and catch regressions.

Engineering:
Logged row counts for all tables (e.g., 410,502,905 in fact_user_logs, 27 in kpi.monthly_summary).
Asserted non-empty critical tables (e.g., kpi.monthly_summary).


Output: Confidence in data integrity for downstream use.

Technical Highlights

Scalability: Handled 410M+ rows with unlogged tables, indexes, and optimized queries.
Reliability: Used \set ON_ERROR_STOP on and assertions to fail fast on errors.
Performance: Added indexes on high-traffic columns (e.g., msno, log_date) and ran ANALYZE for query efficiency.
Portability: Designed for Windows 11 with absolute paths and NUL output suppression.
Maintainability: Modular scripts with clear comments and consistent naming (snake_case, uppercase SQL keywords).

Business Impact

Actionable Insights: Delivered KPIs (e.g., 5.95% churn, $155.39 ARPU in March 2017) for retention strategies.
Predictive Power: Generated churn risk scores to prioritize high-risk users.
Dashboard-Ready: Materialized views enable fast Power BI reporting.
Data Quality: Automated validation ensures trustworthy outputs.

Setup Instructions

Prerequisites:

PostgreSQL 14+ installed on Windows 11.
CSVs from Kaggle (~400M rows) in C:/Users/YourUsername/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/.
16GB+ RAM, 100GB+ free disk space.


Setup:
createdb kkbox_analytics
psql -d kkbox_analytics
\cd C:/Users/YourUsername/Downloads/KKBOX_PROJECT
\i master.sql


Validation:
\i sql/08_validation.sql
SELECT * FROM kpi.monthly_summary LIMIT 5;


Export for BI:
\copy kpi.monthly_summary TO 'C:/path/to/monthly_summary.csv' DELIMITER ',' CSV HEADER



Future Improvements

Partitioning: Partition fact_user_logs by log_date for faster queries.
Incremental Loads: Support daily CSV updates to reduce runtime.
ML Integration: Export model.churn_dataset to Python for advanced modeling.
CI/CD: Automate pipeline runs with GitHub Actions.

Why This Matters
This pipeline demonstrates my ability to:

Engineer robust systems: Built a scalable, reliable pipeline for 400M+ rows.
Deliver business value: Translated raw data into KPIs and predictive insights.
Collaborate across roles: Balanced data engineering and analyst responsibilities.
Communicate clearly: Documented logic for technical and non-technical audiences.

For hiring managers, this project showcases my skills in SQL, data pipeline design, performance optimization, and business analytics, making me a strong candidate for data engineering and analytics roles.

Author: Trey Lupo Date: April 30, 2025Contact: treylupo1197@gmail.com
