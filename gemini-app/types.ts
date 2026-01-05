/**
 * Re-export all types from backendService to maintain backward compatibility
 * and provide a single source of truth for type definitions.
 */
export type {
  Member,
  MemberDetail,
  MemberListResponse,
  MemberQueryParams,
  ActionRecommendation,
  ModelMetrics,
  FeatureImportanceItem,
  FeatureImportanceResponse,
  CalibrationPoint,
  CalibrationData,
  PredictionResult,
  ShapValue,
  ShapExplanation,
  HealthResponse,
} from './services/backendService';

export { ApiError } from './services/backendService';

// Additional UI-specific types
export interface Metric {
  name: string;
  value: number;
  benchmark?: number;
  description: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  description: string;
}

export interface ReliabilityPoint {
  mean_predicted: number;
  fraction_of_positives: number;
}

// Risk tier type for convenience
export type RiskTier = 'Low' | 'Medium' | 'High';

// KPI data interface for dashboard
export interface KPIData {
  total: string;
  highRisk: string;
  avgRisk: string;
  revenueAtRisk: string;
}
