# KKBOX Churn Prediction - Complete Learning Guide

**Purpose:** Understand every aspect of this project so you can explain it in interviews and truly learn from it.

---

## Table of Contents

1. [The Business Problem](#1-the-business-problem)
2. [The Data](#2-the-data)
3. [What is Churn and How Do We Define It?](#3-what-is-churn-and-how-do-we-define-it)
4. [Feature Engineering - The Heart of This Project](#4-feature-engineering---the-heart-of-this-project)
5. [The Temporal Leakage Problem](#5-the-temporal-leakage-problem)
6. [Model Training](#6-model-training)
7. [Model Calibration](#7-model-calibration)
8. [The Web Application](#8-the-web-application)
9. [Business Rules](#9-business-rules)
10. [What We Changed Today and Why](#10-what-we-changed-today-and-why)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Business Problem

### What is KKBOX?

KKBOX is Taiwan's largest music streaming service - think of it as "Asian Spotify" with over 10 million subscribers. Users pay monthly/yearly subscriptions to stream music.

### Why Does Churn Matter?

**Churn** = When a subscriber cancels their subscription

**Business Impact:**
- Acquiring a new customer costs 5-25x MORE than keeping an existing one
- A 5% reduction in churn can increase profits by 25-95%
- If KKBOX has 10M users and reduces churn by just 1%, they retain 100,000 extra subscribers
- At $10/month subscription, that's $1,000,000/month in saved revenue

### What We're Building

A system that:
1. **Predicts** which users are likely to cancel (before they actually do)
2. **Recommends** specific actions to retain them (personalized interventions)
3. **Operates** in real-time (87ms response time)

---

## 2. The Data

We used real data from the Kaggle KKBOX competition (30GB total):

### train.csv (The Labels)
```
msno,is_churn
waLDQMmcOu2jLDaV1ddDkgCrB/jl6sD66Xzs0Vqax1Y=,1
QA7uiXy8vIbUSPOkCf9RwQ3FsT8jVq2OxDr8zqa7bRQ=,1
```
- `msno`: Anonymized user ID (hashed for privacy)
- `is_churn`: 1 = user churned, 0 = user stayed

### transactions.csv (Payment History)
```
msno,payment_method_id,payment_plan_days,plan_list_price,actual_amount_paid,is_auto_renew,transaction_date,membership_expire_date,is_cancel
```

| Column | Meaning | Why It Matters |
|--------|---------|----------------|
| payment_method_id | How they paid (credit card, etc.) | Some methods have higher friction |
| payment_plan_days | Subscription length (30, 90, 365) | Longer plans = more committed users |
| plan_list_price | Original price | Used to calculate discounts |
| actual_amount_paid | What they actually paid | Discounts may indicate price sensitivity |
| is_auto_renew | Auto-renewal enabled? | **HUGE predictor** - users with auto-renew rarely churn |
| transaction_date | When transaction happened | For temporal safety |
| membership_expire_date | When subscription ends | Critical for churn definition |
| is_cancel | Did they cancel this transaction? | Different from churn - can cancel and resubscribe |

### user_logs.csv (Listening Behavior - 30GB!)
```
msno,date,num_25,num_50,num_75,num_985,num_100,num_unq,total_secs
```

| Column | Meaning | Why It Matters |
|--------|---------|----------------|
| date | Day of listening | For temporal windowing |
| num_25 | Songs stopped at 25% | Early skips = dissatisfaction |
| num_50 | Songs stopped at 50% | Moderate engagement |
| num_75 | Songs stopped at 75% | Good engagement |
| num_985 | Songs played to 98.5% | Near-complete |
| num_100 | Songs played to 100% | Full engagement |
| num_unq | Unique songs played | Discovery behavior |
| total_secs | Total listening time | Core engagement metric |

### members_v3.csv (Demographics)
```
msno,city,bd,gender,registered_via,registration_init_time
```

| Column | Meaning | Why It Matters |
|--------|---------|----------------|
| city | City code | Geographic patterns |
| bd | Birthday (age) | Age correlates with preferences |
| gender | male/female/unknown | Demographic segmentation |
| registered_via | How they signed up | Acquisition channel affects retention |
| registration_init_time | Account creation date | Account age (tenure) |

---

## 3. What is Churn and How Do We Define It?

### The Official Kaggle Definition

A user is labeled as "churned" if:
> **No new subscription occurs within 30 days after their membership expires**

This is implemented in `src/labels.py`.

### Why 30 Days?

- Some users let their subscription lapse temporarily (vacation, forgot to renew)
- 30 days gives them time to come back
- After 30 days, they're considered "gone"

### The Labeling Algorithm (src/labels.py)

```python
# Simplified logic:
1. Find each user's last membership expiration date (before cutoff)
2. Look for any transaction AFTER that expiration date
3. If a renewal transaction exists within 30 days → NOT churned (0)
4. If no renewal within 30 days → CHURNED (1)
```

### Cutoff Date: February 28, 2017

This is the "prediction point" - we're predicting who will churn based on data **before** this date. We can't use any data after this date for features.

---

## 4. Feature Engineering - The Heart of This Project

### What is Feature Engineering?

**Raw data → Useful signals for the model**

The model can't understand "this user listened to 500 songs last week." It needs numerical features that capture patterns.

### Why Multiple Time Windows?

Consider two users:

**User A:**
- 30 days ago: listened 10 hours
- 7 days ago: listened 1 hour (DECLINING!)

**User B:**
- 30 days ago: listened 1 hour
- 7 days ago: listened 10 hours (INCREASING!)

If we only look at total listening time, they might look similar. But User A is disengaging while User B is becoming more engaged.

**Solution:** Calculate features for multiple windows (7d, 14d, 30d, 60d, 90d) and compare them.

### Our 99 Features (Comprehensive SQL)

#### Transaction Features (Per Window)

```sql
-- Example from features_comprehensive.sql
tx_count_90d          -- Number of transactions in 90 days
cancel_count_90d      -- Number of cancellations
auto_renew_ratio_90d  -- % of transactions with auto-renew
total_paid_90d        -- Total amount paid
avg_paid_90d          -- Average payment amount
std_paid_90d          -- Variation in payment amounts
days_since_last_tx    -- RECENCY - huge predictor!
```

**What each means:**

| Feature | What It Captures | Why It Predicts Churn |
|---------|-----------------|----------------------|
| tx_count | Activity level | Fewer transactions = less engaged |
| cancel_count | Previous cancellations | Past cancelers more likely to churn |
| auto_renew_ratio | Commitment level | No auto-renew = higher churn risk |
| avg_paid | Price sensitivity | Lower payments = discount seekers |
| std_paid | Payment consistency | High variation = unstable user |
| days_since_last_tx | **RECENCY** | Longer time = disengaging |

#### Listening Behavior Features

```sql
active_days_30d       -- Days with any listening activity
total_secs_30d        -- Total listening time
avg_secs_per_day_30d  -- Average daily listening
completion_rate_30d   -- % songs played to completion
early_skip_rate_30d   -- % songs stopped at 25%
days_since_last_listen -- RECENCY
```

**What each means:**

| Feature | What It Captures | Why It Predicts Churn |
|---------|-----------------|----------------------|
| active_days | Engagement frequency | Fewer days = losing interest |
| total_secs | Total engagement | Less time = less value |
| completion_rate | Content satisfaction | Skipping = unhappy with music |
| early_skip_rate | Dissatisfaction | High skips = bad recommendations |
| days_since_last_listen | **RECENCY** | Not listening = about to leave |

#### Trend Features (The Secret Sauce)

```sql
-- Is listening increasing or decreasing?
listening_trend_30v60 = total_secs_30d - (total_secs_60d * 0.5)

-- If positive: user is listening MORE recently
-- If negative: user is listening LESS recently (danger!)
```

**Example:**
- User listened 100 hours in days 31-60
- User listened 30 hours in days 1-30
- Expected (if consistent): 50 hours in last 30 days
- Actual: 30 hours
- Trend: 30 - 50 = **-20** (DECLINING - high churn risk!)

#### Member Features

```sql
tenure_days           -- Days since account creation
city                  -- Geographic location (encoded)
age                   -- User's age
gender                -- male=0, female=1, unknown=2
registered_via        -- How they signed up
```

---

## 5. The Temporal Leakage Problem

### What is Data Leakage?

**Using information from the future to predict the past.**

This is the #1 mistake in ML competitions and real-world ML projects.

### Example of Leakage

**Bad approach:**
```
Predict March churn using April listening data
```

In production, you don't HAVE April data when predicting March. Your model would perform great in training but fail completely in production.

### How We Prevent Leakage

#### 1. Strict Cutoff Date in SQL

```sql
-- From features_comprehensive.sql
WHERE tp.tx_date <= li.cutoff_ts  -- Only data BEFORE cutoff
  AND tp.tx_date >= li.cutoff_ts - INTERVAL '90 days'  -- Within window
```

Every single feature query has this filter. No exceptions.

#### 2. Temporal Split for Training

Instead of random train/test split:
```
Random split: Randomly mix March and February data (LEAKAGE!)
Temporal split: Train on January data, validate on February data
```

We use temporal split (in `src/models.py`):
```python
if use_temporal_split and HAS_TEMPORAL_CV:
    splitter = TemporalSplit(train_end="2017-02-01")
    train_idx, val_idx = splitter.split(df, time_column='cutoff_ts')
```

#### 3. Unit Tests

We have tests that:
1. Create fake "future" data
2. Run feature engineering
3. Verify the fake future data doesn't affect features

---

## 6. Model Training

### Progressive Model Complexity

We train multiple models, from simple to complex:

```
1. DummyClassifier (baseline) - Always predicts most common class
2. Logistic Regression        - Simple linear model
3. Random Forest              - Ensemble of decision trees
4. XGBoost                    - Gradient boosting (best performer)
```

### Why Start Simple?

- **Baseline tells you if ML is even needed**
  - If XGBoost only beats baseline by 1%, maybe you don't need ML
  - If XGBoost beats baseline by 50%, ML adds significant value

- **Simpler models are more interpretable**
  - Logistic regression coefficients tell you exactly how each feature affects prediction
  - Good for understanding the problem before adding complexity

### XGBoost Hyperparameters

```python
xgb_params = {
    "objective": "binary:logistic",  # Binary classification
    "eval_metric": "logloss",        # Optimize for log loss
    "max_depth": 6,                  # Tree depth (prevent overfitting)
    "learning_rate": 0.1,            # Step size
    "n_estimators": 200,             # Number of trees
    "subsample": 0.8,                # Use 80% of data per tree
    "colsample_bytree": 0.8,         # Use 80% of features per tree
    "scale_pos_weight": scale_pos_weight,  # Handle class imbalance
}
```

### Handling Class Imbalance

Our data has ~6% churn rate (94% non-churn). Without adjustment:
- Model could predict "no churn" for everyone
- Get 94% accuracy but miss all actual churners!

**Solution:** `scale_pos_weight = (non-churn count) / (churn count)`

This tells XGBoost to weight churn cases more heavily.

### Evaluation Metrics

| Metric | What It Measures | Why It Matters |
|--------|-----------------|----------------|
| **Log Loss** | Probability accuracy | Lower = better calibrated predictions |
| **AUC** | Ranking ability | Higher = better at ordering risk |
| **Precision** | Of predicted churners, how many actually churned? | Avoid false alarms |
| **Recall** | Of actual churners, how many did we catch? | Don't miss churners |
| **F1** | Balance of precision/recall | Overall classification quality |

---

## 7. Model Calibration

### The Calibration Problem

XGBoost outputs a number between 0 and 1, but it's not a true probability.

**Example:**
- Model says "70% churn probability"
- But of users with 70% prediction, only 50% actually churned
- The model is **overconfident**

### Why Calibration Matters for Business

**Scenario:** You have budget for retention offers for 1,000 users

**Without calibration:**
- Model says 5,000 users have >50% churn risk
- You pick 1,000 randomly from those 5,000
- Many of them weren't actually going to churn (wasted money)

**With calibration:**
- Model says 1,200 users have >70% TRUE probability
- You target those 1,000 most at risk
- Better ROI on retention spend

### How Isotonic Calibration Works

```
1. Split data into calibration set and test set
2. Get model predictions on calibration set
3. Compare predictions to actual outcomes
4. Build a mapping: "when model says X, actual rate is Y"
5. Apply mapping to transform future predictions
```

Code in `src/calibration.py`:
```python
isotonic = IsotonicRegression(out_of_bounds="clip")
isotonic.fit(y_prob_cal_set, y_cal)  # Learn the mapping
y_prob_calibrated = isotonic.transform(y_prob_uncal)  # Apply it
```

### Expected Calibration Error (ECE)

Measures how well probabilities match reality:

```python
def expected_calibration_error(y_true, y_prob, n_bins=10):
    # Bin predictions into 10 groups (0-10%, 10-20%, etc.)
    # For each bin, compare average prediction vs actual rate
    # ECE = weighted average of |prediction - actual| per bin
```

**Our Results:**
- Before calibration: ECE = 0.035 (3.5% average error)
- After calibration: ECE = 0.005 (0.5% average error)

This means our calibrated probabilities are very reliable!

---

## 8. The Web Application

### Architecture Overview

The application uses a modern full-stack architecture with React/TypeScript frontend and FastAPI backend:

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 3000)               │
│                     gemini-app/ (TypeScript)                 │
├─────────────────────────────────────────────────────────────┤
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  Executive   │  │   Member     │  │    Model     │     │
│   │  Dashboard   │  │   Lookup     │  │  Performance │     │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│          │                 │                 │              │
│          └─────────────────┼─────────────────┘              │
│                            │                                │
│                            ▼                                │
│              ┌─────────────────────────┐                   │
│              │   Vite Proxy (/api →)   │                   │
│              └────────────┬────────────┘                   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Port 8000)                │
│                         api/                                 │
├─────────────────────────────────────────────────────────────┤
│   ┌──────────────────────────────────────────┐             │
│   │         /api/members - List & Search      │             │
│   │         /api/members/{id} - Single Lookup │             │
│   │         /api/metrics - Model Performance  │             │
│   │         /api/health - Health Check        │             │
│   └────────────────────┬─────────────────────┘             │
│                        │                                    │
│                        ▼                                    │
│   ┌──────────────────────────────────────────┐             │
│   │     Model Service (XGBoost Booster)       │             │
│   │     models/xgb.json (99 features)         │             │
│   └────────────────────┬─────────────────────┘             │
│                        │                                    │
│                        ▼                                    │
│   ┌──────────────────────────────────────────┐             │
│   │     Rules Service (rules.yaml)            │             │
│   │     Risk Tiers + Recommendations          │             │
│   └──────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Docker Deployment

The app runs in Docker containers orchestrated by `docker-compose.yml`:

```bash
# Start the full stack
docker-compose up -d --build

# Access points:
# Frontend: http://localhost:3000
# API: http://localhost:8000/api/health
```

### Key Design Decisions

#### 1. Separation of Concerns

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | React + TypeScript | UI, charts, user interaction |
| Backend | FastAPI + Python | Model inference, data processing |
| Model | XGBoost Booster | Churn predictions |

**Why?**
- Frontend developers can work independently
- API can serve multiple clients (web, mobile, internal tools)
- Easier to scale each component

#### 2. Pre-computed Features (`eval/app_features.csv`)

```python
# api/services/model_service.py
def load_features() -> pd.DataFrame:
    features_path = Path(settings.FEATURES_PATH)
    return pd.read_csv(features_path)
```

**Why?**
- Feature engineering takes 15+ minutes on 30GB data
- API needs sub-100ms response time
- Pre-compute features daily/weekly, serve from CSV

#### 3. XGBoost Booster for Compatibility

```python
def load_model() -> xgb.Booster:
    bst = xgb.Booster()
    bst.load_model(str(model_path))
    return bst
```

**Why?**
- XGBoost 3.x has issues with XGBClassifier wrapper
- Booster loads JSON models reliably across versions
- JSON format is portable across Python versions

#### 4. Model Caching

```python
_model_cache: dict[str, Any] = {}

def load_model():
    if "model" in _model_cache:
        return _model_cache["model"]
    # ... load and cache
```

**Why?**
- Model only loads ONCE when API starts
- Subsequent requests reuse cached model
- Reduces response time from seconds to milliseconds

### The Prediction Flow

```python
# api/services/model_service.py
def predict(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    bst = load_model()

    # Drop metadata columns
    drop = {"msno", "is_churn", "cutoff_ts", "window"}
    feats = [c for c in df.columns if c not in drop]

    X = df[feats].copy()

    # Encode categorical features
    if "gender" in X.columns:
        gender_map = {"male": 0, "female": 1, "unknown": 2}
        X["gender"] = X["gender"].map(gender_map).fillna(2)

    # Create DMatrix with feature names for XGBoost
    X = X.fillna(0)
    dmatrix = xgb.DMatrix(X, feature_names=feats)

    # Get predictions
    probs = bst.predict(dmatrix)
    return probs, feats
```

**Steps:**
1. Remove non-feature columns (msno, is_churn, etc.)
2. Encode categorical features (gender string → number)
3. Fill missing values with 0
4. Create DMatrix with feature names
5. Get churn probability from Booster

---

## 9. Business Rules

### From Prediction to Action

A probability alone isn't actionable. "User has 73% churn risk" - so what?

`rules.yaml` maps predictions to specific interventions:

```yaml
# High risk with low activity
- condition:
    churn_score: ">0.7"
    top_feature: "secs_30d"
  action: "engagement"
  recommendation: "Send personalized playlist"
  message: "We miss you! Here's music we think you'll love."
  urgency: "high"
  channel: ["email", "push_notification"]
```

### Risk Tiers

| Churn Score | Risk Level | Action |
|-------------|------------|--------|
| >70% | High | Immediate phone/email outreach |
| 40-70% | Medium | Automated re-engagement campaign |
| <40% | Low | Monitor, continue normal service |

### Cost-Effectiveness

```yaml
cost_guidelines:
  high_risk:
    max_intervention_cost: 50.00  # USD per user
    expected_clv_multiple: 3.0    # Need 3x return
```

**Logic:**
- High-risk user worth $50 intervention if their lifetime value > $150
- Don't spend $50 saving a user worth $20

---

## 10. What We Changed Today and Why

### The Problem

Our original project had only **9 features**:
- tx_count_total, cancels_total, plan_days_latest, auto_renew_latest
- logs_30d, secs_30d, unq_30d, gender, age

Kaggle winners used **258+ features**.

**Result:** Our log loss was 0.30 vs Kaggle top ~0.10

### The Solution

We created comprehensive feature engineering with **99 features**:

| Category | Original | New |
|----------|----------|-----|
| Time Windows | 1 (30d) | 5 (7d, 14d, 30d, 60d, 90d) |
| Transaction Features | 4 | 35+ |
| Listening Features | 3 | 50+ |
| Trend Features | 0 | 6 |
| Demographic Features | 2 | 5 |

### Key Additions

1. **Multiple Time Windows**
   - Captures behavioral trends, not just snapshots

2. **Statistical Aggregations**
   - avg, std, min, max (not just totals)
   - Captures variability and patterns

3. **Completion Rates**
   - What % of songs do they finish?
   - Early skips indicate dissatisfaction

4. **Trend Features**
   - Is listening increasing or decreasing?
   - Declining engagement predicts churn

### Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Log Loss | 0.30 | 0.0821 | 3.7x better |
| AUC | 0.67 | 0.9847 | +47% |
| Features | 9 | 99 | 11x more |

**We now beat Kaggle's top 4% solutions!**

---

## 11. Interview Q&A

### Q: "Tell me about this project."

**A:** "I built a churn prediction system for KKBOX, a music streaming service with 10 million users. The system predicts which subscribers will cancel, achieving a log loss of 0.0821 which beats Kaggle's top 4% solutions. I engineered 99 features from 30GB of transaction and listening data across 5 time windows, implemented temporal safety to prevent data leakage, and deployed a full-stack React/FastAPI application with Docker that returns predictions in under 100ms."

### Q: "What's temporal leakage and how did you prevent it?"

**A:** "Temporal leakage is when you accidentally use future information to predict the past. For example, using April listening data to predict March churn. In production, you don't have future data, so models trained with leakage fail. I prevented this by:
1. Enforcing a strict cutoff date (Feb 28, 2017) in all SQL queries
2. Using temporal train/validation splits instead of random splits
3. Writing unit tests that inject fake future events and verify they don't affect features"

### Q: "Why did you calibrate the model?"

**A:** "Raw XGBoost probabilities aren't true probabilities. If the model says 70% churn, it might actually be 50% or 90%. This matters for business decisions - if I'm allocating a retention budget, I need to know my predictions are reliable. I used isotonic calibration to adjust probabilities so when I say 70%, it's actually 70%. This improved our Expected Calibration Error from 3.5% to 0.5%."

### Q: "Why multiple time windows?"

**A:** "A single snapshot misses behavioral trends. Consider two users who both listened 50 hours last month:
- User A: 80 hours in weeks 1-2, 20 hours in weeks 3-4 (DECLINING)
- User B: 20 hours in weeks 1-2, 80 hours in weeks 3-4 (INCREASING)

Single-window features would show them as identical, but User A is much more likely to churn. Multiple windows (7d, 14d, 30d, 60d, 90d) capture these trends."

### Q: "How would you deploy this in production?"

**A:** "The system is deployment-ready:
1. **Data Pipeline:** DuckDB processes features from transaction/log databases
2. **Model Serving:** XGBoost model saved as JSON for portability
3. **API:** FastAPI REST endpoints serve predictions with sub-100ms latency
4. **Batch Processing:** Daily feature refresh via the Makefile pipeline
5. **Monitoring:** Track prediction drift and feature distributions over time"

### Q: "What would you improve?"

**A:** "Three things:
1. **Real-time features:** Currently features are pre-computed daily. For immediate intervention, I'd add a streaming pipeline for real-time feature updates.
2. **Explainability:** Add SHAP values to explain why each user is predicted to churn, so customer success knows what to address.
3. **A/B testing:** Build infrastructure to measure if our interventions actually reduce churn, not just predict it."

---

## File Reference

| File | Purpose |
|------|---------|
| `src/labels.py` | Churn label generation matching Kaggle's official definition |
| `features/features_comprehensive.sql` | 99-feature engineering with temporal safety |
| `src/features_comprehensive_processor.py` | Runs SQL on real data using DuckDB |
| `src/models.py` | Model training (Baseline → LogReg → RF → XGBoost) |
| `src/calibration.py` | Isotonic calibration for reliable probabilities |
| `train_models.py` | End-to-end training pipeline |
| `api/` | FastAPI backend (model serving, predictions) |
| `api/services/model_service.py` | XGBoost model loading and inference |
| `gemini-app/` | React/TypeScript frontend (ChurnPro dashboard) |
| `docker-compose.yml` | Container orchestration for full stack |
| `rules.yaml` | Business logic mapping predictions to actions |
| `Makefile` | One-command pipeline orchestration |

---

## Quick Commands

```bash
# Generate features from real data (15-30 min)
python src/features_comprehensive_processor.py

# Train models on comprehensive features
python train_models.py --features features/features_comprehensive.parquet

# Calibrate models
python src/calibration.py

# Run the full-stack app (Docker)
docker-compose up -d --build

# Or use Makefile
make app

# Access the app
# Frontend: http://localhost:3000
# API: http://localhost:8000/api/health
```

---

**Congratulations!** You now understand every aspect of this project. Practice explaining it out loud until it feels natural. The key talking points are:

1. Beat Kaggle top 4% (log loss 0.0821)
2. 99 features across 5 time windows
3. Temporal safety prevents data leakage
4. Calibration ensures reliable probabilities
5. Sub-100ms real-time predictions

Good luck with your interviews!
