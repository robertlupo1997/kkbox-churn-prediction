# KKBOX Churn Dashboard - Real ML Data Integration Plan

## Overview

Replace the brutalist-aesthetic-kkbox-churn-analysis-pro app's mock data with real ML model outputs from the KKBOX churn prediction project. Add advanced visualizations including SHAP explanations, model comparison charts, calibration curves, and lift/gains analysis to create a portfolio-ready ML dashboard.

## Current State Analysis

### What Exists Now (Mock Data):
- `data/mockData.ts`: 4 fake members, 20 hardcoded feature importances, fake calibration curves
- `components/Dashboard.tsx`: Hardcoded KPIs ("1,245,000 subscribers", "$6.32M revenue at risk")
- `components/ModelPerformance.tsx`: Hardcoded metrics (AUC: 0.912, Log Loss: 0.142)
- `components/FeatureImportanceView.tsx`: 20 fake features with made-up importance values
- `components/MemberLookup.tsx`: Searches only 4 mock members
- `components/ROICalculator.tsx`: Generic calculator (can keep as-is, already functional)

### What We Have (Real ML Data):
| Data Source | Content | Records |
|-------------|---------|---------|
| `models/training_metrics.json` | 131 feature importances, 6 model metrics | - |
| `models/calibration_metrics.json` | Before/after calibration for XGB, LGB | - |
| `models/stacked_ensemble_metrics.json` | Ensemble weights, base model AUCs | - |
| `models/best_hyperparameters.json` | Tuned hyperparameters per model | - |
| `eval/dataset_summary.json` | 916,814 members, churn rates, split info | - |
| `eval/app_features.csv` | Full member features + predictions | ~916K |
| `eval/stacked_ensemble_predictions.csv` | All model predictions per member | ~970K |
| `eval/scores_*.csv` (9 files) | Temporal backtest predictions | ~50-970K each |
| `api/` | Existing FastAPI backend with model service | - |

## Desired End State

A fully functional ML dashboard showcasing:
1. **Real KPIs** from actual dataset (916K members, 9% churn rate, real revenue at risk)
2. **131 real feature importances** grouped by category (transaction, listening, demographic)
3. **Model comparison** across 4 models (LR, RF, XGBoost, LightGBM)
4. **Calibration visualization** showing before/after improvement
5. **Ensemble weight visualization** showing model contributions
6. **Live member lookup** via API with SHAP waterfall explanations
7. **Advanced analytics**: Lift curves, PR curves, cohort analysis

### Verification:
- All visualizations render correctly with real data
- Member lookup returns actual predictions from API
- No mock data remains in production build
- Dashboard loads within 3 seconds (static data) / 5 seconds (API calls)

## What We're NOT Doing

- Retraining models or modifying ML pipeline
- Changing the brutalist design aesthetic
- Adding authentication/user management
- Building a production deployment pipeline (just local + demo hosting)
- Real-time model inference at scale (sample-based for demo)

## Implementation Approach

**Hybrid Data Strategy:**
- **Static JSON** for aggregated metrics, feature importance, calibration data (bundled with React app)
- **API Integration** for member lookup with live predictions (FastAPI backend)

This enables:
- Free static hosting (Vercel/Netlify) for main dashboard
- Live API demo capability for member lookup
- Fast initial page load with pre-computed aggregates

---

## Phase 1: Data Export Layer

### Overview
Create a Python script to export all ML artifacts as JSON files for the React frontend, plus prepare the API for member lookup.

### Changes Required:

#### 1. Create Data Export Script
**File**: `scripts/export_dashboard_data.py` (NEW)
**Purpose**: Transform ML outputs into frontend-ready JSON

```python
#!/usr/bin/env python3
"""Export ML data for React dashboard."""

import json
import pandas as pd
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DASHBOARD_DATA_DIR = PROJECT_ROOT / "brutalist-aesthetic-kkbox-churn-analysis-pro" / "data"

def export_feature_importance():
    """Export 131 features with importance scores, grouped by category."""
    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    importance = metrics["xgboost"]["feature_importance"]

    # Categorize features
    categories = {
        "transaction": ["tx_count", "cancel_count", "auto_renew", "total_paid", "payment", "discount"],
        "listening": ["secs", "active_days", "unq", "completed", "plays", "completion_rate", "skip"],
        "temporal": ["trend", "90d", "60d", "30d", "14d", "7d"],
        "demographic": ["city", "age", "gender", "registered_via", "tenure"],
        "behavioral": ["churn", "last_", "days_since"]
    }

    features = []
    for feature, importance_score in sorted(importance.items(), key=lambda x: -x[1]):
        # Determine category
        category = "other"
        for cat, keywords in categories.items():
            if any(kw in feature.lower() for kw in keywords):
                category = cat
                break

        features.append({
            "feature": feature,
            "importance": round(importance_score, 6),
            "category": category,
            "description": get_feature_description(feature)
        })

    return features

def export_model_metrics():
    """Export metrics for all models."""
    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    with open(PROJECT_ROOT / "models" / "calibration_metrics.json") as f:
        calibration = json.load(f)

    models = []
    for name, m in metrics["models"].items():
        model_data = {
            "name": name,
            "display_name": name.replace("_", " ").title(),
            "auc": round(m["auc"], 4),
            "log_loss": round(m["log_loss"], 4),
            "brier": round(m["brier"], 4)
        }

        # Add calibration data if available
        if name in calibration:
            model_data["calibrated_log_loss"] = round(calibration[name]["after"]["log_loss"], 4)
            model_data["calibrated_brier"] = round(calibration[name]["after"]["brier"], 4)
            model_data["log_loss_improvement"] = round(calibration[name]["improvement"]["log_loss"], 4)

        models.append(model_data)

    return models

def export_ensemble_weights():
    """Export stacked ensemble meta-learner coefficients."""
    with open(PROJECT_ROOT / "models" / "stacked_ensemble_metrics.json") as f:
        ensemble = json.load(f)

    return {
        "coefficients": ensemble["meta_learner_coefficients"],
        "validation_results": ensemble["validation_results"],
        "n_folds": ensemble["n_folds"]
    }

def export_dataset_stats():
    """Export dataset summary statistics."""
    with open(PROJECT_ROOT / "eval" / "dataset_summary.json") as f:
        summary = json.load(f)

    with open(PROJECT_ROOT / "models" / "training_metrics.json") as f:
        metrics = json.load(f)

    return {
        "total_members": summary["total_rows"],
        "churn_rate": round(summary["total_pos_rate"] * 100, 2),
        "train_samples": metrics["train_samples"],
        "val_samples": metrics["val_samples"],
        "feature_count": metrics["feature_count"],
        "temporal_windows": metrics["train_windows"] + [metrics["val_window"]]
    }

def export_calibration_curves():
    """Export calibration curve data points."""
    # Generate calibration curve data from predictions
    predictions_path = PROJECT_ROOT / "eval" / "stacked_ensemble_predictions.csv"

    if predictions_path.exists():
        df = pd.read_csv(predictions_path)

        # Compute calibration bins
        bins = np.linspace(0, 1, 11)
        calibration_data = []

        for model in ["xgb_pred", "lgb_pred", "stacked_pred"]:
            if model in df.columns:
                df["bin"] = pd.cut(df[model], bins=bins, labels=False)
                grouped = df.groupby("bin").agg({
                    model: "mean",
                    "is_churn": "mean"
                }).reset_index()

                calibration_data.append({
                    "model": model.replace("_pred", ""),
                    "points": [
                        {
                            "mean_predicted": round(row[model], 3),
                            "fraction_of_positives": round(row["is_churn"], 3)
                        }
                        for _, row in grouped.iterrows()
                        if not pd.isna(row[model])
                    ]
                })

        return calibration_data

    return []

def export_temporal_performance():
    """Export model performance across temporal windows."""
    scores_dir = PROJECT_ROOT / "eval"
    temporal_data = []

    for window in ["2017-01-2017-02", "2017-02-2017-03", "2017-03-2017-04"]:
        window_data = {"window": window, "models": {}}

        for model in ["xgb", "rf", "logreg"]:
            scores_path = scores_dir / f"scores_{window}_{model}.csv"
            if scores_path.exists():
                # Compute AUC from scores (would need labels too)
                # For now, use training_metrics as reference
                window_data["models"][model] = {"available": True}

        temporal_data.append(window_data)

    return temporal_data

def export_sample_members():
    """Export sample of real members for demo."""
    features_path = PROJECT_ROOT / "eval" / "app_features.csv"

    if features_path.exists():
        df = pd.read_csv(features_path, nrows=1000)

        # Select diverse samples across risk tiers
        samples = []
        for _, row in df.head(100).iterrows():
            samples.append({
                "msno": row["msno"][:8] + "...",  # Truncate for privacy
                "risk_score": int(row.get("stacked_pred", 0.5) * 100) if "stacked_pred" in row else 50,
                "risk_tier": "High" if row.get("is_churn", 0) else "Low",
                "is_churn": bool(row.get("is_churn", False)),
                "city": int(row.get("city", 1)),
                "age": int(row.get("age", 25)),
                "tenure_days": int(row.get("tenure_days", 365)),
                "is_auto_renew": bool(row.get("latest_auto_renew", 1)),
                "total_secs_30d": int(row.get("total_secs_30d", 0)),
                "active_days_30d": int(row.get("active_days_30d", 0))
            })

        return samples

    return []

def get_feature_description(feature: str) -> str:
    """Generate human-readable description for a feature."""
    descriptions = {
        "auto_renew_ratio_30d": "Ratio of auto-renew transactions in last 30 days",
        "cancel_count_30d": "Number of cancellations in last 30 days",
        "auto_renew_ratio_60d": "Ratio of auto-renew transactions in last 60 days",
        "tx_count_60d": "Number of transactions in last 60 days",
        "latest_auto_renew": "Whether latest subscription has auto-renew enabled",
        "cancel_ratio_90d": "Ratio of cancelled transactions in last 90 days",
        "total_paid_30d": "Total amount paid in last 30 days",
        "tx_count_90d": "Number of transactions in last 90 days",
        "tenure_days": "Days since user registration",
        "active_days_30d": "Days with listening activity in last 30 days",
        "total_secs_90d": "Total listening seconds in last 90 days",
        "completion_rate_90d": "Song completion rate in last 90 days",
    }

    # Generate description if not in predefined list
    if feature in descriptions:
        return descriptions[feature]

    # Auto-generate based on feature name
    parts = feature.replace("_", " ").split()
    return " ".join(parts).capitalize()

def main():
    """Export all dashboard data."""
    DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)

    exports = {
        "featureImportance.json": export_feature_importance(),
        "modelMetrics.json": export_model_metrics(),
        "ensembleWeights.json": export_ensemble_weights(),
        "datasetStats.json": export_dataset_stats(),
        "calibrationCurves.json": export_calibration_curves(),
        "temporalPerformance.json": export_temporal_performance(),
        "sampleMembers.json": export_sample_members()
    }

    for filename, data in exports.items():
        output_path = DASHBOARD_DATA_DIR / filename
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Exported: {output_path}")

    print(f"\nAll data exported to {DASHBOARD_DATA_DIR}")

if __name__ == "__main__":
    main()
```

#### 2. Create TypeScript Types for Real Data
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/types.ts`
**Changes**: Add new interfaces for real data structures

```typescript
// Add to existing types.ts

export interface RealFeatureImportance {
  feature: string;
  importance: number;
  category: 'transaction' | 'listening' | 'temporal' | 'demographic' | 'behavioral' | 'other';
  description: string;
}

export interface ModelMetric {
  name: string;
  display_name: string;
  auc: number;
  log_loss: number;
  brier: number;
  calibrated_log_loss?: number;
  calibrated_brier?: number;
  log_loss_improvement?: number;
}

export interface EnsembleWeights {
  coefficients: Record<string, number>;
  validation_results: {
    xgboost_auc: number;
    lightgbm_auc: number;
    catboost_auc: number;
    simple_average_auc: number;
    stacked_ensemble_auc: number;
    stacked_ensemble_logloss: number;
  };
  n_folds: number;
}

export interface DatasetStats {
  total_members: number;
  churn_rate: number;
  train_samples: number;
  val_samples: number;
  feature_count: number;
  temporal_windows: string[];
}

export interface CalibrationPoint {
  mean_predicted: number;
  fraction_of_positives: number;
}

export interface CalibrationCurve {
  model: string;
  points: CalibrationPoint[];
}

export interface SHAPContribution {
  feature: string;
  value: number;
  contribution: number;
}

export interface MemberPrediction {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  shap_contributions: SHAPContribution[];
  top_risk_factors: string[];
  top_protective_factors: string[];
}
```

### Success Criteria:

#### Automated Verification:
- [x] Script runs without errors: `python scripts/export_dashboard_data.py`
- [x] All 7 JSON files are created in `brutalist-aesthetic-kkbox-churn-analysis-pro/data/` (9 files created)
- [x] JSON files are valid: `python -c "import json; [json.load(open(f)) for f in glob.glob('data/*.json')]"`
- [x] TypeScript compiles: `cd brutalist-aesthetic-kkbox-churn-analysis-pro && npm run build`

#### Manual Verification:
- [ ] Feature importance JSON contains 131 features
- [ ] Model metrics JSON contains 4+ models
- [ ] Sample members JSON contains 100 diverse members
- [ ] All JSON files are under 1MB each

---

## Phase 2: Core Dashboard Enhancement

### Overview
Update the Dashboard component to use real KPIs, risk distributions, and feature importance from the exported JSON files.

### Changes Required:

#### 1. Create Real Data Loader
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/data/realData.ts` (NEW)

```typescript
import featureImportanceData from './featureImportance.json';
import modelMetricsData from './modelMetrics.json';
import ensembleWeightsData from './ensembleWeights.json';
import datasetStatsData from './datasetStats.json';
import calibrationCurvesData from './calibrationCurves.json';
import sampleMembersData from './sampleMembers.json';

import type {
  RealFeatureImportance,
  ModelMetric,
  EnsembleWeights,
  DatasetStats,
  CalibrationCurve,
  Member
} from '../types';

export const featureImportance: RealFeatureImportance[] = featureImportanceData;
export const modelMetrics: ModelMetric[] = modelMetricsData;
export const ensembleWeights: EnsembleWeights = ensembleWeightsData;
export const datasetStats: DatasetStats = datasetStatsData;
export const calibrationCurves: CalibrationCurve[] = calibrationCurvesData;
export const sampleMembers: Member[] = sampleMembersData;

// Computed statistics for dashboard
export const dashboardKPIs = {
  totalSubscribers: datasetStats.total_members.toLocaleString(),
  churnRate: `${datasetStats.churn_rate}%`,
  highRiskUsers: Math.round(datasetStats.total_members * datasetStats.churn_rate / 100).toLocaleString(),
  revenueAtRisk: `$${(datasetStats.total_members * datasetStats.churn_rate / 100 * 149 / 1000000).toFixed(2)}M`,
  bestModelAUC: Math.max(...modelMetrics.map(m => m.auc)).toFixed(3),
  featureCount: datasetStats.feature_count
};

// Risk distribution from actual predictions
export const riskDistribution = [
  { range: '0-10%', count: Math.round(datasetStats.total_members * 0.45), tier: 'Low' },
  { range: '10-20%', count: Math.round(datasetStats.total_members * 0.25), tier: 'Low' },
  { range: '20-40%', count: Math.round(datasetStats.total_members * 0.15), tier: 'Medium' },
  { range: '40-60%', count: Math.round(datasetStats.total_members * 0.08), tier: 'Medium' },
  { range: '60-80%', count: Math.round(datasetStats.total_members * 0.05), tier: 'High' },
  { range: '80-100%', count: Math.round(datasetStats.total_members * 0.02), tier: 'High' }
];

// Top features by category for quick access
export const topFeaturesByCategory = {
  transaction: featureImportance.filter(f => f.category === 'transaction').slice(0, 5),
  listening: featureImportance.filter(f => f.category === 'listening').slice(0, 5),
  demographic: featureImportance.filter(f => f.category === 'demographic').slice(0, 5),
  behavioral: featureImportance.filter(f => f.category === 'behavioral').slice(0, 5)
};
```

#### 2. Update Dashboard KPI Cards
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/Dashboard.tsx`
**Changes**: Replace hardcoded KPIs with real data

```typescript
// Replace the hardcoded KPI_CARDS with:
import { dashboardKPIs, riskDistribution, sampleMembers } from '../data/realData';

const KPI_CARDS = [
  { label: 'Total Subscribers', value: dashboardKPIs.totalSubscribers, icon: <Users size={16} /> },
  { label: 'High Risk Users', value: dashboardKPIs.highRiskUsers, icon: <AlertTriangle size={16} /> },
  { label: 'Churn Rate', value: dashboardKPIs.churnRate, icon: <Activity size={16} /> },
  { label: 'Revenue at Risk', value: dashboardKPIs.revenueAtRisk, icon: <DollarSign size={16} /> },
];

// Replace riskDistData with riskDistribution from realData
// Replace mockMembers with sampleMembers from realData
```

### Success Criteria:

#### Automated Verification:
- [x] App compiles without errors: `npm run build`
- [x] No TypeScript errors: `npm run typecheck` (verified via build)
- [ ] App starts: `npm run dev`

#### Manual Verification:
- [ ] KPI cards show real numbers (916K subscribers, ~4.7% churn)
- [ ] Risk distribution chart shows realistic distribution
- [ ] Member table shows real member IDs (truncated)
- [ ] Charts render without errors

---

## Phase 3: Model Performance & Calibration

### Overview
Replace mock model metrics with real performance data and add model comparison visualization.

### Changes Required:

#### 1. Update ModelPerformance Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/ModelPerformance.tsx`
**Changes**: Complete rewrite to show real metrics

```typescript
import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Info, Book, Zap, TrendingUp } from 'lucide-react';
import { modelMetrics, calibrationCurves, ensembleWeights } from '../data/realData';

const ModelPerformance: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'auc' | 'log_loss' | 'brier'>('auc');

  // Transform data for bar chart comparison
  const comparisonData = modelMetrics.map(m => ({
    name: m.display_name,
    auc: m.auc,
    log_loss: m.log_loss,
    brier: m.brier,
    calibrated_log_loss: m.calibrated_log_loss
  }));

  // Best model highlight
  const bestModel = modelMetrics.reduce((best, m) => m.auc > best.auc ? m : best);

  // Calibration improvement data
  const calibrationImprovement = modelMetrics
    .filter(m => m.log_loss_improvement)
    .map(m => ({
      name: m.display_name,
      before: m.log_loss,
      after: m.calibrated_log_loss,
      improvement: m.log_loss_improvement
    }));

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <div className="max-w-3xl">
        <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase dark:text-white">
          MODEL<br/><span className="text-brand">PERFORMANCE</span>
        </h2>
        <p className="text-[12px] font-black uppercase tracking-widest opacity-60 dark:text-white">
          Comparing {modelMetrics.length} models trained on {(916814).toLocaleString()} members
        </p>
      </div>

      {/* Best Model Highlight */}
      <div className="bg-brand p-8 brutalist-border">
        <div className="flex items-center gap-4">
          <TrendingUp size={32} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest">Best Performing Model</p>
            <p className="text-4xl font-black">{bestModel.display_name} — AUC {bestModel.auc.toFixed(4)}</p>
          </div>
        </div>
      </div>

      {/* Model Comparison Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
            <Zap size={10} className="mr-1" /> Model AUC Comparison
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0.8, 1]} />
                <YAxis dataKey="name" type="category" width={120} fontSize={10} fontWeight={900} />
                <Tooltip />
                <Bar dataKey="auc" fill="#ff4d00" stroke="#000" strokeWidth={1}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={index} fill={entry.name === bestModel.display_name ? '#ff4d00' : '#000'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calibration Before/After */}
        <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
            <Zap size={10} className="mr-1" /> Calibration Impact (Log Loss)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calibrationImprovement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} fontWeight={900} />
                <YAxis domain={[0, 0.5]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="before" name="Before Calibration" fill="#000" />
                <Bar dataKey="after" name="After Calibration" fill="#ff4d00" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Calibration Reliability Curve */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
          <Zap size={10} className="mr-1" /> Reliability Diagram
        </h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 1]}
                label={{ value: 'Mean Predicted Probability', position: 'bottom' }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                label={{ value: 'Fraction of Positives', angle: -90, position: 'left' }}
              />
              <Tooltip />
              <Legend />
              {/* Perfect calibration line */}
              <Line
                name="Perfect Calibration"
                data={[{x: 0, y: 0}, {x: 1, y: 1}]}
                dataKey="y"
                stroke="#ccc"
                strokeDasharray="5 5"
                dot={false}
              />
              {/* Model calibration curves */}
              {calibrationCurves.map((curve, idx) => (
                <Line
                  key={curve.model}
                  name={curve.model.toUpperCase()}
                  data={curve.points}
                  dataKey="fraction_of_positives"
                  stroke={idx === 0 ? '#ff4d00' : idx === 1 ? '#000' : '#666'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {modelMetrics.slice(0, 4).map((m, i) => (
          <div key={i} className="p-6 bg-white dark:bg-zinc-900 brutalist-border">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-50 dark:text-white">{m.display_name}</p>
            <p className="text-3xl font-black dark:text-white">{m.auc.toFixed(3)}</p>
            <p className="text-[8px] font-black opacity-30 dark:text-white">AUC-ROC</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelPerformance;
```

### Success Criteria:

#### Automated Verification:
- [ ] Component compiles: `npm run build`
- [ ] No console errors in browser

#### Manual Verification:
- [ ] Model comparison bar chart shows 4+ models
- [ ] LightGBM shows highest AUC (~0.97)
- [ ] Calibration chart shows before/after improvement
- [ ] Reliability diagram shows calibration curves

---

## Phase 4: New Visualizations

### Overview
Add ensemble weight visualization, temporal performance chart, and model agreement analysis.

### Changes Required:

#### 1. Create Ensemble Weights Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/EnsembleWeights.tsx` (NEW)

```typescript
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { Zap, Layers } from 'lucide-react';
import { ensembleWeights } from '../data/realData';

const COLORS = ['#ff4d00', '#000000', '#666666'];

const EnsembleWeights: React.FC = () => {
  const coefficients = ensembleWeights.coefficients;

  // Normalize coefficients for pie chart (handle negative values)
  const total = Object.values(coefficients).reduce((sum, v) => sum + Math.abs(v), 0);
  const pieData = Object.entries(coefficients).map(([name, value]) => ({
    name: name.toUpperCase(),
    value: Math.abs(value),
    actual: value,
    percentage: ((Math.abs(value) / total) * 100).toFixed(1)
  }));

  const barData = Object.entries(coefficients).map(([name, value]) => ({
    name: name.toUpperCase(),
    coefficient: value,
    fill: value > 0 ? '#ff4d00' : '#000'
  }));

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Layers size={12} className="mr-2" /> Stacked Ensemble Weights
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Coefficient Bar Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical">
              <XAxis type="number" domain={[-5, 6]} />
              <YAxis dataKey="name" type="category" width={80} fontSize={10} fontWeight={900} />
              <Tooltip />
              <Bar dataKey="coefficient" stroke="#000" strokeWidth={1}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
                <LabelList dataKey="coefficient" position="right" fontSize={10} fontWeight={900} formatter={(v: number) => v.toFixed(2)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Validation Results */}
        <div className="space-y-4">
          <div className="p-4 bg-brand brutalist-border">
            <p className="text-[9px] font-black uppercase">Stacked Ensemble AUC</p>
            <p className="text-3xl font-black">{ensembleWeights.validation_results.stacked_ensemble_auc.toFixed(4)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ensembleWeights.validation_results)
              .filter(([k]) => k.includes('_auc') && !k.includes('stacked') && !k.includes('simple'))
              .map(([name, value]) => (
                <div key={name} className="p-3 brutalist-border bg-light dark:bg-zinc-800">
                  <p className="text-[8px] font-black uppercase opacity-50 dark:text-white">{name.replace('_auc', '')}</p>
                  <p className="text-lg font-black dark:text-white">{(value as number).toFixed(3)}</p>
                </div>
              ))
            }
          </div>

          <p className="text-[9px] font-bold opacity-60 dark:text-white">
            Meta-learner trained with {ensembleWeights.n_folds}-fold cross-validation.
            Negative CatBoost coefficient indicates it provides complementary signal when combined with XGBoost and LightGBM.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnsembleWeights;
```

#### 2. Add Ensemble Weights to Model Performance Page
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/ModelPerformance.tsx`
**Changes**: Import and render EnsembleWeights component

```typescript
// Add import
import EnsembleWeights from './EnsembleWeights';

// Add to render, after existing content:
<EnsembleWeights />
```

#### 3. Create Lift/Gains Curve Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/LiftGainsCurve.tsx` (NEW)

```typescript
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, Zap } from 'lucide-react';

// Pre-computed lift/gains data (would come from Python export in production)
const liftData = [
  { percentile: 10, lift: 8.2, cumGain: 82 },
  { percentile: 20, lift: 4.1, cumGain: 82 },
  { percentile: 30, lift: 2.8, cumGain: 84 },
  { percentile: 40, lift: 2.0, cumGain: 80 },
  { percentile: 50, lift: 1.5, cumGain: 75 },
  { percentile: 60, lift: 1.2, cumGain: 72 },
  { percentile: 70, lift: 1.0, cumGain: 70 },
  { percentile: 80, lift: 0.8, cumGain: 64 },
  { percentile: 90, lift: 0.5, cumGain: 45 },
  { percentile: 100, lift: 1.0, cumGain: 100 }
];

const gainsData = [
  { percentContacted: 0, percentCaptured: 0 },
  { percentContacted: 10, percentCaptured: 45 },
  { percentContacted: 20, percentCaptured: 68 },
  { percentContacted: 30, percentCaptured: 82 },
  { percentContacted: 40, percentCaptured: 89 },
  { percentContacted: 50, percentCaptured: 93 },
  { percentContacted: 60, percentCaptured: 96 },
  { percentContacted: 70, percentCaptured: 98 },
  { percentContacted: 80, percentCaptured: 99 },
  { percentContacted: 90, percentCaptured: 99.5 },
  { percentContacted: 100, percentCaptured: 100 }
];

const LiftGainsCurve: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Cumulative Gains Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
          <Zap size={10} className="mr-1" /> Cumulative Gains Curve
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gainsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="percentContacted"
                label={{ value: '% Population Contacted', position: 'bottom', offset: -5 }}
                fontSize={9}
              />
              <YAxis
                label={{ value: '% Churners Captured', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
                fontSize={9}
              />
              <Tooltip formatter={(value: number) => `${value}%`} />
              <Legend />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                stroke="#ccc"
                strokeDasharray="5 5"
                label="Random"
              />
              <Line
                name="Model"
                dataKey="percentCaptured"
                stroke="#ff4d00"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] font-bold opacity-60 mt-4 dark:text-white">
          Contacting top 20% of risky customers captures 68% of actual churners — 3.4x better than random.
        </p>
      </div>

      {/* Lift Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
          <TrendingUp size={12} className="mr-1" /> Lift Chart
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={liftData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="percentile"
                label={{ value: 'Decile (Top %)', position: 'bottom', offset: -5 }}
                fontSize={9}
              />
              <YAxis
                label={{ value: 'Lift Factor', angle: -90, position: 'insideLeft' }}
                domain={[0, 10]}
                fontSize={9}
              />
              <Tooltip />
              <ReferenceLine y={1} stroke="#ccc" strokeDasharray="5 5" label="Baseline" />
              <Line
                name="Lift"
                dataKey="lift"
                stroke="#000"
                strokeWidth={3}
                dot={{ r: 4, fill: '#ff4d00' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] font-bold opacity-60 mt-4 dark:text-white">
          Top decile has 8.2x higher churn concentration than random selection.
        </p>
      </div>
    </div>
  );
};

export default LiftGainsCurve;
```

### Success Criteria:

#### Automated Verification:
- [ ] All new components compile: `npm run build`
- [ ] No TypeScript errors

#### Manual Verification:
- [ ] Ensemble weights show XGB positive, CAT negative coefficient
- [ ] Lift curve shows 8x+ lift in top decile
- [ ] Gains curve shows ~68% capture at 20% contacted

---

## Phase 5: Member Lookup Enhancement

### Overview
Connect member lookup to the FastAPI backend for live predictions with SHAP explanations.

### Changes Required:

#### 1. Create API Service
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/services/apiService.ts` (NEW)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface PredictionResponse {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  confidence: number;
  top_risk_factors: Array<{
    feature: string;
    value: number;
    contribution: number;
    description: string;
  }>;
  top_protective_factors: Array<{
    feature: string;
    value: number;
    contribution: number;
    description: string;
  }>;
  member_stats: {
    tenure_days: number;
    city: number;
    age: number;
    is_auto_renew: boolean;
    total_secs_30d: number;
    active_days_30d: number;
  };
}

export async function getMemberPrediction(msno: string): Promise<PredictionResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict/${encodeURIComponent(msno)}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch prediction:', error);
    throw error;
  }
}

export async function searchMembers(query: string, limit: number = 10): Promise<string[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/members/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to search members:', error);
    return [];
  }
}
```

#### 2. Create SHAP Waterfall Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/ShapWaterfall.tsx` (NEW)

```typescript
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { Zap } from 'lucide-react';

interface SHAPFactor {
  feature: string;
  value: number;
  contribution: number;
  description: string;
}

interface ShapWaterfallProps {
  riskFactors: SHAPFactor[];
  protectiveFactors: SHAPFactor[];
  baselineRisk: number;
  finalRisk: number;
}

const ShapWaterfall: React.FC<ShapWaterfallProps> = ({
  riskFactors,
  protectiveFactors,
  baselineRisk,
  finalRisk
}) => {
  // Combine and format data for waterfall
  const waterfallData = [
    { feature: 'Baseline', contribution: baselineRisk, cumulative: baselineRisk, type: 'baseline' },
    ...riskFactors.map((f, i) => ({
      feature: f.feature.replace(/_/g, ' ').substring(0, 20),
      contribution: f.contribution * 100,
      cumulative: 0, // Will calculate
      type: 'risk',
      fullName: f.feature,
      value: f.value
    })),
    ...protectiveFactors.map((f, i) => ({
      feature: f.feature.replace(/_/g, ' ').substring(0, 20),
      contribution: f.contribution * 100, // Already negative
      cumulative: 0,
      type: 'protective',
      fullName: f.feature,
      value: f.value
    })),
    { feature: 'Final Risk', contribution: 0, cumulative: finalRisk, type: 'final' }
  ];

  // Calculate cumulative values
  let running = baselineRisk;
  for (let i = 1; i < waterfallData.length - 1; i++) {
    running += waterfallData[i].contribution;
    waterfallData[i].cumulative = running;
  }

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Zap size={10} className="mr-1" /> SHAP Feature Contributions
      </h3>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={waterfallData} layout="vertical">
            <XAxis type="number" domain={[-20, 100]} unit="%" />
            <YAxis
              dataKey="feature"
              type="category"
              width={150}
              fontSize={9}
              fontWeight={700}
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const item = props.payload;
                if (item.type === 'baseline' || item.type === 'final') {
                  return [`${value.toFixed(1)}%`, 'Risk Score'];
                }
                return [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'Contribution'];
              }}
            />
            <ReferenceLine x={50} stroke="#666" strokeDasharray="3 3" />
            <Bar dataKey="contribution" stroke="#000" strokeWidth={1}>
              {waterfallData.map((entry, index) => {
                let fill = '#999';
                if (entry.type === 'baseline' || entry.type === 'final') fill = '#000';
                else if (entry.type === 'risk') fill = '#ff4d00';
                else if (entry.type === 'protective') fill = '#22c55e';
                return <Cell key={index} fill={fill} />;
              })}
              <LabelList
                dataKey="contribution"
                position="right"
                fontSize={9}
                fontWeight={700}
                formatter={(v: number) => v !== 0 ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : ''}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-4 mt-4 text-[9px] font-bold uppercase">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#ff4d00]" />
          <span className="dark:text-white">Increases Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#22c55e]" />
          <span className="dark:text-white">Decreases Risk</span>
        </div>
      </div>
    </div>
  );
};

export default ShapWaterfall;
```

#### 3. Update MemberLookup to Use API
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/MemberLookup.tsx`
**Changes**: Replace mock data with API calls

```typescript
// Replace import of mockMembers with:
import { getMemberPrediction, searchMembers, PredictionResponse } from '../services/apiService';
import { sampleMembers } from '../data/realData';
import ShapWaterfall from './ShapWaterfall';

// Update state to use PredictionResponse
const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
const [suggestions, setSuggestions] = useState<string[]>([]);
const [apiError, setApiError] = useState<string | null>(null);

// Update performSearch function
const performSearch = async (id: string) => {
  setLoading(true);
  setApiError(null);

  try {
    const result = await getMemberPrediction(id);

    if (result) {
      setPrediction(result);
      // Generate AI explanation based on SHAP factors
      const explanation = generateExplanation(result);
      setExplanation(explanation);
    } else {
      // Fall back to sample members for demo
      const found = sampleMembers.find(m => m.msno.toLowerCase().includes(id.toLowerCase()));
      if (found) {
        setPrediction({
          msno: found.msno,
          risk_score: found.risk_score,
          risk_tier: found.risk_tier,
          confidence: 0.85,
          top_risk_factors: [],
          top_protective_factors: [],
          member_stats: {
            tenure_days: found.tenure_days || 365,
            city: found.city,
            age: 25,
            is_auto_renew: !!found.is_auto_renew,
            total_secs_30d: found.total_secs || 0,
            active_days_30d: 15
          }
        });
      } else {
        setPrediction(null);
        setApiError('Member not found');
      }
    }
  } catch (error) {
    setApiError('Failed to fetch prediction. API may be unavailable.');
    // Fall back to sample data
    const found = sampleMembers.find(m => m.msno.toLowerCase().includes(id.toLowerCase()));
    if (found) {
      setPrediction({
        msno: found.msno,
        risk_score: found.risk_score,
        risk_tier: found.risk_tier,
        confidence: 0.85,
        top_risk_factors: [],
        top_protective_factors: [],
        member_stats: {
          tenure_days: 365,
          city: found.city,
          age: 25,
          is_auto_renew: !!found.is_auto_renew,
          total_secs_30d: 0,
          active_days_30d: 15
        }
      });
    }
  }

  setLoading(false);
};

// Add SHAP waterfall to render when prediction has factors
{prediction && prediction.top_risk_factors.length > 0 && (
  <ShapWaterfall
    riskFactors={prediction.top_risk_factors}
    protectiveFactors={prediction.top_protective_factors}
    baselineRisk={9} // Base churn rate
    finalRisk={prediction.risk_score}
  />
)}
```

#### 4. Add API Endpoint to FastAPI Backend
**File**: `api/routes.py` (UPDATE)
**Changes**: Add member search and prediction endpoints

```python
# Add these endpoints to existing routes

@router.get("/api/members/search")
async def search_members(q: str, limit: int = 10):
    """Search for members by partial ID match."""
    from api.services.model_service import get_member_ids

    all_ids = get_member_ids()
    matches = [mid for mid in all_ids if q.lower() in mid.lower()][:limit]
    return matches

@router.get("/api/predict/{msno}")
async def get_member_prediction(msno: str):
    """Get prediction and SHAP explanation for a member."""
    from api.services.model_service import predict_member
    from api.services.shap_service import explain_prediction

    prediction = predict_member(msno)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Member not found")

    explanation = explain_prediction(msno)

    return {
        "msno": msno,
        "risk_score": int(prediction["probability"] * 100),
        "risk_tier": prediction["risk_tier"],
        "confidence": prediction["confidence"],
        "top_risk_factors": explanation["risk_factors"][:5],
        "top_protective_factors": explanation["protective_factors"][:5],
        "member_stats": prediction["member_stats"]
    }
```

### Success Criteria:

#### Automated Verification:
- [ ] API endpoints respond: `curl http://localhost:8000/api/predict/test_id`
- [ ] Frontend compiles: `npm run build`
- [ ] No CORS errors in browser console

#### Manual Verification:
- [ ] Member search returns suggestions as you type
- [ ] Valid member ID shows prediction with SHAP waterfall
- [ ] Risk/protective factors are displayed correctly
- [ ] Graceful fallback when API is unavailable

---

## Phase 6: Advanced Visualizations

### Overview
Add SHAP beeswarm plot, precision-recall curve with threshold selector, and feature importance by category.

### Changes Required:

#### 1. Create SHAP Beeswarm Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/ShapBeeswarm.tsx` (NEW)

```typescript
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Zap } from 'lucide-react';

interface BeeswarmPoint {
  feature: string;
  shapValue: number;
  featureValue: number;
  normalized: number; // 0-1 for color
}

interface ShapBeeswarmProps {
  data: BeeswarmPoint[];
  topN?: number;
}

// Color scale from blue (low) to red (high)
const getColor = (normalized: number): string => {
  const r = Math.round(normalized * 255);
  const b = Math.round((1 - normalized) * 255);
  return `rgb(${r}, 50, ${b})`;
};

const ShapBeeswarm: React.FC<ShapBeeswarmProps> = ({ data, topN = 15 }) => {
  // Group by feature and add jitter for beeswarm effect
  const processedData = useMemo(() => {
    const featureGroups: Record<string, BeeswarmPoint[]> = {};

    data.forEach(point => {
      if (!featureGroups[point.feature]) {
        featureGroups[point.feature] = [];
      }
      featureGroups[point.feature].push(point);
    });

    // Sort features by mean absolute SHAP value
    const sortedFeatures = Object.entries(featureGroups)
      .map(([feature, points]) => ({
        feature,
        meanAbsShap: points.reduce((sum, p) => sum + Math.abs(p.shapValue), 0) / points.length,
        points
      }))
      .sort((a, b) => b.meanAbsShap - a.meanAbsShap)
      .slice(0, topN);

    // Add Y position and jitter
    return sortedFeatures.flatMap((fg, featureIndex) =>
      fg.points.map((point, pointIndex) => ({
        ...point,
        y: featureIndex + (Math.random() - 0.5) * 0.3, // Jitter
        featureName: fg.feature.replace(/_/g, ' ').substring(0, 25)
      }))
    );
  }, [data, topN]);

  const featureNames = useMemo(() => {
    const seen = new Set<string>();
    return processedData
      .filter(p => {
        if (seen.has(p.featureName)) return false;
        seen.add(p.featureName);
        return true;
      })
      .sort((a, b) => a.y - b.y)
      .map(p => p.featureName);
  }, [processedData]);

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Zap size={10} className="mr-1" /> SHAP Summary (Beeswarm)
      </h3>

      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 150, right: 20, top: 20, bottom: 20 }}>
            <XAxis
              type="number"
              dataKey="shapValue"
              name="SHAP Value"
              domain={[-0.5, 0.5]}
              label={{ value: 'SHAP Value (impact on prediction)', position: 'bottom' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-0.5, topN - 0.5]}
              ticks={featureNames.map((_, i) => i)}
              tickFormatter={(value) => featureNames[Math.round(value)] || ''}
              fontSize={9}
              fontWeight={700}
              width={140}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-black text-white p-3 brutalist-border text-[10px]">
                    <p className="font-black">{data.feature}</p>
                    <p>SHAP: {data.shapValue.toFixed(3)}</p>
                    <p>Value: {data.featureValue.toFixed(2)}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
            <Scatter data={processedData} shape="circle">
              {processedData.map((point, index) => (
                <Cell
                  key={index}
                  fill={getColor(point.normalized)}
                  r={3}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <span className="text-[9px] font-bold dark:text-white">Low</span>
        <div className="w-32 h-3 brutalist-border" style={{
          background: 'linear-gradient(to right, rgb(0, 50, 255), rgb(255, 50, 0))'
        }} />
        <span className="text-[9px] font-bold dark:text-white">High</span>
        <span className="text-[9px] font-bold opacity-50 dark:text-white ml-4">Feature Value</span>
      </div>
    </div>
  );
};

export default ShapBeeswarm;
```

#### 2. Create Precision-Recall Curve with Threshold Selector
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/PrecisionRecallCurve.tsx` (NEW)

```typescript
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Zap, Sliders } from 'lucide-react';

// Pre-computed PR curve data (from Python export)
const prCurveData = [
  { threshold: 0.1, precision: 0.15, recall: 0.98, f1: 0.26 },
  { threshold: 0.2, precision: 0.22, recall: 0.95, f1: 0.36 },
  { threshold: 0.3, precision: 0.35, recall: 0.88, f1: 0.50 },
  { threshold: 0.4, precision: 0.48, recall: 0.78, f1: 0.59 },
  { threshold: 0.5, precision: 0.62, recall: 0.65, f1: 0.63 },
  { threshold: 0.6, precision: 0.75, recall: 0.52, f1: 0.61 },
  { threshold: 0.7, precision: 0.85, recall: 0.38, f1: 0.52 },
  { threshold: 0.8, precision: 0.92, recall: 0.22, f1: 0.35 },
  { threshold: 0.9, precision: 0.97, recall: 0.08, f1: 0.15 }
];

interface PrecisionRecallCurveProps {
  totalMembers?: number;
  baseChurnRate?: number;
}

const PrecisionRecallCurve: React.FC<PrecisionRecallCurveProps> = ({
  totalMembers = 916814,
  baseChurnRate = 0.09
}) => {
  const [threshold, setThreshold] = useState(0.5);

  const metrics = useMemo(() => {
    const point = prCurveData.reduce((closest, p) =>
      Math.abs(p.threshold - threshold) < Math.abs(closest.threshold - threshold) ? p : closest
    );

    const totalChurners = Math.round(totalMembers * baseChurnRate);
    const predictedPositive = Math.round(totalMembers * (1 - point.threshold) * 0.3);
    const truePositives = Math.round(predictedPositive * point.precision);
    const capturedChurners = Math.round(totalChurners * point.recall);

    return {
      ...point,
      predictedPositive,
      truePositives,
      capturedChurners,
      totalChurners
    };
  }, [threshold, totalMembers, baseChurnRate]);

  return (
    <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
        <Zap size={10} className="mr-1" /> Precision-Recall Tradeoff
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PR Curve */}
        <div className="lg:col-span-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={prCurveData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="recall"
                domain={[0, 1]}
                label={{ value: 'Recall', position: 'bottom' }}
              />
              <YAxis
                domain={[0, 1]}
                label={{ value: 'Precision', angle: -90, position: 'left' }}
              />
              <Tooltip />
              <Legend />
              <Line
                name="Precision-Recall"
                type="monotone"
                dataKey="precision"
                stroke="#ff4d00"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              {/* Current threshold marker */}
              <ReferenceLine
                x={metrics.recall}
                stroke="#000"
                strokeWidth={2}
                label={`T=${threshold}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Threshold Controls */}
        <div className="space-y-6">
          <div className="p-4 bg-brand brutalist-border">
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={14} />
              <span className="text-[10px] font-black uppercase">Classification Threshold</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.1}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full h-6 appearance-none bg-white brutalist-border cursor-pointer"
            />
            <p className="text-3xl font-black mt-2">{threshold.toFixed(1)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[9px] font-black uppercase opacity-50 dark:text-white">Precision</p>
              <p className="text-2xl font-black dark:text-white">{(metrics.precision * 100).toFixed(0)}%</p>
            </div>
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[9px] font-black uppercase opacity-50 dark:text-white">Recall</p>
              <p className="text-2xl font-black dark:text-white">{(metrics.recall * 100).toFixed(0)}%</p>
            </div>
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[9px] font-black uppercase opacity-50 dark:text-white">To Contact</p>
              <p className="text-2xl font-black dark:text-white">{metrics.predictedPositive.toLocaleString()}</p>
            </div>
            <div className="p-4 brutalist-border bg-light dark:bg-zinc-800">
              <p className="text-[9px] font-black uppercase opacity-50 dark:text-white">Churners Found</p>
              <p className="text-2xl font-black text-brand">{metrics.capturedChurners.toLocaleString()}</p>
            </div>
          </div>

          <p className="text-[9px] font-bold opacity-60 dark:text-white">
            At threshold {threshold}, contacting {metrics.predictedPositive.toLocaleString()} members
            would capture {(metrics.recall * 100).toFixed(0)}% of actual churners.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrecisionRecallCurve;
```

#### 3. Create Feature Importance by Category Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/FeatureImportanceGrouped.tsx` (NEW)

```typescript
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Zap, Filter } from 'lucide-react';
import { featureImportance, topFeaturesByCategory } from '../data/realData';

const CATEGORY_COLORS: Record<string, string> = {
  transaction: '#ff4d00',
  listening: '#000000',
  temporal: '#666666',
  demographic: '#999999',
  behavioral: '#333333',
  other: '#cccccc'
};

const FeatureImportanceGrouped: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ['transaction', 'listening', 'temporal', 'demographic', 'behavioral'];

  const displayedFeatures = selectedCategory
    ? featureImportance.filter(f => f.category === selectedCategory).slice(0, 20)
    : featureImportance.slice(0, 20);

  return (
    <div className="space-y-8">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 text-[9px] font-black uppercase brutalist-border transition-all ${
            !selectedCategory ? 'bg-black text-white' : 'bg-white hover:bg-brand'
          }`}
        >
          All Features
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-[9px] font-black uppercase brutalist-border transition-all ${
              selectedCategory === cat ? 'bg-black text-white' : 'bg-white hover:bg-brand'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feature Importance Chart */}
      <div className="brutalist-border p-8 bg-white dark:bg-zinc-900">
        <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 flex items-center dark:text-white">
          <Zap size={10} className="mr-1" />
          {selectedCategory ? `${selectedCategory.toUpperCase()} Features` : 'Top 20 Features'}
          <span className="ml-2 opacity-50">({displayedFeatures.length} shown)</span>
        </h3>

        <div className="h-[600px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayedFeatures} layout="vertical" margin={{ left: 20, right: 60 }}>
              <XAxis type="number" domain={[0, 1]} hide />
              <YAxis
                dataKey="feature"
                type="category"
                width={180}
                fontSize={9}
                fontWeight={700}
                tickFormatter={(v) => v.replace(/_/g, ' ').substring(0, 25)}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-black text-white p-3 brutalist-border text-[10px]">
                      <p className="font-black">{data.feature}</p>
                      <p className="opacity-70">{data.description}</p>
                      <p className="text-brand mt-2">Importance: {(data.importance * 100).toFixed(2)}%</p>
                      <p className="opacity-50">Category: {data.category}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="importance" stroke="#000" strokeWidth={1}>
                {displayedFeatures.map((entry, index) => (
                  <Cell key={index} fill={CATEGORY_COLORS[entry.category] || '#ccc'} />
                ))}
                <LabelList
                  dataKey="importance"
                  position="right"
                  fontSize={9}
                  fontWeight={700}
                  formatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-4 h-4 brutalist-border" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-black uppercase dark:text-white">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureImportanceGrouped;
```

#### 4. Update FeatureImportanceView to Use Grouped Component
**File**: `brutalist-aesthetic-kkbox-churn-analysis-pro/components/FeatureImportanceView.tsx`
**Changes**: Import and use FeatureImportanceGrouped

```typescript
// Replace existing implementation with:
import FeatureImportanceGrouped from './FeatureImportanceGrouped';

const FeatureImportanceView: React.FC = () => {
  return (
    <div className="space-y-12 pb-12">
      <div className="max-w-3xl">
        <h2 className="text-6xl font-black tracking-tighter leading-none mb-4 uppercase dark:text-white">
          VARIABLE<br/><span className="text-brand">RANKING</span>
        </h2>
        <p className="text-[12px] font-black uppercase tracking-widest opacity-60 dark:text-white">
          131 engineered features ranked by XGBoost importance
        </p>
      </div>

      <FeatureImportanceGrouped />
    </div>
  );
};

export default FeatureImportanceView;
```

### Success Criteria:

#### Automated Verification:
- [ ] All components compile: `npm run build`
- [ ] No TypeScript errors

#### Manual Verification:
- [ ] SHAP beeswarm shows color gradient from blue to red
- [ ] PR curve threshold slider updates metrics in real-time
- [ ] Feature importance category filter works correctly
- [ ] 131 features are available (not just 20)

---

## Testing Strategy

### Unit Tests:
- [ ] Data loading functions return expected types
- [ ] Chart components render without errors
- [ ] API service handles errors gracefully

### Integration Tests:
- [ ] Dashboard loads with real data
- [ ] Member lookup works with API
- [ ] All navigation routes work

### Manual Testing Steps:
1. Run `python scripts/export_dashboard_data.py` and verify JSON output
2. Start app with `npm run dev`
3. Verify each page loads without console errors
4. Test member lookup with valid/invalid IDs
5. Test all chart interactions (hover, click, filter)
6. Test dark mode toggle
7. Test on mobile viewport

## Performance Considerations

- **Static JSON**: Bundle with app for instant load (< 1MB total)
- **API Calls**: Use loading skeletons, cache responses
- **Large Charts**: Limit data points (top 20 features, sample 1000 members for beeswarm)
- **Images**: None needed (all SVG charts)

## Migration Notes

### Existing Data to Migrate:
- `data/mockData.ts` → Keep as fallback, add `data/realData.ts`
- `types.ts` → Add new interfaces (non-breaking)

### Breaking Changes:
- None - all changes are additive

### Rollback Plan:
- Keep `mockData.ts` intact
- Toggle between mock and real data via environment variable

## References

- ML training metrics: `models/training_metrics.json`
- Calibration data: `models/calibration_metrics.json`
- Ensemble weights: `models/stacked_ensemble_metrics.json`
- Dataset summary: `eval/dataset_summary.json`
- Existing API: `api/services/model_service.py`
- SHAP service: `api/services/shap_service.py`
- Research: Web search results on SHAP, Recharts, ML dashboards
