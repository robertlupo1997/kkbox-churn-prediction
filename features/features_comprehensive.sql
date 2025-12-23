-- Comprehensive KKBOX Feature Engineering (100+ features)
-- Modeled after Kaggle Top 4% solutions with multiple time windows
-- Target: Log Loss ~0.10-0.15

-- Configuration: Set cutoff date for temporal safety
-- Training cutoff: 2017-02-28 (official Kaggle spec)

WITH
-- =============================================================================
-- LABEL INDEX: Define samples with their cutoff dates
-- =============================================================================
label_index AS (
  SELECT
    msno,
    is_churn,
    DATE '2017-02-28' AS cutoff_ts
  FROM read_csv_auto('${train_path}')
  WHERE msno IS NOT NULL
),

-- =============================================================================
-- TRANSACTION FEATURES: Multiple time windows (7d, 14d, 30d, 60d, 90d)
-- =============================================================================

-- Parse transactions once with date filtering
tx_parsed AS (
  SELECT
    tx.msno,
    TRY_CAST(strptime(CAST(tx.transaction_date AS VARCHAR), '%Y%m%d') AS DATE) AS tx_date,
    TRY_CAST(strptime(CAST(tx.membership_expire_date AS VARCHAR), '%Y%m%d') AS DATE) AS expire_date,
    CAST(tx.payment_method_id AS INTEGER) AS payment_method_id,
    CAST(tx.payment_plan_days AS INTEGER) AS payment_plan_days,
    CAST(tx.plan_list_price AS DOUBLE) AS plan_list_price,
    CAST(tx.actual_amount_paid AS DOUBLE) AS actual_amount_paid,
    CAST(tx.is_auto_renew AS INTEGER) AS is_auto_renew,
    CAST(tx.is_cancel AS INTEGER) AS is_cancel
  FROM read_csv_auto('${transactions_path}') tx
),

tx_with_cutoff AS (
  SELECT
    li.msno,
    li.cutoff_ts,
    tp.*,
    li.cutoff_ts - tp.tx_date AS days_ago
  FROM label_index li
  INNER JOIN tx_parsed tp ON li.msno = tp.msno
  WHERE tp.tx_date <= li.cutoff_ts
    AND tp.tx_date >= li.cutoff_ts - INTERVAL '90 days'
),

-- Transaction features by time window
tx_features_90d AS (
  SELECT
    msno,
    -- Counts
    COUNT(*) AS tx_count_90d,
    SUM(is_cancel) AS cancel_count_90d,
    SUM(is_auto_renew) AS auto_renew_count_90d,

    -- Ratios
    AVG(is_auto_renew) AS auto_renew_ratio_90d,
    AVG(is_cancel) AS cancel_ratio_90d,

    -- Payment amounts
    SUM(actual_amount_paid) AS total_paid_90d,
    AVG(actual_amount_paid) AS avg_paid_90d,
    STDDEV(actual_amount_paid) AS std_paid_90d,
    MAX(actual_amount_paid) AS max_paid_90d,
    MIN(actual_amount_paid) AS min_paid_90d,

    -- Plan days
    AVG(payment_plan_days) AS avg_plan_days_90d,
    MAX(payment_plan_days) AS max_plan_days_90d,
    MIN(payment_plan_days) AS min_plan_days_90d,

    -- Discount features
    AVG(plan_list_price - actual_amount_paid) AS avg_discount_90d,
    SUM(CASE WHEN actual_amount_paid < plan_list_price THEN 1 ELSE 0 END) AS discount_tx_count_90d,

    -- Payment method diversity
    COUNT(DISTINCT payment_method_id) AS unique_payment_methods_90d,
    MODE(payment_method_id) AS most_common_payment_method,

    -- Recency
    MIN(days_ago) AS days_since_last_tx,

    -- Latest values
    MAX(expire_date) AS latest_expire_date,
    LAST(is_auto_renew ORDER BY tx_date) AS latest_auto_renew,
    LAST(payment_plan_days ORDER BY tx_date) AS latest_plan_days

  FROM tx_with_cutoff
  GROUP BY msno
),

tx_features_60d AS (
  SELECT
    msno,
    COUNT(*) AS tx_count_60d,
    SUM(is_cancel) AS cancel_count_60d,
    AVG(is_auto_renew) AS auto_renew_ratio_60d,
    SUM(actual_amount_paid) AS total_paid_60d,
    AVG(actual_amount_paid) AS avg_paid_60d,
    STDDEV(actual_amount_paid) AS std_paid_60d
  FROM tx_with_cutoff
  WHERE days_ago <= 60
  GROUP BY msno
),

tx_features_30d AS (
  SELECT
    msno,
    COUNT(*) AS tx_count_30d,
    SUM(is_cancel) AS cancel_count_30d,
    AVG(is_auto_renew) AS auto_renew_ratio_30d,
    SUM(actual_amount_paid) AS total_paid_30d,
    AVG(actual_amount_paid) AS avg_paid_30d
  FROM tx_with_cutoff
  WHERE days_ago <= 30
  GROUP BY msno
),

tx_features_14d AS (
  SELECT
    msno,
    COUNT(*) AS tx_count_14d,
    SUM(is_cancel) AS cancel_count_14d,
    SUM(actual_amount_paid) AS total_paid_14d
  FROM tx_with_cutoff
  WHERE days_ago <= 14
  GROUP BY msno
),

tx_features_7d AS (
  SELECT
    msno,
    COUNT(*) AS tx_count_7d,
    SUM(is_cancel) AS cancel_count_7d,
    SUM(actual_amount_paid) AS total_paid_7d
  FROM tx_with_cutoff
  WHERE days_ago <= 7
  GROUP BY msno
),

-- =============================================================================
-- USER LOG FEATURES: Multiple time windows (7d, 14d, 30d, 60d, 90d)
-- =============================================================================

-- Parse user logs once
logs_parsed AS (
  SELECT
    ul.msno,
    TRY_CAST(strptime(CAST(ul.date AS VARCHAR), '%Y%m%d') AS DATE) AS log_date,
    CAST(ul.num_25 AS INTEGER) AS num_25,
    CAST(ul.num_50 AS INTEGER) AS num_50,
    CAST(ul.num_75 AS INTEGER) AS num_75,
    CAST(ul.num_985 AS INTEGER) AS num_985,
    CAST(ul.num_100 AS INTEGER) AS num_100,
    CAST(ul.num_unq AS INTEGER) AS num_unq,
    CAST(ul.total_secs AS DOUBLE) AS total_secs,
    -- Derived: total plays
    CAST(ul.num_25 AS INTEGER) + CAST(ul.num_50 AS INTEGER) +
    CAST(ul.num_75 AS INTEGER) + CAST(ul.num_985 AS INTEGER) +
    CAST(ul.num_100 AS INTEGER) AS total_plays
  FROM read_csv_auto('${user_logs_path}') ul
),

logs_with_cutoff AS (
  SELECT
    li.msno,
    li.cutoff_ts,
    lp.*,
    li.cutoff_ts - lp.log_date AS days_ago
  FROM label_index li
  INNER JOIN logs_parsed lp ON li.msno = lp.msno
  WHERE lp.log_date <= li.cutoff_ts
    AND lp.log_date >= li.cutoff_ts - INTERVAL '90 days'
),

-- Log features by time window
log_features_90d AS (
  SELECT
    msno,
    -- Activity counts
    COUNT(*) AS log_days_90d,
    COUNT(DISTINCT log_date) AS active_days_90d,

    -- Listening time
    SUM(total_secs) AS total_secs_90d,
    AVG(total_secs) AS avg_secs_per_day_90d,
    STDDEV(total_secs) AS std_secs_90d,
    MAX(total_secs) AS max_secs_day_90d,
    MIN(total_secs) AS min_secs_day_90d,

    -- Song counts
    SUM(num_unq) AS total_unq_90d,
    AVG(num_unq) AS avg_unq_per_day_90d,
    STDDEV(num_unq) AS std_unq_90d,

    -- Completion rates (important for churn!)
    SUM(num_100) AS total_completed_90d,
    SUM(num_25) AS total_skipped_early_90d,
    SUM(num_50) AS total_50pct_90d,
    SUM(num_75) AS total_75pct_90d,
    SUM(num_985) AS total_almost_complete_90d,
    SUM(total_plays) AS total_plays_90d,

    -- Completion ratios
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_100) * 1.0 / SUM(total_plays)
      ELSE 0 END AS completion_rate_90d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_25) * 1.0 / SUM(total_plays)
      ELSE 0 END AS early_skip_rate_90d,

    -- Engagement consistency
    MIN(days_ago) AS days_since_last_listen,
    MAX(days_ago) AS days_since_first_listen_90d

  FROM logs_with_cutoff
  GROUP BY msno
),

log_features_60d AS (
  SELECT
    msno,
    COUNT(DISTINCT log_date) AS active_days_60d,
    SUM(total_secs) AS total_secs_60d,
    AVG(total_secs) AS avg_secs_per_day_60d,
    SUM(num_unq) AS total_unq_60d,
    SUM(num_100) AS total_completed_60d,
    SUM(total_plays) AS total_plays_60d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_100) * 1.0 / SUM(total_plays)
      ELSE 0 END AS completion_rate_60d
  FROM logs_with_cutoff
  WHERE days_ago <= 60
  GROUP BY msno
),

log_features_30d AS (
  SELECT
    msno,
    COUNT(DISTINCT log_date) AS active_days_30d,
    SUM(total_secs) AS total_secs_30d,
    AVG(total_secs) AS avg_secs_per_day_30d,
    STDDEV(total_secs) AS std_secs_30d,
    SUM(num_unq) AS total_unq_30d,
    AVG(num_unq) AS avg_unq_per_day_30d,
    SUM(num_100) AS total_completed_30d,
    SUM(num_25) AS total_skipped_early_30d,
    SUM(total_plays) AS total_plays_30d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_100) * 1.0 / SUM(total_plays)
      ELSE 0 END AS completion_rate_30d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_25) * 1.0 / SUM(total_plays)
      ELSE 0 END AS early_skip_rate_30d
  FROM logs_with_cutoff
  WHERE days_ago <= 30
  GROUP BY msno
),

log_features_14d AS (
  SELECT
    msno,
    COUNT(DISTINCT log_date) AS active_days_14d,
    SUM(total_secs) AS total_secs_14d,
    AVG(total_secs) AS avg_secs_per_day_14d,
    SUM(num_unq) AS total_unq_14d,
    SUM(total_plays) AS total_plays_14d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_100) * 1.0 / SUM(total_plays)
      ELSE 0 END AS completion_rate_14d
  FROM logs_with_cutoff
  WHERE days_ago <= 14
  GROUP BY msno
),

log_features_7d AS (
  SELECT
    msno,
    COUNT(DISTINCT log_date) AS active_days_7d,
    SUM(total_secs) AS total_secs_7d,
    AVG(total_secs) AS avg_secs_per_day_7d,
    SUM(num_unq) AS total_unq_7d,
    SUM(total_plays) AS total_plays_7d,
    CASE WHEN SUM(total_plays) > 0
      THEN SUM(num_100) * 1.0 / SUM(total_plays)
      ELSE 0 END AS completion_rate_7d
  FROM logs_with_cutoff
  WHERE days_ago <= 7
  GROUP BY msno
),

-- =============================================================================
-- MEMBER/DEMOGRAPHIC FEATURES
-- =============================================================================

member_features AS (
  SELECT
    li.msno,
    li.cutoff_ts,

    -- City (one-hot or ordinal)
    COALESCE(m.city, 0) AS city,

    -- Age (cleaned)
    CASE
      WHEN CAST(m.bd AS INTEGER) BETWEEN 10 AND 80 THEN CAST(m.bd AS INTEGER)
      ELSE NULL
    END AS age,

    -- Gender encoding
    CASE
      WHEN m.gender = 'male' THEN 0
      WHEN m.gender = 'female' THEN 1
      ELSE 2  -- unknown
    END AS gender,

    -- Registration channel
    COALESCE(CAST(m.registered_via AS INTEGER), 0) AS registered_via,

    -- Tenure: days since registration
    CASE
      WHEN TRY_CAST(strptime(CAST(m.registration_init_time AS VARCHAR), '%Y%m%d') AS DATE) IS NOT NULL
      THEN li.cutoff_ts - TRY_CAST(strptime(CAST(m.registration_init_time AS VARCHAR), '%Y%m%d') AS DATE)
      ELSE NULL
    END AS tenure_days

  FROM label_index li
  LEFT JOIN read_csv_auto('${members_path}') m ON li.msno = m.msno
)

-- =============================================================================
-- FINAL OUTPUT: Combine all features
-- =============================================================================

SELECT
  li.msno,
  li.is_churn,
  li.cutoff_ts,

  -- =========================================================================
  -- TRANSACTION FEATURES (25+ features)
  -- =========================================================================

  -- 90-day window
  COALESCE(tx90.tx_count_90d, 0) AS tx_count_90d,
  COALESCE(tx90.cancel_count_90d, 0) AS cancel_count_90d,
  COALESCE(tx90.auto_renew_count_90d, 0) AS auto_renew_count_90d,
  COALESCE(tx90.auto_renew_ratio_90d, 0) AS auto_renew_ratio_90d,
  COALESCE(tx90.cancel_ratio_90d, 0) AS cancel_ratio_90d,
  COALESCE(tx90.total_paid_90d, 0) AS total_paid_90d,
  COALESCE(tx90.avg_paid_90d, 0) AS avg_paid_90d,
  COALESCE(tx90.std_paid_90d, 0) AS std_paid_90d,
  COALESCE(tx90.max_paid_90d, 0) AS max_paid_90d,
  COALESCE(tx90.min_paid_90d, 0) AS min_paid_90d,
  COALESCE(tx90.avg_plan_days_90d, 30) AS avg_plan_days_90d,
  COALESCE(tx90.max_plan_days_90d, 30) AS max_plan_days_90d,
  COALESCE(tx90.min_plan_days_90d, 30) AS min_plan_days_90d,
  COALESCE(tx90.avg_discount_90d, 0) AS avg_discount_90d,
  COALESCE(tx90.discount_tx_count_90d, 0) AS discount_tx_count_90d,
  COALESCE(tx90.unique_payment_methods_90d, 0) AS unique_payment_methods_90d,
  COALESCE(tx90.most_common_payment_method, 0) AS most_common_payment_method,
  COALESCE(tx90.days_since_last_tx, 90) AS days_since_last_tx,
  COALESCE(tx90.latest_auto_renew, 0) AS latest_auto_renew,
  COALESCE(tx90.latest_plan_days, 30) AS latest_plan_days,

  -- Membership expiry
  CASE
    WHEN tx90.latest_expire_date IS NOT NULL
    THEN tx90.latest_expire_date - li.cutoff_ts
    ELSE 0
  END AS membership_days_remaining,

  -- 60-day window
  COALESCE(tx60.tx_count_60d, 0) AS tx_count_60d,
  COALESCE(tx60.cancel_count_60d, 0) AS cancel_count_60d,
  COALESCE(tx60.auto_renew_ratio_60d, 0) AS auto_renew_ratio_60d,
  COALESCE(tx60.total_paid_60d, 0) AS total_paid_60d,
  COALESCE(tx60.avg_paid_60d, 0) AS avg_paid_60d,

  -- 30-day window
  COALESCE(tx30.tx_count_30d, 0) AS tx_count_30d,
  COALESCE(tx30.cancel_count_30d, 0) AS cancel_count_30d,
  COALESCE(tx30.auto_renew_ratio_30d, 0) AS auto_renew_ratio_30d,
  COALESCE(tx30.total_paid_30d, 0) AS total_paid_30d,

  -- 14-day window
  COALESCE(tx14.tx_count_14d, 0) AS tx_count_14d,
  COALESCE(tx14.cancel_count_14d, 0) AS cancel_count_14d,
  COALESCE(tx14.total_paid_14d, 0) AS total_paid_14d,

  -- 7-day window
  COALESCE(tx7.tx_count_7d, 0) AS tx_count_7d,
  COALESCE(tx7.cancel_count_7d, 0) AS cancel_count_7d,
  COALESCE(tx7.total_paid_7d, 0) AS total_paid_7d,

  -- =========================================================================
  -- USER LOG FEATURES (50+ features)
  -- =========================================================================

  -- 90-day window
  COALESCE(log90.log_days_90d, 0) AS log_days_90d,
  COALESCE(log90.active_days_90d, 0) AS active_days_90d,
  COALESCE(log90.total_secs_90d, 0) AS total_secs_90d,
  COALESCE(log90.avg_secs_per_day_90d, 0) AS avg_secs_per_day_90d,
  COALESCE(log90.std_secs_90d, 0) AS std_secs_90d,
  COALESCE(log90.max_secs_day_90d, 0) AS max_secs_day_90d,
  COALESCE(log90.min_secs_day_90d, 0) AS min_secs_day_90d,
  COALESCE(log90.total_unq_90d, 0) AS total_unq_90d,
  COALESCE(log90.avg_unq_per_day_90d, 0) AS avg_unq_per_day_90d,
  COALESCE(log90.std_unq_90d, 0) AS std_unq_90d,
  COALESCE(log90.total_completed_90d, 0) AS total_completed_90d,
  COALESCE(log90.total_skipped_early_90d, 0) AS total_skipped_early_90d,
  COALESCE(log90.total_50pct_90d, 0) AS total_50pct_90d,
  COALESCE(log90.total_75pct_90d, 0) AS total_75pct_90d,
  COALESCE(log90.total_almost_complete_90d, 0) AS total_almost_complete_90d,
  COALESCE(log90.total_plays_90d, 0) AS total_plays_90d,
  COALESCE(log90.completion_rate_90d, 0) AS completion_rate_90d,
  COALESCE(log90.early_skip_rate_90d, 0) AS early_skip_rate_90d,
  COALESCE(log90.days_since_last_listen, 90) AS days_since_last_listen,

  -- 60-day window
  COALESCE(log60.active_days_60d, 0) AS active_days_60d,
  COALESCE(log60.total_secs_60d, 0) AS total_secs_60d,
  COALESCE(log60.avg_secs_per_day_60d, 0) AS avg_secs_per_day_60d,
  COALESCE(log60.total_unq_60d, 0) AS total_unq_60d,
  COALESCE(log60.total_completed_60d, 0) AS total_completed_60d,
  COALESCE(log60.total_plays_60d, 0) AS total_plays_60d,
  COALESCE(log60.completion_rate_60d, 0) AS completion_rate_60d,

  -- 30-day window
  COALESCE(log30.active_days_30d, 0) AS active_days_30d,
  COALESCE(log30.total_secs_30d, 0) AS total_secs_30d,
  COALESCE(log30.avg_secs_per_day_30d, 0) AS avg_secs_per_day_30d,
  COALESCE(log30.std_secs_30d, 0) AS std_secs_30d,
  COALESCE(log30.total_unq_30d, 0) AS total_unq_30d,
  COALESCE(log30.avg_unq_per_day_30d, 0) AS avg_unq_per_day_30d,
  COALESCE(log30.total_completed_30d, 0) AS total_completed_30d,
  COALESCE(log30.total_skipped_early_30d, 0) AS total_skipped_early_30d,
  COALESCE(log30.total_plays_30d, 0) AS total_plays_30d,
  COALESCE(log30.completion_rate_30d, 0) AS completion_rate_30d,
  COALESCE(log30.early_skip_rate_30d, 0) AS early_skip_rate_30d,

  -- 14-day window
  COALESCE(log14.active_days_14d, 0) AS active_days_14d,
  COALESCE(log14.total_secs_14d, 0) AS total_secs_14d,
  COALESCE(log14.avg_secs_per_day_14d, 0) AS avg_secs_per_day_14d,
  COALESCE(log14.total_unq_14d, 0) AS total_unq_14d,
  COALESCE(log14.total_plays_14d, 0) AS total_plays_14d,
  COALESCE(log14.completion_rate_14d, 0) AS completion_rate_14d,

  -- 7-day window
  COALESCE(log7.active_days_7d, 0) AS active_days_7d,
  COALESCE(log7.total_secs_7d, 0) AS total_secs_7d,
  COALESCE(log7.avg_secs_per_day_7d, 0) AS avg_secs_per_day_7d,
  COALESCE(log7.total_unq_7d, 0) AS total_unq_7d,
  COALESCE(log7.total_plays_7d, 0) AS total_plays_7d,
  COALESCE(log7.completion_rate_7d, 0) AS completion_rate_7d,

  -- =========================================================================
  -- TREND FEATURES (comparing windows)
  -- =========================================================================

  -- Listening trend: is user listening more or less recently?
  COALESCE(log30.total_secs_30d, 0) - COALESCE(log60.total_secs_60d, 0) * 0.5 AS listening_trend_30v60,
  COALESCE(log14.total_secs_14d, 0) - COALESCE(log30.total_secs_30d, 0) * 0.467 AS listening_trend_14v30,
  COALESCE(log7.total_secs_7d, 0) - COALESCE(log14.total_secs_14d, 0) * 0.5 AS listening_trend_7v14,

  -- Activity trend
  COALESCE(log30.active_days_30d, 0) * 1.0 / 30 AS activity_rate_30d,
  COALESCE(log7.active_days_7d, 0) * 1.0 / 7 AS activity_rate_7d,

  -- Transaction trend
  COALESCE(tx30.tx_count_30d, 0) - COALESCE(tx60.tx_count_60d, 0) * 0.5 AS tx_trend_30v60,

  -- =========================================================================
  -- MEMBER FEATURES (5+ features)
  -- =========================================================================

  COALESCE(mf.city, 0) AS city,
  COALESCE(mf.age, 25) AS age,
  COALESCE(mf.gender, 2) AS gender,
  COALESCE(mf.registered_via, 0) AS registered_via,
  COALESCE(CAST(mf.tenure_days AS INTEGER), 365) AS tenure_days,

  -- =========================================================================
  -- DERIVED RATIO FEATURES
  -- =========================================================================

  -- Average song length (engagement depth)
  CASE
    WHEN COALESCE(log90.total_unq_90d, 0) > 0
    THEN COALESCE(log90.total_secs_90d, 0) / log90.total_unq_90d
    ELSE 0
  END AS avg_song_length_90d,

  -- Revenue per active day
  CASE
    WHEN COALESCE(log90.active_days_90d, 0) > 0
    THEN COALESCE(tx90.total_paid_90d, 0) / log90.active_days_90d
    ELSE 0
  END AS revenue_per_active_day,

  -- Engagement consistency (std / mean)
  CASE
    WHEN COALESCE(log90.avg_secs_per_day_90d, 0) > 0
    THEN COALESCE(log90.std_secs_90d, 0) / log90.avg_secs_per_day_90d
    ELSE 0
  END AS listening_consistency_90d

FROM label_index li
LEFT JOIN tx_features_90d tx90 ON li.msno = tx90.msno
LEFT JOIN tx_features_60d tx60 ON li.msno = tx60.msno
LEFT JOIN tx_features_30d tx30 ON li.msno = tx30.msno
LEFT JOIN tx_features_14d tx14 ON li.msno = tx14.msno
LEFT JOIN tx_features_7d tx7 ON li.msno = tx7.msno
LEFT JOIN log_features_90d log90 ON li.msno = log90.msno
LEFT JOIN log_features_60d log60 ON li.msno = log60.msno
LEFT JOIN log_features_30d log30 ON li.msno = log30.msno
LEFT JOIN log_features_14d log14 ON li.msno = log14.msno
LEFT JOIN log_features_7d log7 ON li.msno = log7.msno
LEFT JOIN member_features mf ON li.msno = mf.msno
ORDER BY li.msno;
