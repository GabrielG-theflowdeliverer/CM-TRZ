import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Roadmap } from '../../lib/types';
import { api } from '../../lib/api';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export interface RescheduleChange {
  projectId: string;
  kickoffDate: string | null;
  goliveDate: string | null;
  outcomesDate: string | null;
}

/**
 * Commit a what-if re-sequencing: write each project's new roadmap dates. The
 * server's updateRoadmap cascades to reschedule that project's PCT assessments,
 * so we invalidate the assessment caches too. Applied sequentially; any failure
 * surfaces via the global mutation-error toast.
 */
export function useApplyReschedule() {
  const queryClient = useQueryClient();
  const invalidateCaches = useInvalidateProjectCaches();
  return useMutation({
    mutationFn: async (changes: RescheduleChange[]) => {
      for (const c of changes) {
        await api.put<Roadmap>(`/api/projects/${c.projectId}/roadmap`, {
          kickoffDate: c.kickoffDate,
          goliveDate: c.goliveDate,
          outcomesDate: c.outcomesDate,
        });
      }
      return changes;
    },
    onSuccess: (changes) => {
      invalidateCaches(['saturation']);
      for (const c of changes) {
        void queryClient.invalidateQueries({ queryKey: ['roadmap', c.projectId] });
        void queryClient.invalidateQueries({ queryKey: ['project', c.projectId] });
        void queryClient.invalidateQueries({ queryKey: ['assessments', c.projectId] });
        void queryClient.invalidateQueries({ queryKey: ['assessment', c.projectId] });
      }
    },
  });
}
