import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { AssessmentDto } from '../../lib/types';

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
  const queryClient = useQueryClient();
  return (assessmentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['assessments', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (assessmentId) void queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
  };
}

export function useSaveResponses(projectId: string, assessmentId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAssessments(projectId);
  return useMutation({
    mutationFn: (responses: Record<string, number | null>) =>
      api.put<AssessmentDto>(`/api/assessments/${assessmentId}/responses`, responses),
    onSuccess: (data) => {
      queryClient.setQueryData(['assessment', assessmentId], data);
      invalidate();
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
