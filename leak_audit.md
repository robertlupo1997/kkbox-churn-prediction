# Leak Audit

Principle
- Features must be computable as of the cutoff date for each sample.

As-of policy
- For label month M, use data up to end of month M-1.
- No joins to events after the cutoff for any sample.

Explicit exclusions
- next_renewal_date
- any future-labeled is_churn
- aggregates that include month M
- payment flags written after the cutoff

Window rules
- Transactions. aggregate in [cutoff-90d, cutoff].
- Usage. aggregate in [cutoff-30d, cutoff].
- Tenure. days since first valid payment up to cutoff.

SQL pattern
```sql
WITH idx AS (
  SELECT msno, cutoff_ts  -- month start
  FROM label_index
)
SELECT
  i.msno,
  SUM(CASE WHEN t.ts > i.cutoff_ts - INTERVAL '90 days' AND t.ts <= i.cutoff_ts THEN 1 END) AS tx_90d
FROM idx i
LEFT JOIN transactions t
  ON t.msno = i.msno
 AND t.ts <= i.cutoff_ts
GROUP BY i.msno;
```

Checks

* Unit tests assert no query uses ts > cutoff.
* Naive vs as-of feature diff shows expected drops on leakage-prone fields.
* Rolling backtests do not degrade by more than 10% log loss window to window.
