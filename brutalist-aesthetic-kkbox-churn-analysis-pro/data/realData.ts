/**
 * Real ML Data Loader
 * Loads exported JSON data from the ML pipeline for the dashboard.
 */

import featureImportanceData from './featureImportance.json';
import modelMetricsData from './modelMetrics.json';
import ensembleWeightsData from './ensembleWeights.json';
import datasetStatsData from './datasetStats.json';
import calibrationCurvesData from './calibrationCurves.json';
import riskDistributionData from './riskDistribution.json';
import sampleMembersData from './sampleMembers.json';
import liftGainsDataRaw from './liftGainsData.json';
import prCurveDataRaw from './prCurveData.json';

import type {
  RealFeatureImportance,
  ModelMetric,
  EnsembleWeights,
  DatasetStats,
  CalibrationCurve,
  RiskDistribution,
  SampleMember,
  LiftGainsData,
  PRCurvePoint,
} from '../types';

// Five of these files carry a `_provenance` string saying their derivation is not
// committed: scripts/export_dashboard_data.py builds them from
// eval/stacked_ensemble_predictions.csv, which is not in the repository and cannot
// be regenerated from it. Re-running the export returns empty for those files today.
// The note travels with the data so it cannot be lost by reading the array alone.
const unwrap = <T,>(raw: unknown): T[] =>
  Array.isArray(raw) ? (raw as T[]) : ((raw as { data: T[] }).data ?? []);

/** The provenance note attached to a data file, or null if it carries none. */
export const provenanceOf = (raw: unknown): string | null =>
  (!Array.isArray(raw) && (raw as { _provenance?: string })?._provenance) || null;

// Type assertions for JSON imports
export const featureImportance: RealFeatureImportance[] = featureImportanceData as RealFeatureImportance[];
export const modelMetrics: ModelMetric[] = modelMetricsData as ModelMetric[];
export const ensembleWeights: EnsembleWeights = ensembleWeightsData as EnsembleWeights;
export const datasetStats: DatasetStats = datasetStatsData as DatasetStats;
export const calibrationCurves: CalibrationCurve[] = unwrap<CalibrationCurve>(calibrationCurvesData);
export const riskDistribution: RiskDistribution[] = unwrap<RiskDistribution>(riskDistributionData);
export const sampleMembers: SampleMember[] = unwrap<SampleMember>(sampleMembersData);
export const liftGainsData: LiftGainsData = liftGainsDataRaw as LiftGainsData;
export const prCurveData: PRCurvePoint[] = unwrap<PRCurvePoint>(prCurveDataRaw);

/** True for any chart whose numbers cannot be reproduced from this repository. */
export const derivationNotCommitted = provenanceOf(prCurveDataRaw) !== null;

// Computed statistics for dashboard KPIs
export const dashboardKPIs = {
  totalSubscribers: datasetStats.total_members.toLocaleString(),
  churnRate: `${datasetStats.churn_rate}%`,
  highRiskUsers: Math.round(datasetStats.total_members * datasetStats.churn_rate / 100).toLocaleString(),
  revenueAtRisk: `$${(datasetStats.total_members * datasetStats.churn_rate / 100 * 149 / 1000000).toFixed(1)}M`,
  bestModelAUC: Math.max(...modelMetrics.map(m => m.auc)).toFixed(3),
  featureCount: datasetStats.feature_count,
};

// Pie chart data derived from risk distribution
export const pieData = (() => {
  const lowCount = riskDistribution
    .filter(r => r.tier === 'Low')
    .reduce((sum, r) => sum + r.count, 0);
  const mediumCount = riskDistribution
    .filter(r => r.tier === 'Medium')
    .reduce((sum, r) => sum + r.count, 0);
  const highCount = riskDistribution
    .filter(r => r.tier === 'High')
    .reduce((sum, r) => sum + r.count, 0);

  const total = lowCount + mediumCount + highCount;

  return [
    { name: 'Low Risk', value: Math.round(lowCount / total * 100), tier: 'Low' as const },
    { name: 'Medium Risk', value: Math.round(mediumCount / total * 100), tier: 'Medium' as const },
    { name: 'High Risk', value: Math.round(highCount / total * 100), tier: 'High' as const },
  ];
})();

// Top features by category for quick access
export const topFeaturesByCategory = {
  transaction: featureImportance.filter(f => f.category === 'transaction').slice(0, 5),
  listening: featureImportance.filter(f => f.category === 'listening').slice(0, 5),
  temporal: featureImportance.filter(f => f.category === 'temporal').slice(0, 5),
  demographic: featureImportance.filter(f => f.category === 'demographic').slice(0, 5),
  behavioral: featureImportance.filter(f => f.category === 'behavioral').slice(0, 5),
};

// Best performing model
export const bestModel = modelMetrics.reduce((best, m) => m.auc > best.auc ? m : best);

// Models with calibration data
export const calibratedModels = modelMetrics.filter(m => m.calibrated_log_loss !== undefined);
