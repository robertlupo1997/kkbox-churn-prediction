-- Filename : 00_create_staging_tables.sql
-- Purpose  : Unlogged staging tables
-- Author   : Trey Lupo | 2025-04-29

BEGIN;

CREATE SCHEMA IF NOT EXISTS stg;

DROP TABLE IF EXISTS stg.members_v3;
CREATE UNLOGGED TABLE stg.members_v3 (
  msno                  VARCHAR(50),
  city                  INT,
  bd                    INT,
  gender                VARCHAR(10),
  registered_via        INT,
  registration_init_time VARCHAR(8)
);

DROP TABLE IF EXISTS stg.transactions;
CREATE UNLOGGED TABLE stg.transactions (
  msno                   VARCHAR(50),
  payment_method_id      INT,
  payment_plan_days      INT,
  plan_list_price        INT,
  actual_amount_paid     INT,
  is_auto_renew          INT,
  transaction_date       VARCHAR(8),
  membership_expire_date VARCHAR(8),
  is_cancel              INT
);

DROP TABLE IF EXISTS stg.user_logs;
CREATE UNLOGGED TABLE stg.user_logs (
  msno       VARCHAR(50),
  log_date   VARCHAR(8),
  num_25     INT,
  num_50     INT,
  num_75     INT,
  num_985    INT,
  num_100    INT,
  num_unq    INT,
  total_secs NUMERIC
);

DROP TABLE IF EXISTS stg.train;
CREATE UNLOGGED TABLE stg.train (
  msno     VARCHAR(50),
  is_churn INT
);

DROP TABLE IF EXISTS stg.sample_submission;
CREATE UNLOGGED TABLE stg.sample_submission (
  msno     VARCHAR(50),
  is_churn INT
);

COMMIT;