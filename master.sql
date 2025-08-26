-- Filename: master.sql
-- Purpose : Orchestrate full pipeline
-- Author  : Trey Lupo | 2025-04-29

\set ON_ERROR_STOP on
\set data_root 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge'

\echo '*** Creating staging tables'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/00_create_staging_tables.sql'

\echo '*** Loading raw data'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/01_ingest_data.sql'

\echo '*** Creating core tables'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/02_create_core_tables.sql'

\echo '*** Feature engineering'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/03_feature_engineering.sql'

\echo '*** Creating KPI metrics'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/04_kpi_metrics.sql'

\echo '*** Running analysis queries'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/05_analysis_queries.sql'

\echo '*** Creating predictive features'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/06_predictive_features.sql'

\echo '*** Churn risk scoring'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/07_churn_risk_scoring.sql'

\echo '*** Validating data'
\i 'C:/Users/Trey/Downloads/KKBOX_PROJECT/sql/08_validation.sql'

\echo '*** Pipeline complete'
