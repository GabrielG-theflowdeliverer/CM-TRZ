import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CmPerfReport } from '@cmt/domain';
import { api } from '../../lib/api';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export function useCmPerfReports(projectId: string) {
  return useQuery({
    queryKey: ['cm-perf-reports', projectId],
    queryFn: () => api.get<CmPerfReport[]>(`/api/projects/${projectId}/cm-perf-reports`),
    enabled: projectId !== '',
  });
}

export function useCmPerfReportMutations(projectId: string) {
  const invalidateCaches = useInvalidateProjectCaches();
  const invalidate = () => invalidateCaches(['cm-perf-reports', projectId], ['project-dashboard', projectId]);
  const create = useMutation({
    mutationFn: (reportName: string) =>
      api.post<CmPerfReport>(`/api/projects/${projectId}/cm-perf-reports`, {
        name: reportName,
        date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/cm-perf-reports/${id}`),
    onSuccess: invalidate,
  });
  return { create, remove };
}

export function useCmPerfReport(projectId: string, reportId: string) {
  const queryClient = useQueryClient();
  const invalidateCaches = useInvalidateProjectCaches();
  const query = useQuery({
    queryKey: ['cm-perf-reports', projectId, reportId],
    queryFn: () => api.get<CmPerfReport>(`/api/cm-perf-reports/${reportId}`),
    enabled: reportId !== '',
  });
  const refresh = (data?: CmPerfReport) => {
    if (data) queryClient.setQueryData(['cm-perf-reports', projectId, reportId], data);
    invalidateCaches(['cm-perf-reports', projectId], ['project-dashboard', projectId]);
  };
  const updateReport = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.patch<CmPerfReport>(`/api/cm-perf-reports/${reportId}`, fields),
    onSuccess: refresh,
  });
  const updateItem = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<CmPerfReport>(`/api/cm-perf-items/${input.id}`, input.fields),
    onSuccess: refresh,
  });
  return { report: query.data, updateReport, updateItem };
}
