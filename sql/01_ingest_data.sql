-- Filename : 01_ingest_data.sql
-- Purpose  : Bulk-load CSVs → staging; show row counts
-- Author   : Trey Lupo | 2025-04-29

\set ON_ERROR_STOP on

\pset tuples_only on
\pset format unaligned
\o NUL

-- ------- members_v3 -------
\copy stg.members_v3 FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/members_v3.csv' DELIMITER ',' CSV HEADER
SELECT COUNT(*) AS c FROM stg.members_v3 \gset
\echo 'Rows loaded into stg.members_v3              : ' :c

-- ------- transactions (v1 + v2) -------
\copy stg.transactions FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/transactions.csv' DELIMITER ',' CSV HEADER
\copy stg.transactions FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv' DELIMITER ',' CSV HEADER
SELECT COUNT(*) AS c FROM stg.transactions \gset
\echo 'Rows loaded into stg.transactions             : ' :c

-- ------- user_logs (v1 + v2) -------
\copy stg.user_logs FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/user_logs.csv' DELIMITER ',' CSV HEADER
\copy stg.user_logs FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/data/churn_comp_refresh/user_logs_v2.csv' DELIMITER ',' CSV HEADER
SELECT COUNT(*) AS c FROM stg.user_logs \gset
\echo 'Rows loaded into stg.user_logs                : ' :c

-- ------- train (v1 + v2) -------
\copy stg.train FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/train.csv' DELIMITER ',' CSV HEADER
\copy stg.train FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv' DELIMITER ',' CSV HEADER
SELECT COUNT(*) AS c FROM stg.train \gset
\echo 'Rows loaded into stg.train                    : ' :c

-- ------- sample_submission (zero + v2) -------
\copy stg.sample_submission FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/sample_submission_zero.csv' DELIMITER ',' CSV HEADER
\copy stg.sample_submission FROM 'C:/Users/Trey/Downloads/KKBOX_PROJECT/kkbox-churn-prediction-challenge/data/churn_comp_refresh/sample_submission_v2.csv' DELIMITER ',' CSV HEADER
SELECT COUNT(*) AS c FROM stg.sample_submission \gset
\echo 'Rows loaded into stg.sample_submission        : ' :c

\o
\pset tuples_only off
\pset format aligned

ANALYZE stg.members_v3;
ANALYZE stg.transactions;
ANALYZE stg.user_logs;
ANALYZE stg.train;
ANALYZE stg.sample_submission;