import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SurveyCampaign, SurveyCampaignSummary } from '@cmt/domain';
import { api } from '../../lib/api';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

/** Campaigns opened in a project, with response progress. */
export function useCampaigns(projectId: string) {
  return useQuery({
    queryKey: ['campaigns', projectId],
    queryFn: () => api.get<SurveyCampaignSummary[]>(`/api/projects/${projectId}/surveys`),
    enabled: projectId !== '',
  });
}

/** A single campaign with its tokened recipients. */
export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<SurveyCampaign>(`/api/surveys/${campaignId}`),
    enabled: campaignId !== '',
  });
}

/**
 * Launch a campaign for one assessment. On success, refresh the campaign list
 * and the assessment itself — its roll-up (`survey` block, computed scores)
 * changes the moment recipients start submitting, and the first submission
 * flips the run from hand-entered to survey-fed.
 */
export function useCreateCampaign(projectId: string, assessmentId: string) {
  const queryClient = useQueryClient();
  const invalidateCaches = useInvalidateProjectCaches();
  return useMutation({
    mutationFn: (roleIds: string[]) =>
      api.post<SurveyCampaign>(`/api/projects/${projectId}/surveys`, { assessmentId, roleIds }),
    onSuccess: () => {
      invalidateCaches(['campaigns', projectId]);
      void queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
    },
  });
}
