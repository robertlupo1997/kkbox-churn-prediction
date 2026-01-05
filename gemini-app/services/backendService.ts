/**
 * Backend API service for KKBOX Churn Prediction
 * Handles all API calls to FastAPI backend
 * Enhanced with AbortController support and typed error handling
 */

const API_BASE = '/api';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Type definitions
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
  features: Record<string, unknown>;
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

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  features_loaded: boolean;
}

/**
 * Generic fetch wrapper with error handling and AbortController support
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const fetchOptions: RequestInit = {
    ...options,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || `Request failed: ${response.statusText}`,
        response.status,
        errorData.code
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error; // Let TanStack Query handle abort errors
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Fetch paginated list of members with risk scores
 */
export async function fetchMembers(
  params?: MemberQueryParams,
  signal?: AbortSignal
): Promise<MemberListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.risk_tier) queryParams.append('risk_tier', params.risk_tier);
  if (params?.min_risk !== undefined) queryParams.append('min_risk', params.min_risk.toString());

  const url = `${API_BASE}/members${queryParams.toString() ? `?${queryParams}` : ''}`;
  return apiFetch<MemberListResponse>(url, {}, signal);
}

/**
 * Fetch detailed information for a specific member
 */
export async function fetchMember(
  msno: string,
  signal?: AbortSignal
): Promise<MemberDetail> {
  return apiFetch<MemberDetail>(
    `${API_BASE}/members/${encodeURIComponent(msno)}`,
    {},
    signal
  );
}

/**
 * Fetch model performance metrics
 */
export async function fetchMetrics(signal?: AbortSignal): Promise<ModelMetrics> {
  return apiFetch<ModelMetrics>(`${API_BASE}/metrics`, {}, signal);
}

/**
 * Fetch feature importance rankings
 */
export async function fetchFeatureImportance(
  signal?: AbortSignal
): Promise<FeatureImportanceResponse> {
  return apiFetch<FeatureImportanceResponse>(
    `${API_BASE}/features/importance`,
    {},
    signal
  );
}

/**
 * Fetch calibration curve data
 */
export async function fetchCalibrationData(
  signal?: AbortSignal
): Promise<CalibrationData> {
  return apiFetch<CalibrationData>(`${API_BASE}/calibration`, {}, signal);
}

/**
 * Upload predictions CSV file
 */
export async function uploadPredictions(
  file: File,
  signal?: AbortSignal
): Promise<PredictionResult[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/predictions/upload`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || `Upload failed: ${response.statusText}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Check API health status
 */
export async function checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiFetch<HealthResponse>(`${API_BASE}/health`, {}, signal);
}

/**
 * Fetch SHAP explanation for a specific member
 */
export async function fetchShapExplanation(
  msno: string,
  signal?: AbortSignal
): Promise<ShapExplanation> {
  return apiFetch<ShapExplanation>(
    `${API_BASE}/shap/${encodeURIComponent(msno)}`,
    {},
    signal
  );
}
