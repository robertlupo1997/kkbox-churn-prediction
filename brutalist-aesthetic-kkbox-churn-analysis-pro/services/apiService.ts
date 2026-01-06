/**
 * API Service for Backend Integration
 * Connects to FastAPI backend for live predictions with SHAP explanations.
 * Falls back gracefully when API is unavailable.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SHAPFactor {
  feature: string;
  value: number;
  contribution: number;
  description: string;
}

export interface PredictionResponse {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  confidence: number;
  top_risk_factors: SHAPFactor[];
  top_protective_factors: SHAPFactor[];
  member_stats: {
    tenure_days: number;
    city: number;
    age: number;
    is_auto_renew: boolean;
    total_secs_30d: number;
    active_days_30d: number;
  };
}

export interface APIStatus {
  available: boolean;
  version?: string;
  model_loaded?: boolean;
}

/**
 * Check if the API is available
 */
export async function checkAPIStatus(): Promise<APIStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      return { available: false };
    }

    const data = await response.json();
    return {
      available: true,
      version: data.version,
      model_loaded: data.model_loaded,
    };
  } catch (error) {
    return { available: false };
  }
}

/**
 * Get prediction and SHAP explanation for a member
 */
export async function getMemberPrediction(msno: string): Promise<PredictionResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict/${encodeURIComponent(msno)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

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

/**
 * Search for members by partial ID match
 */
export async function searchMembers(query: string, limit: number = 10): Promise<string[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/members/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
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

/**
 * Generate mock SHAP factors for demo when API is unavailable
 */
export function generateMockSHAPFactors(riskScore: number): {
  riskFactors: SHAPFactor[];
  protectiveFactors: SHAPFactor[];
} {
  // Mock risk factors - vary based on risk score
  const riskFactors: SHAPFactor[] = [
    {
      feature: 'cancel_count_30d',
      value: riskScore > 50 ? 2 : 0,
      contribution: riskScore > 50 ? 0.15 : 0.02,
      description: 'Number of cancellations in last 30 days',
    },
    {
      feature: 'auto_renew_ratio_30d',
      value: riskScore > 50 ? 0.2 : 0.8,
      contribution: riskScore > 50 ? 0.12 : 0.01,
      description: 'Ratio of auto-renew transactions',
    },
    {
      feature: 'active_days_30d',
      value: riskScore > 50 ? 5 : 25,
      contribution: riskScore > 50 ? 0.08 : -0.05,
      description: 'Days with listening activity',
    },
    {
      feature: 'total_secs_trend',
      value: riskScore > 50 ? -0.4 : 0.2,
      contribution: riskScore > 50 ? 0.06 : -0.03,
      description: 'Listening time trend (negative = declining)',
    },
  ].filter(f => f.contribution > 0);

  const protectiveFactors: SHAPFactor[] = [
    {
      feature: 'tenure_days',
      value: 730,
      contribution: -0.08,
      description: 'Days since registration',
    },
    {
      feature: 'latest_auto_renew',
      value: riskScore < 50 ? 1 : 0,
      contribution: riskScore < 50 ? -0.12 : 0,
      description: 'Auto-renew enabled on latest subscription',
    },
    {
      feature: 'completion_rate_90d',
      value: riskScore < 50 ? 0.75 : 0.3,
      contribution: riskScore < 50 ? -0.06 : 0,
      description: 'Song completion rate',
    },
  ].filter(f => f.contribution < 0);

  return { riskFactors, protectiveFactors };
}
