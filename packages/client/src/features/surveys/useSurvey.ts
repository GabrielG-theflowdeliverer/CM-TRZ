import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssessmentType } from '@cmt/domain';
import { api } from '../../lib/api';

/** The respondent-facing view returned by the public /api/survey/:token surface. */
export interface SurveyView {
  personName: string;
  assessmentType: AssessmentType;
  assessmentLabel: string | null;
  submitted: boolean;
  responses: Record<string, number | null>;
}

export function useSurvey(token: string) {
  return useQuery({
    queryKey: ['survey', token],
    queryFn: () => api.get<SurveyView>(`/api/survey/${token}`),
    enabled: token !== '',
    // A bad or expired link is a 404, not a transient failure — don't retry.
    retry: false,
  });
}

export function useSubmitSurvey(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responses: Record<string, number | null>) =>
      api.put<SurveyView>(`/api/survey/${token}`, responses),
    onSuccess: (data) => queryClient.setQueryData(['survey', token], data),
  });
}
