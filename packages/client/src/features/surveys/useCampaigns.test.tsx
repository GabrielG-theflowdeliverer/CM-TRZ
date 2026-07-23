import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SurveyCampaign, SurveyCampaignSummary } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { hasPendingCampaign, hasPendingRecipient, useCreateCampaign } from './useCampaigns';

const summary = (over: Partial<SurveyCampaignSummary> = {}): SurveyCampaignSummary => ({
  id: 'c1',
  assessmentId: 'a1',
  createdAt: 'x',
  recipientCount: 2,
  submittedCount: 0,
  ...over,
});

describe('polling predicates', () => {
  it('hasPendingCampaign is true only while a campaign is awaiting responses', () => {
    expect(hasPendingCampaign(undefined)).toBe(false);
    expect(hasPendingCampaign([])).toBe(false);
    expect(hasPendingCampaign([summary({ submittedCount: 1, recipientCount: 2 })])).toBe(true);
    expect(hasPendingCampaign([summary({ submittedCount: 2, recipientCount: 2 })])).toBe(false);
  });

  it('hasPendingRecipient is true while any recipient has not submitted', () => {
    expect(hasPendingRecipient(undefined)).toBe(false);
    const base: SurveyCampaign = { id: 'c1', projectId: 'p1', assessmentId: 'a1', createdAt: 'x', recipients: [] };
    const rec = (submittedAt: string | null) => ({
      id: 'x',
      roleId: 'r',
      personName: 'P',
      roleName: null,
      token: 't',
      submittedAt,
      expiresAt: null,
    });
    expect(hasPendingRecipient({ ...base, recipients: [rec('y'), rec(null)] })).toBe(true);
    expect(hasPendingRecipient({ ...base, recipients: [rec('y')] })).toBe(false);
  });
});

const campaign: SurveyCampaign = {
  id: 'c1',
  projectId: 'p1',
  assessmentId: 'a1',
  createdAt: '2026-07-18T00:00:00.000Z',
  recipients: [],
};

function Launcher() {
  const create = useCreateCampaign('p1', 'a1');
  return (
    <button type="button" onClick={() => create.mutate(['r1', 'r2'])}>
      launch
    </button>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useCreateCampaign', () => {
  it('posts the selected roleIds and invalidates the campaign + assessment caches', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(campaign);
    const { client } = renderWithClient(<Launcher />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await userEvent.click(screen.getByText('launch'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/surveys');
    expect(post.mock.calls[0]![1]).toEqual({ assessmentId: 'a1', roleIds: ['r1', 'r2'] });

    const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(['campaigns', 'p1']);
    expect(keys).toContainEqual(['assessment', 'a1']);
  });
});
