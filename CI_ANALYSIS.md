# CI/CD Pipeline Analysis - Critical Issues

## Executive Summary

Your CI/CD pipeline is failing due to **5 major categories of issues**:

| Category | Severity | # Issues | Impact |
|----------|----------|----------|--------|
| **Test Failures** | CRITICAL | 10/15 tests | Pipeline blocked |
| **SQL Compatibility** | CRITICAL | 2 files | DuckDB version mismatch |
| **Missing Data Paths** | HIGH | 3 targets | Backtest/PSI can't run |
| **Code Quality** | MEDIUM | 100+ issues | Lint warnings |
| **Workflow Config** | LOW | 2 issues | Missing secrets/permissions |

---

## Issue #1: DuckDB INTERVAL/INTEGER Type Mismatch (CRITICAL)

### Location
`features/features.sqlx` lines 198, 226

### Error
```
_duckdb.BinderException: Binder Error: Cannot mix values of type INTERVAL and INTEGER_LITERAL in COALESCE operator
```

### Root Cause
The SQL calculates `tenure_days` as a date subtraction (which returns INTERVAL in newer DuckDB):
```sql
(li.feature_cutoff - MIN(tp.transaction_date)) AS tenure_days
```
Then tries to COALESCE with an integer:
```sql
COALESCE(txf.tenure_days, 0) AS tenure_days  -- ← INTERVAL vs INTEGER
```

### Fix
```sql
-- Option 1: Extract days from interval
COALESCE(DATE_DIFF('day', MIN(tp.transaction_date), li.feature_cutoff), 0) AS tenure_days

-- Option 2: Cast the COALESCE
COALESCE(EXTRACT(DAY FROM txf.tenure_days), 0) AS tenure_days
```

### Files to Update
- `features/features.sqlx` (lines 70, 176, 198, 226)
- `features/features_simple.sql` (if applicable)

---

## Issue #2: Test File References Wrong SQL (CRITICAL)

### Location
`tests/test_feature_windows.py` line 137, 205, 263, 316

### Error
```
FileNotFoundError: features/features.sqlx
```

### Root Cause
Tests reference `features/features.sqlx` but the CI may be using `features/features_simple.sql`. The two files have different schemas and outputs.

### Fix
1. Standardize on ONE feature SQL file
2. Update tests to use the correct file
3. Or create a symlink: `features/features.sql` → `features/features_simple.sql`

---

## Issue #3: Label Logic Test Failures (HIGH)

### Location
`tests/test_labels.py` - 5 failing tests

### Errors
```
AssertionError: User3 should not churn (renewed day 30)
ValueError: Label accuracy 0.8000 below required 0.9900
AssertionError: Same-day renewal should not be churn
KeyError: 'expire_date' - column doesn't exist in output
```

### Root Causes
1. **Day 30 vs Day 31 edge case**: The test expects day 30 to be "not churn", but code may be using `<=` vs `<`
2. **Column naming mismatch**: Test expects `expire_date`, code returns `last_expire_date`
3. **Malformed date handling**: Code throws exception instead of filtering

### Fix
Update `src/labels.py` to:
1. Use `<= 30` for the renewal window (not `< 30`)
2. Ensure output columns match test expectations
3. Add `IGNORE_ERRORS=TRUE` to `TRY_CAST` date parsing

---

## Issue #4: Backtest References Non-Existent Data (HIGH)

### Location
`Makefile` lines 57-63

### Error
The `make backtest` command references:
```
--transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv
--user-logs kkbox-churn-prediction-challenge/data/churn_comp_refresh/user_logs_v2.csv
--members kkbox-churn-prediction-challenge/data/churn_comp_refresh/members_v3.csv
```

These files **don't exist** in the repository (they're the Kaggle competition data).

### Fix
1. Create synthetic data fixtures for CI
2. Update `make backtest` to use synthetic data in CI mode:

```makefile
backtest-ci:
	@echo "⏱ Rolling backtests (synthetic)..."
	python3 src/backtest.py \
	  --transactions tests/fixtures/transactions_synthetic.csv \
	  --user-logs tests/fixtures/user_logs_synthetic.csv \
	  --members tests/fixtures/members_synthetic.csv \
	  --train-placeholder tests/fixtures/train_synthetic.csv \
	  --out eval/backtests.csv
```

---

## Issue #5: Code Quality (100+ Lint Errors)

### Categories

| Issue Type | Count | Example |
|------------|-------|---------|
| W293: Blank line whitespace | 50+ | Throughout calibration.py |
| E701: Multiple statements | 15+ | `if x: return` on one line |
| F401: Unused imports | 10+ | `json`, `datetime`, etc. |
| N803: Argument naming | 8+ | `X_cal` should be `x_cal` |
| UP006: Deprecated typing | 5+ | `Dict` should be `dict` |
| E722: Bare except | 3 | `except:` should be `except Exception:` |

### Files Most Affected
1. `src/backtest.py` - 25 issues
2. `src/calibration.py` - 40 issues
3. `src/models.py` - 30 issues

### Fix
Run auto-formatter:
```bash
black src/ tests/
ruff --fix src/ tests/
```

---

## Issue #6: Missing Synthetic Test Fixtures

### Location
`tests/fixtures/` only contains `generate_synthetic.py`

### Problem
Tests and CI targets expect pre-generated CSV files:
- `tests/fixtures/train_synthetic.csv`
- `tests/fixtures/transactions_synthetic.csv`
- `tests/fixtures/user_logs_synthetic.csv`
- `tests/fixtures/members_synthetic.csv`

### Fix
1. Run the generator and commit the outputs:
```bash
python tests/fixtures/generate_synthetic.py
git add tests/fixtures/*.csv
```

2. Or add to CI:
```yaml
- name: Generate test fixtures
  run: python tests/fixtures/generate_synthetic.py
```

---

## Issue #7: CI Workflow Structure

### Current Workflow (`ci.yml`)
```yaml
- name: Backtests + PSI (synthetic)
  run: |
    make backtest      # ← Uses non-existent real data paths!
    make psi
    python3 scripts/update_readme.py
```

### Problems
1. `make backtest` expects Kaggle data that doesn't exist
2. No conditional logic for CI vs local development
3. Missing step to generate synthetic fixtures

### Recommended Fix
```yaml
- name: Generate synthetic fixtures
  run: python tests/fixtures/generate_synthetic.py

- name: Backtests + PSI (synthetic)
  run: |
    make backtest-ci   # ← New target using synthetic data
    make psi
```

---

## Recommended Fix Priority

### Phase 1: Unblock CI (Do First)

1. **Fix DuckDB INTERVAL issue** in `features/features.sqlx`
2. **Generate and commit synthetic fixtures**
3. **Add `backtest-ci` target** using synthetic data

### Phase 2: Fix Tests

4. **Update test file references** to correct SQL file
5. **Fix label logic edge cases** (day 30 boundary)
6. **Fix column name mismatches** in test assertions

### Phase 3: Clean Up

7. **Run formatters** (`black`, `ruff --fix`)
8. **Remove unused imports**
9. **Update pyproject.toml** for deprecated ruff options

---

## Quick Fix Script

Run this to address the most critical issues:

```bash
# 1. Generate synthetic fixtures
python tests/fixtures/generate_synthetic.py

# 2. Auto-format code
pip install black ruff
black src/ tests/
ruff --fix src/ tests/

# 3. Commit fixtures
git add tests/fixtures/*.csv tests/fixtures/*.parquet
git commit -m "fix: add synthetic test fixtures for CI"
```

---

## CI Workflow Improvements

### Recommended New `ci.yml`

```yaml
name: ci
on:
  push:
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install ruff black
      - run: ruff check src/ tests/
      - run: black --check src/ tests/

  test:
    runs-on: ubuntu-latest
    needs: lint  # Only run tests if lint passes
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt pytest
      - run: python tests/fixtures/generate_synthetic.py
      - run: pytest tests/ -v

  build:
    runs-on: ubuntu-latest
    needs: test  # Only build if tests pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt
      - run: make features
      - run: make models
      - run: make calibrate
      - uses: actions/upload-artifact@v4
        with:
          name: models
          path: models/
```

---

## Files Needing Changes

| File | Changes Required |
|------|------------------|
| `features/features.sqlx` | Fix INTERVAL/INTEGER COALESCE |
| `tests/test_feature_windows.py` | Update SQL file path reference |
| `tests/test_labels.py` | Fix column names, edge cases |
| `src/labels.py` | Fix day 30 boundary logic |
| `src/backtest.py` | Fix bare except, whitespace |
| `src/calibration.py` | Fix whitespace, unused imports |
| `Makefile` | Add `backtest-ci` target |
| `.github/workflows/ci.yml` | Restructure with stages |
| `tests/fixtures/` | Add generated CSV files |
