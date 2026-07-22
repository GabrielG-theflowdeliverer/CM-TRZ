import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Measurement, Metric, MetricRealization, Objective } from '@cmt/domain';
import { api } from '../../lib/api';

export type MetricDto = Metric & { measurements: Measurement[]; computed: MetricRealization };
export type ObjectiveDto = Objective & { metrics: MetricDto[]; realization: number | null };
export interface OutcomesDto {
  objectives: ObjectiveDto[];
  realization: number | null;
}

export function useOutcomes(projectId: string) {
  return useQuery({
    queryKey: ['outcomes', projectId],
    queryFn: () => api.get<OutcomesDto>(`/api/projects/${projectId}/outcomes`),
    enabled: projectId !== '',
  });
}

/** All the write paths for the Outcomes page, each refreshing the tree. */
export function useOutcomeMutations(projectId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => void queryClient.invalidateQueries({ queryKey: ['outcomes', projectId] });

  return {
    createObjective: useMutation({
      mutationFn: (input: { level: string; statement: string }) =>
        api.post<Objective>(`/api/projects/${projectId}/objectives`, input),
      onSuccess,
    }),
    deleteObjective: useMutation({ mutationFn: (id: string) => api.del(`/api/objectives/${id}`), onSuccess }),
    createMetric: useMutation({
      mutationFn: ({ objectiveId, ...input }: { objectiveId: string } & Record<string, unknown>) =>
        api.post<Metric>(`/api/objectives/${objectiveId}/metrics`, input),
      onSuccess,
    }),
    deleteMetric: useMutation({ mutationFn: (id: string) => api.del(`/api/metrics/${id}`), onSuccess }),
    addMeasurement: useMutation({
      mutationFn: ({ metricId, ...input }: { metricId: string; date: string; value: number }) =>
        api.post<Measurement>(`/api/metrics/${metricId}/measurements`, input),
      onSuccess,
    }),
    deleteMeasurement: useMutation({ mutationFn: (id: string) => api.del(`/api/measurements/${id}`), onSuccess }),
  };
}
