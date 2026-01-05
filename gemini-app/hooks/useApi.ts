import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMembers,
  fetchMember,
  fetchMetrics,
  fetchCalibrationData,
  fetchFeatureImportance,
  fetchShapExplanation,
  checkHealth,
  type MemberQueryParams,
  type MemberListResponse,
  type MemberDetail,
  type ModelMetrics,
  type CalibrationData,
  type FeatureImportanceResponse,
  type ShapExplanation,
} from '../services/backendService';

// Query keys for cache management
export const queryKeys = {
  members: (params?: MemberQueryParams) => ['members', params] as const,
  member: (msno: string) => ['member', msno] as const,
  metrics: () => ['metrics'] as const,
  calibration: () => ['calibration'] as const,
  featureImportance: () => ['featureImportance'] as const,
  shap: (msno: string) => ['shap', msno] as const,
  health: () => ['health'] as const,
};

/**
 * Hook to fetch paginated list of members with risk scores
 */
export function useMembers(params?: MemberQueryParams) {
  return useQuery<MemberListResponse, Error>({
    queryKey: queryKeys.members(params),
    queryFn: ({ signal }) => fetchMembers(params, signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch detailed information for a specific member
 */
export function useMember(msno: string | null) {
  return useQuery<MemberDetail, Error>({
    queryKey: queryKeys.member(msno || ''),
    queryFn: ({ signal }) => fetchMember(msno!, signal),
    enabled: !!msno,
    staleTime: 10 * 60 * 1000, // 10 minutes - member data is more static
  });
}

/**
 * Hook to fetch model performance metrics
 */
export function useMetrics() {
  return useQuery<ModelMetrics, Error>({
    queryKey: queryKeys.metrics(),
    queryFn: ({ signal }) => fetchMetrics(signal),
    staleTime: 30 * 60 * 1000, // 30 minutes - metrics don't change often
  });
}

/**
 * Hook to fetch calibration curve data
 */
export function useCalibration() {
  return useQuery<CalibrationData, Error>({
    queryKey: queryKeys.calibration(),
    queryFn: ({ signal }) => fetchCalibrationData(signal),
    staleTime: 30 * 60 * 1000, // 30 minutes - calibration data is static
  });
}

/**
 * Hook to fetch feature importance rankings
 */
export function useFeatureImportance() {
  return useQuery<FeatureImportanceResponse, Error>({
    queryKey: queryKeys.featureImportance(),
    queryFn: ({ signal }) => fetchFeatureImportance(signal),
    staleTime: 30 * 60 * 1000, // 30 minutes - feature importance is static
  });
}

/**
 * Hook to fetch SHAP explanation for a specific member
 */
export function useShapExplanation(msno: string | null) {
  return useQuery<ShapExplanation, Error>({
    queryKey: queryKeys.shap(msno || ''),
    queryFn: ({ signal }) => fetchShapExplanation(msno!, signal),
    enabled: !!msno,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // SHAP might not be available for all members
  });
}

/**
 * Hook to check API health status
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: ({ signal }) => checkHealth(signal),
    staleTime: 30 * 1000, // 30 seconds - health checks should be fresh
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to prefetch member data (useful for hover previews)
 */
export function usePrefetchMember() {
  const queryClient = useQueryClient();

  return (msno: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.member(msno),
      queryFn: ({ signal }) => fetchMember(msno, signal),
      staleTime: 10 * 60 * 1000,
    });
  };
}

/**
 * Hook to invalidate and refetch members data
 */
export function useRefreshMembers() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['members'] });
  };
}
