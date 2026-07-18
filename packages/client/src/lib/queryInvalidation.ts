import { type QueryKey, useQueryClient } from '@tanstack/react-query';

/**
 * Every project mutation must refresh the portfolio ['dashboard'] cache and the
 * per-project ['project-dashboard', projectId] cache, since both aggregate data from
 * every feature. This centralizes that rule: callers pass the additional feature caches
 * to bust and the two dashboards are always included — so a new global cache key is added
 * in one place rather than in every feature hook. ['project-dashboard'] is a prefix, so it
 * busts the dashboard for whichever project the mutation touched.
 */
export function useInvalidateProjectCaches() {
  const queryClient = useQueryClient();
  return (...keys: QueryKey[]) => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['project-dashboard'] });
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
  };
}
