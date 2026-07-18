import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SurveyCampaign, SurveyCampaignSummary } from '@cmt/domain';
import { api } from '../../lib/api';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

/** How often to poll while a campaign is still awaiting responses. */
const POLL_MS = 8000;

/** True while at least one campaign has recipients who haven't submitted. */
export function hasPendingCampaign(list: SurveyCampaignSummary[] | undefined): boolean {
  return list?.some((c) => c.submittedCount < c.recipientCount) ?? false;
}

/** True while at least one recipient of a campaign hasn't submitted. */
export function hasPendingRecipient(campaign: SurveyCampaign | undefined): boolean {
  return campaign?.recipients.some((r) => r.submittedAt === null) ?? false;
}

/** Campaigns opened in a project, with response progress. */
export function useCampaigns(projectId: string) {
  return useQuery({
    queryKey: ['campaigns', projectId],
    queryFn: () => api.get<SurveyCampaignSummary[]>(`/api/projects/${projectId}/surveys`),
    enabled: projectId !== '',
    // Respondents submit from their own browsers, which can't notify us — so
    // poll while anyone is still outstanding, and stop once everyone's in.
    refetchInterval: (query) => (hasPendingCampaign(query.state.data) ? POLL_MS : false),
  });
}

/** A single campaign with its tokened recipients. */
export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<SurveyCampaign>(`/api/surveys/${campaignId}`),
    enabled: campaignId !== '',
    refetchInterval: (query) => (hasPendingRecipient(query.state.data) ? POLL_MS : false),
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
