import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { parseDuration } from '../types';

/**
 * Wrapper around useQuery that handles:
 * - Parsing refresh interval strings (e.g., "5m", "1h")
 * - Consistent stale time based on refresh interval
 */
export function useWidgetQuery<TData>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options?: {
    refresh?: string;
    enabled?: boolean;
  } & Omit<UseQueryOptions<TData, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const { refresh, enabled = true, ...queryOptions } = options ?? {};
  const refetchInterval = parseDuration(refresh) ?? undefined;

  return useQuery({
    queryKey,
    queryFn,
    enabled,
    refetchInterval,
    // Set stale time to half the refresh interval, or 30 seconds if no refresh
    staleTime: refetchInterval ? refetchInterval / 2 : 30 * 1000,
    ...queryOptions,
  });
}
