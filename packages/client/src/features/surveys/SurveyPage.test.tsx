import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { surveyStructure } from '@cmt/domain';
import { api, ApiError } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { SurveyPage } from './SurveyPage';
import type { SurveyView } from './useSurvey';

const view = (over: Partial<SurveyView> = {}): SurveyView => ({
  personName: 'J. Smith',
  assessmentType: 'sponsor_competency',
  assessmentLabel: null,
  submitted: false,
  responses: {},
  ...over,
});

function renderAt(token = 'tok') {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/s/${token}`]}>
      <Routes>
        <Route path="/s/:token" element={<SurveyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('SurveyPage', () => {
  it('renders the respondent view and submits selected scores once', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(view());
    const put = vi.spyOn(api, 'put').mockResolvedValue(view({ submitted: true }));

    renderAt();

    // Greeted by name, and the first survey section is shown.
    await screen.findByText(/Hi J\. Smith/);
    const firstGroup = surveyStructure('sponsor_competency').groups[0]!;
    expect(screen.getByText(firstGroup.title)).toBeInTheDocument();

    // Answer the first item with a score of 4, then submit.
    const firstItemKey = firstGroup.items[0]!.key;
    const radios = screen.getAllByRole('radio', { name: '4' });
    await userEvent.click(radios[0]!); // first item's "4"
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]![1]).toMatchObject({ [firstItemKey]: 4 });

    // Cache now says submitted -> confirmation replaces the form.
    await screen.findByText(/Your responses have been recorded/);
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('shows a read-only thank-you for an already-submitted survey (no form)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(view({ submitted: true }));
    renderAt();
    await screen.findByText(/Thank you, J\. Smith/);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows an invalid-link message when the token is not found', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(404, 'Survey not found'));
    renderAt('bogus');
    await screen.findByText(/isn.t valid/i);
  });
});
