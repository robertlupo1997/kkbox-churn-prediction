/**
 * API service for the churn demo.
 *
 * The bundle and the API are served by the same process: the Dockerfile builds
 * this app into `./static`, and one uvicorn serves both that and `/api/*` on
 * port 7860. So the base URL is relative by default. `VITE_API_URL` remains an
 * override for running `vite dev` against an API on another port.
 *
 * Member ids are sent in a request body, never in a path segment. 4,927 of the
 * 10,000 shipped msnos contain `/`, which ends a path segment; percent-encoding
 * does not survive routing, and 4,802 contain `+`, which decodes to a space in
 * a query string. `POST /api/members/lookup` and `POST /api/shap` exist for
 * that reason.
 *
 * There is no mock data in this file. When the API cannot answer, the caller is
 * told so and the UI says so.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const HEALTH_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 10000;

/** Raised when the API is reachable but could not answer for this member. */
export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

/** One member as the API returns it. `risk_score` is a probability in [0, 1]. */
export interface ApiMember {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean | null;
  /**
   * Globally important model features. The API documents these as identical
   * for every member, so the UI must not present them as this member's reasons.
   * Per-member attribution comes from `fetchShap`.
   */
  top_risk_factors: string[];
  action_recommendation: string;
}

export interface ApiMemberList {
  members: ApiMember[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiAction {
  category: string;
  recommendation: string;
  message: string;
  urgency: string;
  channels: string[];
}

export interface ApiMemberDetail {
  msno: string;
  risk_score: number;
  risk_tier: 'Low' | 'Medium' | 'High';
  is_churn: boolean | null;
  features: Record<string, number | string | null>;
  action: ApiAction;
}

/** One feature's signed contribution to this member's score. */
export interface ShapFactor {
  feature: string;
  impact: number;
}

export interface ApiShapExplanation {
  base_value: number;
  shap_values: Record<string, number>;
  top_risk_factors: ShapFactor[];
  top_protective_factors: ShapFactor[];
  is_approximate: boolean;
}

export interface ApiStatus {
  available: boolean;
  modelLoaded?: boolean;
  featuresLoaded?: boolean;
}

async function getJson<T>(path: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new ApiUnavailableError(`GET ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) {
    throw new ApiUnavailableError('not_found');
  }
  if (!response.ok) {
    throw new ApiUnavailableError(`POST ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Ask whether the API can serve predictions.
 *
 * `/api/health` reports healthy even when the member table is empty, which is
 * how the demo shipped for months looking connected and serving nothing. So
 * this also asks for one member and treats an empty population as unavailable.
 */
export async function checkApiStatus(): Promise<ApiStatus> {
  try {
    const health = await getJson<{
      status: string;
      model_loaded?: boolean;
      features_loaded?: boolean;
    }>('/api/health', HEALTH_TIMEOUT_MS);

    const probe = await getJson<ApiMemberList>('/api/members?limit=1', HEALTH_TIMEOUT_MS);

    return {
      available: health.status === 'healthy' && probe.total > 0,
      modelLoaded: health.model_loaded,
      featuresLoaded: health.features_loaded,
    };
  } catch {
    return { available: false };
  }
}

/** How many members the API is serving. */
export async function fetchPopulationSize(): Promise<number> {
  const page = await getJson<ApiMemberList>('/api/members?limit=1');
  return page.total;
}

/**
 * Search the served population by substring of the member id.
 *
 * The search runs on the server, over the members the API actually has. The
 * previous implementation matched against a list bundled into this app, so a
 * hit said nothing about whether the API knew the member.
 */
export async function searchMembers(query: string, limit = 12): Promise<ApiMemberList> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return getJson<ApiMemberList>(`/api/members?${params.toString()}`);
}

/** Full record for one member. Returns null when the API has no such member. */
export async function fetchMemberDetail(msno: string): Promise<ApiMemberDetail | null> {
  try {
    return await postJson<ApiMemberDetail>('/api/members/lookup', { msno });
  } catch (error) {
    if (error instanceof ApiUnavailableError && error.message === 'not_found') {
      return null;
    }
    throw error;
  }
}

/** Largest log-odds gap between an explanation and the score it explains. */
export const SHAP_RECONCILIATION_TOLERANCE = 1e-3;

const logit = (p: number): number => {
  const clamped = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  return Math.log(clamped / (1 - clamped));
};

/**
 * Decide whether an explanation actually explains the score it came with.
 *
 * Real SHAP values are additive in log-odds: `base_value + sum(shap_values)`
 * equals `logit(risk_score)`. The API also has a fallback that returns
 * `importance * z_score * 0.1` per feature with a hardcoded base value of
 * -1.5, flagged only by `is_approximate`. Those numbers are not attributions
 * and do not sum to anything -- observed off by 141 log-odds on a member the
 * real path explained to within 1e-6. Neither the flag nor the arithmetic is
 * trusted alone: both must hold.
 */
export function checkShapReconciles(
  explanation: ApiShapExplanation,
  riskScore: number,
): { ok: boolean; residual: number; reason?: string } {
  const total =
    explanation.base_value +
    Object.values(explanation.shap_values).reduce((sum: number, v) => sum + Number(v), 0);
  const residual = Math.abs(logit(riskScore) - total);

  if (explanation.is_approximate) {
    return {
      ok: false,
      residual,
      reason:
        'the API flagged this explanation as approximate, which means it came from a ' +
        'feature-importance fallback rather than the model',
    };
  }
  if (!(residual <= SHAP_RECONCILIATION_TOLERANCE)) {
    return {
      ok: false,
      residual,
      reason: `the contributions do not sum to the score (off by ${residual.toFixed(3)} log-odds)`,
    };
  }
  return { ok: true, residual };
}

/**
 * Per-member SHAP attribution.
 *
 * Returns null when the API has no explanation for this member. The caller must
 * say the explanation is unavailable. It must not substitute anything, and it
 * must run `checkShapReconciles` before drawing it.
 */
export async function fetchShap(msno: string): Promise<ApiShapExplanation | null> {
  try {
    const payload = await postJson<{ msno: string; explanation: ApiShapExplanation }>(
      '/api/shap',
      { msno },
    );
    return payload.explanation;
  } catch (error) {
    if (error instanceof ApiUnavailableError && error.message === 'not_found') {
      return null;
    }
    throw error;
  }
}
