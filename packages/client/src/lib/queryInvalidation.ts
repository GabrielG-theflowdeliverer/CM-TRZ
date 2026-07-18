import { type QueryKey, useQueryClient } from '@tanstack/react-query';

/**
 * Every project mutation must refresh the portfolio ['dashboard'] cache, since the
 * dashboard aggregates data from every feature. This centralizes that rule: callers pass
 * the additional feature caches to bust and ['dashboard'] is always included — so a new
 * global cache key is added in one place rather than in every feature hook.
 */
export function useInvalidateProjectCaches() {
  const queryClient = useQueryClient();
  return (...keys: QueryKey[]) => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
  };
}
