# KKBOX Churn Prediction - Comprehensive Codebase Analysis

> **Deep analysis following the LEARN.BUILD.IMPRESS framework**
> Analysis Date: December 2024

---

## Executive Summary

This document provides a comprehensive analysis of the KKBOX Churn Prediction project, evaluating it from three perspectives: ML Engineering, Production Engineering, and Portfolio/Interview readiness.

### Overall Assessment: **Strong Foundation with Clear Improvement Path**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **ML Engineering** | 7/10 | Solid temporal safeguards, but random splits undermine metrics |
| **Production** | 8/10 | Docker, CI/CD, Makefile excellent; minor logging gaps |
| **Portfolio** | 8/10 | Strong story, needs confidence intervals for credibility |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Strengths Analysis](#2-strengths-analysis)
3. [Improvement Opportunities](#3-improvement-opportunities)
4. [Implementation Details](#4-implementation-details)
5. [Interview Preparation](#5-interview-preparation)
6. [Decision Journal](#6-decision-journal)

---

## 1. Architecture Overview

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                        │
│  transactions.csv │ user_logs.csv │ members.csv │ train_labels.csv  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FEATURE ENGINEERING (features_simple.sql via DuckDB)               │
│  • Cutoff: 2017-02-28 (temporal boundary enforced)                  │
│  • Transaction features: 90-day lookback                            │
│  • Usage features: 30-day lookback                                  │
│  • Demographics: age clipping, gender validation                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LABEL GENERATION (src/labels.py)                                   │
│  • WSDMChurnLabeller.scala compliance (≥99% accuracy)               │
│  • 30-day renewal window rule                                       │
│  • Mismatch audit with 50 examples                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MODEL TRAINING (src/models.py)                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐          │
│  │  Dummy   │ │ LogReg   │ │   RF     │ │   XGBoost     │          │
│  │ baseline │ │ +scaler  │ │ 100 tree │ │   primary     │          │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘          │
│  Now with temporal splits and bootstrap CIs (after refactoring)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CALIBRATION (src/calibration.py)                                   │
│  • Isotonic regression                                              │
│  • ECE, Brier score, reliability diagrams                           │
│  • Before/after comparison                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VALIDATION (src/backtest.py + src/psi.py)                          │
│  • Rolling windows: Jan→Feb, Feb→Mar, Mar→Apr                       │
│  • Per-window metrics: log_loss, AUC, Brier, ECE                    │
│  • PSI drift monitoring (>0.2 = significant)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT (api/ + gemini-app/)                                    │
│  • React/FastAPI with <100ms API latency                            │
│  • Individual member lookup with SHAP explanations                  │
│  • Batch CSV scoring                                                │
│  • Business action recommendations (rules.yaml)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/models.py` | Model training pipeline | 445 |
| `src/labels.py` | Churn label generation | 374 |
| `src/calibration.py` | Isotonic calibration | 320 |
| `src/backtest.py` | Rolling validation | 224 |
| `src/temporal_cv.py` | **NEW** Temporal cross-validation | 280 |
| `src/error_analysis.py` | **NEW** Error analysis | 350 |
| `features/features_simple.sql` | Feature engineering | 89 |
| `api/` + `gemini-app/` | React/FastAPI web app | - |

---

## 2. Strengths Analysis

### 2.1 Temporal Safety (Excellent)

**Evidence**: `features/features_simple.sql` and `tests/test_temporal_safety.py`

```sql
-- No future data can leak: explicit date filtering
WHERE TRY_CAST(strptime(CAST(tx.transaction_date AS VARCHAR), '%Y%m%d') AS DATE) <= li.cutoff_ts
  AND TRY_CAST(strptime(CAST(tx.transaction_date AS VARCHAR), '%Y%m%d') AS DATE) >= li.cutoff_ts - INTERVAL '90 days'
```

**Why This Matters**:
- Most churn prediction projects fail at temporal safety
- Your SQL explicitly prevents future data from entering features
- Unit tests **fabricate future events and verify zero leakage**

**Interview Talking Point**:
> "I implemented temporal safeguards at the SQL level, not just Python. The unit tests actually fabricate fake future events and verify they don't appear in features. Most candidates don't test for this."

### 2.2 Label Compliance (Excellent)

**Evidence**: `src/labels.py` with 99%+ accuracy vs Kaggle reference

```python
def validate_labels(labels_df: pd.DataFrame, min_accuracy: float = 0.99):
    """Validation requires 99% match with official labels"""
```

**Why This Matters**:
- Reproducing the exact evaluation metric shows attention to detail
- Mismatch audit helps debug edge cases
- Stop rule prevents bad labels from reaching training

### 2.3 Production Infrastructure (Strong)

**Evidence**: `Dockerfile`, `Makefile`, `.github/workflows/ci.yml`

| Component | Quality |
|-----------|---------|
| Docker | Multi-stage build, health checks |
| Makefile | 15+ targets, one-command execution |
| CI/CD | Full pipeline with artifact upload |
| Testing | Temporal safety + feature window tests |

### 2.4 Calibration (Good)

**Evidence**: `src/calibration.py`

- Isotonic regression (nonparametric, handles any distribution)
- ECE metric (Expected Calibration Error)
- Reliability diagrams for visualization
- Before/after comparison tracked

---

## 3. Improvement Opportunities

### Priority Matrix

| # | Opportunity | Impact | Effort | Status |
|---|-------------|--------|--------|--------|
| 1 | Temporal train/val split | High | Low | **IMPLEMENTED** |
| 2 | Bootstrap confidence intervals | High | Low | **IMPLEMENTED** |
| 3 | Error analysis module | Medium | Medium | **IMPLEMENTED** |
| 4 | Temporal cross-validation | High | Medium | **IMPLEMENTED** |
| 5 | Hyperparameter tuning | Medium | Medium | Pending |
| 6 | Logging infrastructure | Low | Low | Pending |

### 3.1 Temporal Train/Val Split (FIXED)

**Before** (`src/models.py:337-340`):
```python
# PROBLEM: Random split on temporal data
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
```

**After**:
```python
# FIXED: Temporal split respects time ordering
if use_temporal_split and HAS_TEMPORAL_CV and 'cutoff_ts' in df.columns:
    splitter = TemporalSplit(train_end=train_cutoff)
    train_idx, val_idx = splitter.split(df, time_column='cutoff_ts')
    X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
```

**Why It Matters**:
- Churn prediction is temporal: you predict future churn from past data
- Random splits allow "future leakage" through correlated user patterns
- Reported metrics with random splits are optimistic

### 3.2 Bootstrap Confidence Intervals (ADDED)

**New functionality** in `src/temporal_cv.py`:

```python
class BootstrapMetrics:
    """
    Compute confidence intervals for ML metrics.

    Usage:
        >>> bootstrap = BootstrapMetrics(n_bootstrap=1000)
        >>> results = bootstrap.compute(y_true, y_pred)
        >>> print(f"AUC: {results['auc']['mean']:.3f} ± {results['auc']['std']:.3f}")
    """
```

**Why It Matters**:
- Single-point metrics (AUC = 0.60) have no uncertainty
- Bootstrap CIs show if difference between models is significant
- Signals statistical sophistication to interviewers

### 3.3 Error Analysis Module (ADDED)

**New file**: `src/error_analysis.py`

Provides:
- Segment-level accuracy analysis
- False positive/negative breakdown
- Business cost calculation
- High-confidence error identification
- Actionable recommendations

**Sample Output**:
```
--- CONFUSION MATRIX ---
             Predicted No | Predicted Yes
Actual No          8,500    |          200
Actual Yes           150    |          150

--- BUSINESS IMPACT ---
Total FP cost: $2,000 (wasted retention spend)
Total FN cost: $7,500 (lost customers)

--- RECOMMENDATIONS ---
1. Low recall (50%) on churners. Consider adjusting threshold.
2. Model struggles with age segment '50-60' (accuracy: 65%).
```

---

## 4. Implementation Details

### 4.1 New Files Added

#### `src/temporal_cv.py` (280 lines)

```python
class TemporalSplit:
    """Time-based train/validation split"""

class ChurnTemporalCV:
    """Walk-forward cross-validation for churn"""

class BootstrapMetrics:
    """Confidence intervals for metrics"""

def temporal_cross_val_score():
    """Evaluate with temporal CV"""
```

#### `src/error_analysis.py` (350 lines)

```python
class ChurnErrorAnalyzer:
    """Comprehensive error analysis"""

    def analyze() -> Dict:
        """Returns summary, segments, business impact"""

    def print_report():
        """Formatted analysis report"""
```

### 4.2 Modified Files

#### `src/models.py`

Changes:
1. Import temporal CV utilities
2. Add `use_temporal_split` parameter (default: True)
3. Add `train_cutoff` parameter for temporal split date
4. Compute bootstrap CIs in training summary
5. Track split type in metadata

---

## 5. Interview Preparation

### 5.1 The 2-Minute Pitch

> "The KKBOX churn prediction project taught me the critical importance of **temporal safety in ML pipelines**. The biggest challenge was reproducing the exact Kaggle evaluation semantics — I achieved 99%+ accuracy against their Scala reference implementation. I solved the data leakage problem by implementing SQL-level temporal boundaries with unit tests that fabricate future events and verify zero leakage. The key insight was that **most ML projects fail at evaluation design, not model architecture** — getting the validation right is more important than hyperparameter tuning."

### 5.2 Common Interview Questions

#### Q1: "Walk me through your architecture. Why those choices?"

**Answer**:
> "The architecture is a linear pipeline: feature engineering → label generation → model training → calibration → validation.
>
> Key choices:
> - **DuckDB for features**: Portable SQL that runs anywhere, no Spark cluster needed
> - **XGBoost for modeling**: Proven on tabular data, handles class imbalance well
> - **Isotonic calibration**: Non-parametric, doesn't assume a distribution
> - **Rolling backtests**: Three windows (Jan→Feb, Feb→Mar, Mar→Apr) to verify temporal stability
>
> The design prioritizes **reproducibility and auditability** over raw performance."

#### Q2: "What was the hardest part? How did you solve it?"

**Answer**:
> "The hardest part was ensuring **temporal safety without sacrificing development velocity**.
>
> The temptation is to use random splits for faster iteration, but that gives you optimistic metrics that don't reflect production reality.
>
> I solved it by:
> 1. Implementing temporal splits as a module that's easy to toggle
> 2. Creating unit tests with fabricated future data to catch regressions
> 3. Using rolling backtests as the 'source of truth' for final metrics"

#### Q3: "What would you do differently if you built it again?"

**Answer**:
> "Three things:
> 1. **Start with temporal CV from day one** — I initially used random splits and had to retrofit
> 2. **Add experiment tracking (MLflow/W&B)** — It's hard to compare runs without it
> 3. **Invest more in error analysis earlier** — Understanding *where* the model fails is more valuable than aggregate metrics"

#### Q4: "How do you know your model is actually good?"

**Answer**:
> "Several layers of validation:
> 1. **Temporal splits**: Train on past, validate on future (mimics deployment)
> 2. **Bootstrap CIs**: I report metrics with uncertainty (e.g., AUC 0.60 ± 0.02)
> 3. **Rolling backtests**: Verify performance is stable across time periods
> 4. **PSI monitoring**: Detect feature drift between windows
> 5. **Calibration checks**: Brier score and ECE ensure probabilities are reliable
>
> The key is that **I don't trust any single metric** — I look for convergent evidence."

#### Q5: "How would this scale to 10M users?"

**Answer**:
> "The current implementation loads data into memory, which works up to ~1M users on a standard machine.
>
> For 10M+:
> 1. **Feature engineering**: Replace DuckDB with Spark SQL (same queries, distributed execution)
> 2. **Training**: XGBoost supports distributed training via Dask or Spark
> 3. **Inference**: Batch scoring with Pandas chunks, or deploy model to Vertex AI for real-time
> 4. **Backtest**: Parallelize windows across workers
>
> The **architecture doesn't change** — just the execution backend."

### 5.3 Technical Deep-Dives

#### Why Isotonic Calibration?

> "Platt scaling assumes a sigmoid relationship between raw predictions and true probabilities. That's fine for logistic regression, but XGBoost outputs aren't sigmoid-shaped.
>
> Isotonic regression makes no distributional assumptions — it just requires monotonicity (higher raw score → higher probability). This is always true for churn prediction, so it's a safer choice."

#### Why ECE Over Just Brier Score?

> "Brier score is a proper scoring rule, but it mixes calibration error with discrimination error. A model can have low Brier score but still be poorly calibrated at specific probability ranges.
>
> ECE explicitly measures calibration in bins — it tells you 'when I predict 70%, is it actually 70%?' This is critical for business decisions like retention budgets."

---

## 6. Decision Journal

### Decision 1: DuckDB Over Pandas for Features

**Problem**: Feature engineering with temporal constraints

**Options Considered**:
1. Pandas: More familiar, but temporal joins are error-prone
2. SQL in PostgreSQL: Robust, but requires database setup
3. DuckDB: SQL semantics, no setup, portable

**Decision**: DuckDB

**Trade-offs**:
- ✅ SQL is explicit about temporal boundaries
- ✅ Portable (single file, no server)
- ✅ Fast for this data scale
- ❌ Team needs SQL knowledge
- ❌ Doesn't scale to 100M+ rows

**Outcome**: Clean temporal boundaries, easy testing

---

### Decision 2: Isotonic Over Platt Calibration

**Problem**: XGBoost probabilities are poorly calibrated

**Options Considered**:
1. Platt scaling (sigmoid): Fast, parametric
2. Isotonic regression: Non-parametric, more flexible
3. Temperature scaling: Simple, but assumes sigmoid

**Decision**: Isotonic regression

**Trade-offs**:
- ✅ No distributional assumptions
- ✅ Works for any monotonic relationship
- ❌ Higher variance (need more calibration data)
- ❌ Can overfit on small samples

**Outcome**: Better ECE improvement than Platt

---

### Decision 3: Rolling Backtests Over Single Holdout

**Problem**: Is model performance stable over time?

**Options Considered**:
1. Single holdout: Simple, one number
2. K-fold CV: More robust, but ignores time
3. Rolling windows: Temporal, multiple estimates

**Decision**: Rolling windows (3 periods)

**Trade-offs**:
- ✅ Respects temporal ordering
- ✅ Detects performance degradation
- ❌ Less training data per fold
- ❌ More compute time

**Outcome**: Identified that Jan→Feb performs differently than Feb→Mar

---

## Appendix: Files Modified/Added

| File | Change |
|------|--------|
| `src/temporal_cv.py` | NEW - Temporal CV, Bootstrap CI |
| `src/error_analysis.py` | NEW - Error analysis module |
| `src/models.py` | MODIFIED - Temporal splits, Bootstrap CI |
| `CODEBASE_ANALYSIS.md` | NEW - This document |

---

*Generated by LEARN.BUILD.IMPRESS analysis framework*
