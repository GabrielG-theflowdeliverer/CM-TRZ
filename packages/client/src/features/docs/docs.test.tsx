import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFINE_SUCCESS_PROMPTS, RESOURCES_PROMPTS, WHY_CM_PROMPTS } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient, captureToasts } from '../../test/harness';
import { DefineSuccessPage } from './DefineSuccessPage';
import { WhyCmPage } from './WhyCmPage';
import { ResourcesPage } from './ResourcesPage';

/**
 * The four methodology doc pages are thin views over `useDoc`: prompts come
 * from the verbatim Prosci content in domain, every field autosaves on blur,
 * and a Mark Complete toggle rides on the same `_status` field. These cover
 * that wiring — particularly that a blurred edit actually reaches the server,
 * which is the client's design-for-failure promise.
 */

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach: null,
  status: 'Active',
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
};

function mockDoc(docKey: string, doc: Record<string, string | null>) {
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url === '/api/projects/p1') return Promise.resolve(project);
    if (url === `/api/projects/p1/docs/${docKey}`) return Promise.resolve(doc);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderDoc(path: string, element: React.ReactNode) {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/projects/p1/${path}`]}>
      <Routes>
        <Route path={`/projects/:projectId/${path}`} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DefineSuccessPage', () => {
  it('renders the 4 Ps prompts and the stored answers', async () => {
    mockDoc('define_success', { project: 'CRM rollout', purpose: null, adoption_percentage: '80' });
    renderDoc('define-success', <DefineSuccessPage />);

    await screen.findByText(DEFINE_SUCCESS_PROMPTS.project);
    expect(screen.getByText(DEFINE_SUCCESS_PROMPTS.purpose)).toBeInTheDocument();
    expect(screen.getByText(DEFINE_SUCCESS_PROMPTS.keyQuestion)).toBeInTheDocument();
    expect(screen.getByDisplayValue('CRM rollout')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
  });

  it('saves only the field that changed, on blur', async () => {
    mockDoc('define_success', { project: null, purpose: null });
    const put = vi.spyOn(api, 'put').mockResolvedValue({ project: 'New system' });
    renderDoc('define-success', <DefineSuccessPage />);

    await screen.findByText(DEFINE_SUCCESS_PROMPTS.project);
    const boxes = screen.getAllByRole('textbox');
    await userEvent.type(boxes[0]!, 'New system');
    // Nothing is sent while typing — the field commits on blur.
    expect(put).not.toHaveBeenCalled();
    await userEvent.tab();

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/projects/p1/docs/define_success', { project: 'New system' }),
    );
  });

  it('surfaces a failed save to the user instead of dropping it', async () => {
    mockDoc('define_success', { project: null });
    vi.spyOn(api, 'put').mockRejectedValue(new Error('offline'));
    const toasts = captureToasts();
    renderDoc('define-success', <DefineSuccessPage />);

    await screen.findByText(DEFINE_SUCCESS_PROMPTS.project);
    await userEvent.type(screen.getAllByRole('textbox')[0]!, 'Typed but not saved');
    await userEvent.tab();

    await waitFor(() => expect(toasts.messages().join(' ')).toMatch(/Save failed/i));
    // The edit stays on screen — a failed save must not silently discard it.
    expect(screen.getByDisplayValue('Typed but not saved')).toBeInTheDocument();
    toasts.stop();
  });
});

describe('WhyCmPage', () => {
  it('renders the human-factors and cost/risk prompts verbatim', async () => {
    mockDoc('why_cm', { speed_of_adoption: 'Measured weekly' });
    renderDoc('why-cm', <WhyCmPage />);

    await screen.findByText(WHY_CM_PROMPTS.humanFactorsTitle);
    expect(screen.getByText(WHY_CM_PROMPTS.title)).toBeInTheDocument();
    expect(screen.getByText(WHY_CM_PROMPTS.speedOfAdoption)).toBeInTheDocument();
    expect(screen.getByText(WHY_CM_PROMPTS.costsAndRisksTitle)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Measured weekly')).toBeInTheDocument();
    // Four cost/risk rows, each with a cost and a risk box.
    for (const row of WHY_CM_PROMPTS.costRiskRows) expect(screen.getByText(row)).toBeInTheDocument();
  });

  it('saves a cost/risk cell against its own field key', async () => {
    mockDoc('why_cm', {});
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    renderDoc('why-cm', <WhyCmPage />);

    await screen.findByText(WHY_CM_PROMPTS.costsAndRisksTitle);
    const risk = screen.getByRole('row', { name: new RegExp(WHY_CM_PROMPTS.costRiskRows[0]!, 'i') });
    const boxes = within(risk).getAllByRole('textbox');
    await userEvent.type(boxes[1]!, 'Attrition');
    await userEvent.tab();

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/projects/p1/docs/why_cm', { risk_individuals: 'Attrition' }),
    );
  });
});

describe('ResourcesPage / DocHeader', () => {
  it('renders governance and budget prompts', async () => {
    mockDoc('resources', { governance_description: 'Steering committee' });
    renderDoc('resources', <ResourcesPage />);

    await screen.findByText(RESOURCES_PROMPTS.governanceTitle);
    expect(screen.getByText(RESOURCES_PROMPTS.budgetTitle)).toBeInTheDocument();
    expect(screen.getByText(RESOURCES_PROMPTS.sponsorAccess)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Steering committee')).toBeInTheDocument();
  });

  it('marks the doc complete and back again through the same _status field', async () => {
    mockDoc('resources', { _status: null });
    const put = vi.spyOn(api, 'put').mockResolvedValue({ _status: 'Completed' });
    renderDoc('resources', <ResourcesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/projects/p1/docs/resources', { _status: 'Completed' }),
    );

    // The mutation writes the response straight into the cache, so the button
    // flips without a refetch — and toggles back to null when clicked again.
    const done = await screen.findByRole('button', { name: '✓ Completed' });
    await userEvent.click(done);
    await waitFor(() => expect(put).toHaveBeenLastCalledWith('/api/projects/p1/docs/resources', { _status: null }));
  });

  it('renders nothing until the doc has loaded', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}) as never);
    const { container } = renderDoc('resources', <ResourcesPage />);
    expect(container).toBeEmptyDOMElement();
  });
});
