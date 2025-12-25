/**
 * Backend API service for KKBOX Churn Prediction
 * Handles all API calls to FastAPI backend at localhost:8000
 */

const API_BASE = '/api';

export interface MemberQueryParams {
  limit?: number;
  offset?: number;
  risk_tier?: 'Low' | 'Medium' | 'High';
  min_risk?: number;
}

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

export interface ModelMetrics {
  model_name: string;
  log_loss: number;
  auc: number;
  brier_score: number | null;
  ece: number | null;
  training_samples: number | null;
  validation_samples: number | null;
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

export interface CalibrationPoint {
  mean_predicted: number;
  fraction_of_positives: number;
}

export interface CalibrationData {
  uncalibrated: CalibrationPoint[];
  calibrated: CalibrationPoint[];
}

export interface PredictionResult {
  msno: string;
  churn_probability: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  action: string;
}

/**
 * Fetch paginated list of members with risk scores
 */
export async function fetchMembers(params?: MemberQueryParams): Promise<MemberListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.risk_tier) queryParams.append('risk_tier', params.risk_tier);
  if (params?.min_risk !== undefined) queryParams.append('min_risk', params.min_risk.toString());

  const url = `${API_BASE}/members${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch members: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch detailed information for a specific member
 */
export async function fetchMember(msno: string): Promise<MemberDetail> {
  const response = await fetch(`${API_BASE}/members/${msno}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Member ${msno} not found`);
    }
    throw new Error(`Failed to fetch member: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch model performance metrics
 */
export async function fetchMetrics(): Promise<ModelMetrics> {
  const response = await fetch(`${API_BASE}/metrics`);

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch feature importance rankings
 */
export async function fetchFeatureImportance(): Promise<FeatureImportanceResponse> {
  const response = await fetch(`${API_BASE}/features/importance`);

  if (!response.ok) {
    throw new Error(`Failed to fetch feature importance: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch calibration curve data
 */
export async function fetchCalibrationData(): Promise<CalibrationData> {
  const response = await fetch(`${API_BASE}/calibration`);

  if (!response.ok) {
    throw new Error(`Failed to fetch calibration data: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Upload predictions CSV file
 */
export async function uploadPredictions(file: File): Promise<PredictionResult[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/predictions/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload predictions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check API health status
 */
export async function checkHealth(): Promise<{ status: string; model_loaded: boolean; features_loaded: boolean }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}
