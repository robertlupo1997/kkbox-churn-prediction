// Backend API types
export interface Member {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean | null;
  top_risk_factors: string[];
  action_recommendation: string;
}

export interface ActionRecommendation {
  category: string;
  recommendation: string;
  message: string;
  urgency: string;
  channels: string[];
}

export interface MemberDetail {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean | null;
  features: Record<string, any>;
  action: ActionRecommendation;
}

export interface MemberListResponse {
  members: Member[];
  total: number;
  limit: number;
  offset: number;
}

export interface Metric {
  name: string;
  value: number;
  benchmark?: number;
  description: string;
}

export interface ModelMetrics {
  model_name: string;
  log_loss: number;
  auc: number;
  brier_score: number | null;
  ece: number | null;
  training_samples: number | null;
  validation_samples: number | null;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  description: string;
}

export interface FeatureImportanceItem {
  name: string;
  importance: number;
  description: string | null;
  rank: number;
}

export interface FeatureImportanceResponse {
  features: FeatureImportanceItem[];
}

export interface ReliabilityPoint {
  mean_predicted: number;
  fraction_of_positives: number;
}

export interface CalibrationPoint {
  mean_predicted: number;
  fraction_of_positives: number;
}

export interface CalibrationData {
  uncalibrated: CalibrationPoint[];
  calibrated: CalibrationPoint[];
}

export interface ShapValue {
  feature: string;
  impact: number;
}

export interface ShapExplanation {
  msno: string;
  explanation: {
    base_value: number;
    shap_values: Record<string, number>;
    top_risk_factors: ShapValue[];
    top_protective_factors: ShapValue[];
  };
}
