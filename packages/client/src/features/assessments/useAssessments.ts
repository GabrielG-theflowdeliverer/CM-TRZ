import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AssessmentDto } from '../../lib/types';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export function useAssessments(projectId: string, type?: string) {
  return useQuery({
    queryKey: ['assessments', projectId, type ?? 'all'],
    queryFn: () =>
      api.get<AssessmentDto[]>(`/api/projects/${projectId}/assessments${type ? `?type=${type}` : ''}`),
    enabled: projectId !== '',
  });
}

export function useAssessment(assessmentId: string) {
  return useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => api.get<AssessmentDto>(`/api/assessments/${assessmentId}`),
    enabled: assessmentId !== '',
  });
}

export function useInvalidateAssessments(projectId: string) {
  const invalidateCaches = useInvalidateProjectCaches();
  return (assessmentId?: string) => {
    const extra: QueryKey[] = assessmentId ? [['assessment', assessmentId]] : [];
    invalidateCaches(['assessments', projectId], ...extra);
  };
}

export function useSaveResponses(projectId: string, assessmentId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAssessments(projectId);
  const mutationKey = ['save-responses', assessmentId];
  return useMutation({
    mutationKey,
    mutationFn: (responses: Record<string, number | null>) =>
      api.put<AssessmentDto>(`/api/assessments/${assessmentId}/responses`, responses),
    // Optimistically merge the clicked score so the picker reflects it instantly.
    onMutate: (responses) => {
      queryClient.setQueryData<AssessmentDto>(['assessment', assessmentId], (old) =>
        old ? { ...old, responses: { ...old.responses, ...responses } } : old,
      );
    },
    // Rapid clicks fire parallel PUTs whose full-state responses can arrive out of
    // order; only let the LAST in-flight save write the server payload to the cache.
    onSettled: (data) => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        if (data) queryClient.setQueryData(['assessment', assessmentId], data);
        else void queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
        invalidate();
      }
    },
  });
}

export function useUpdateAssessment(projectId: string, assessmentId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAssessments(projectId);
  return useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.patch<AssessmentDto>(`/api/assessments/${assessmentId}`, fields),
    onSuccess: (data) => {
      queryClient.setQueryData(['assessment', assessmentId], data);
      invalidate();
    },
  });
}
