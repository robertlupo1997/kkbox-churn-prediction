# KKBOX Churn Prediction Requirements

## Overview
Predict subscriber churn using train.csv labels as source of truth, with strict temporal cutoffs to prevent data leakage.

## Core Constraints
- **Churn Target**: Use train.csv is_churn labels as ground truth
- **Prediction Point**: label_date is the cutoff per user. No feature uses data on or after label_date
- **Primary Metric**: Minimize logloss for model selection
- **Secondary Metrics**: Track AUC and Brier score for monitoring only
- **Time Split**: Train before 2017-05-15, validate after, with 15-day purge window
- **Reproducibility**: Store run.json with seed, data snapshot, git commit, params, metrics
- **Feature Registry**: Each feature MUST list source, window, aggregation, null policy

## User Stories & EARS Acceptance Criteria

### US-1: Leakage Guard
**As a** ML engineer  
**I want** strict temporal boundaries on feature computation  
**So that** no future information leaks into predictions

**EARS:**
- **Given** a user with label_date X from train.csv
- **When** computing features for that user  
- **Then** system SHALL only read events with log_date < X
- **And** assert COUNT(*) = 0 for any events WHERE log_date >= label_date
- **Stop Condition**: If leaks > 0, stop and report failing count

### US-2: Purged Time Split
**As a** model validator  
**I want** forward-chained splits with exclusion windows  
**So that** validation mimics production deployment gaps

**EARS:**
- **Given** labeled dataset spanning 2015-2017
- **When** creating train/validation splits
- **Then** system SHALL train on label_date < 2017-02-01
- **And** validate on label_date >= 2017-02-01  
- **And** purge exclude label_date in [boundary - 30 days, boundary + 30 days)
- **And** assert min(val_label_date) > max(train_label_date)
- **Stop Condition**: If val_min <= train_max, stop and report overlap dates

### US-3: Calibration Requirement
**As a** prediction consumer  
**I want** well-calibrated probability estimates  
**So that** predicted probabilities reflect true likelihood

**EARS:**
- **Given** trained model on validation folds
- **When** producing final predictions
- **Then** system SHALL fit isotonic calibration on validation folds
- **And** save calibration parameters to calibration.json
- **And** apply calibration to test predictions
- **Stop Condition**: If prob range not in [0,1], stop and report bounds

### US-4: Reproducibility Guarantee  
**As a** ML practitioner  
**I want** deterministic, versioned model runs  
**So that** results can be replicated and audited

**EARS:**
- **Given** any model training run
- **When** starting execution
- **Then** system SHALL fix seed via RUN_SEED env, default 42
- **And** record data snapshot version, git commit hash
- **And** save hyperparameters and metrics to run.json
- **And** generate identical results on repeat with same seed

### US-5: Class Imbalance Handling
**As a** ML engineer working with imbalanced data  
**I want** stratified temporal splits and calibrated probabilities  
**So that** model selection uses appropriate techniques

**EARS:**
- **Given** positive rate computation from train.csv
- **When** creating splits and training models
- **Then** system SHALL use stratified sampling within time windows
- **And** select models based on logloss only
- **And** report base_rate vs mean(predicted_prob) for calibration check
- **And** use calibrated probabilities for final predictions

### US-6: Feature Registry
**As a** feature engineer  
**I want** declarative feature definitions in features.yaml  
**So that** feature lineage and policies are explicit

**EARS:**
- **Given** new feature creation
- **When** adding to feature set
- **Then** system SHALL declare source table, time window, aggregation
- **And** specify null handling policy in features.yaml
- **And** validate feature availability at label_date
- **And** each feature MUST list: name, source, window, aggregation, null_policy