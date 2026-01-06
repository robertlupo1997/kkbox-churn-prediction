
export interface Member {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean;
  city: number;
  bd: number;
  gender: string;
  registered_via: number;
  registration_init_time: string;
  payment_method_id: number;
  payment_plan_days: number;
  plan_list_price: number;
  actual_amount_paid: number;
  is_auto_renew: number;
  last_transaction_date: string;
  num_25: number;
  num_50: number;
  num_75: number;
  num_985: number;
  num_100: number;
  num_unq: number;
  total_secs: number;
}

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

// Real data types for ML dashboard

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

export interface RiskDistribution {
  range: string;
  count: number;
  tier: 'Low' | 'Medium' | 'High';
}

export interface SampleMember {
  msno: string;
  msno_full: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean;
  city: number;
  age: number;
  tenure_days: number;
  is_auto_renew: boolean;
  total_secs_30d: number;
  active_days_30d: number;
}

export interface LiftDataPoint {
  percentile: number;
  lift: number;
  cumGain: number;
}

export interface GainsDataPoint {
  percentContacted: number;
  percentCaptured: number;
}

export interface LiftGainsData {
  lift: LiftDataPoint[];
  gains: GainsDataPoint[];
}

export interface PRCurvePoint {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface SHAPContribution {
  feature: string;
  value: number;
  contribution: number;
  description: string;
}

export interface MemberPrediction {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  confidence: number;
  top_risk_factors: SHAPContribution[];
  top_protective_factors: SHAPContribution[];
  member_stats: {
    tenure_days: number;
    city: number;
    age: number;
    is_auto_renew: boolean;
    total_secs_30d: number;
    active_days_30d: number;
  };
}
