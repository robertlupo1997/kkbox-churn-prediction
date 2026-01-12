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

// Type assertions for JSON imports
export const featureImportance: RealFeatureImportance[] = featureImportanceData as RealFeatureImportance[];
export const modelMetrics: ModelMetric[] = modelMetricsData as ModelMetric[];
export const ensembleWeights: EnsembleWeights = ensembleWeightsData as EnsembleWeights;
export const datasetStats: DatasetStats = datasetStatsData as DatasetStats;
export const calibrationCurves: CalibrationCurve[] = calibrationCurvesData as CalibrationCurve[];
export const riskDistribution: RiskDistribution[] = riskDistributionData as RiskDistribution[];
export const sampleMembers: SampleMember[] = sampleMembersData as SampleMember[];
export const liftGainsData: LiftGainsData = liftGainsDataRaw as LiftGainsData;
export const prCurveData: PRCurvePoint[] = prCurveDataRaw as PRCurvePoint[];

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
