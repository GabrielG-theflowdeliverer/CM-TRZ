import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ADKAR_ELEMENTS,
  ADKAR_STATEMENTS,
  PCT_FACTORS,
  RISK_FACTORS,
  SPONSOR_COMPETENCY_SECTIONS,
  adkarItemKey,
  competencyItemKey,
  pctItemKey,
  riskItemKey,
} from '@cmt/domain';
import type { AssessmentDto, AssessmentComputed } from '../../lib/types';
import { PctEditor } from './PctEditor';
import { RiskEditor } from './RiskEditor';
import { AdkarEditor } from './AdkarEditor';
import { CompetencyEditor } from './CompetencyEditor';

function run(
  type: AssessmentDto['type'],
  computed: AssessmentComputed,
  responses: Record<string, number | null> = {},
): AssessmentDto {
  return {
    id: 'a1',
    projectId: 'p1',
    type,
    subjectKind: 'project',
    subjectId: null,
    label: null,
    scheduledDate: null,
    completedDate: null,
    status: null,
    notes: null,
    createdAt: 'x',
    responses,
    computed,
  };
}

describe('PctEditor', () => {
  const pct = { success: null, leadership: null, project_management: null, change_management: null };

  it('renders every factor and scores a factor through onScore', async () => {
    const onScore = vi.fn();
    render(<PctEditor run={run('pct', { pct })} onScore={onScore} />);

    expect(screen.getByText(PCT_FACTORS.success[0]!)).toBeInTheDocument();
    // First factor's "3" button -> onScore(pct.success.1, 3).
    await userEvent.click(screen.getAllByRole('radio', { name: '3' })[0]!);
    expect(onScore).toHaveBeenCalledWith(pctItemKey('success', 0), 3);
  });

  it('shows the "answered n/10" hint while an aspect is partially scored', () => {
    const responses = { [pctItemKey('success', 0)]: 2 };
    render(<PctEditor run={run('pct', { pct }, responses)} onScore={vi.fn()} />);
    expect(screen.getByText(/1\/10 answered/)).toBeInTheDocument();
  });
});

describe('RiskEditor', () => {
  it('renders both sections and prompts to complete the quadrant when unscored', () => {
    render(<RiskEditor run={run('risk', { risk: { cc: null, oa: null, quadrant: null } })} onScore={vi.fn()} />);
    expect(screen.getByText(RISK_FACTORS.cc[0]!.factor)).toBeInTheDocument();
    expect(screen.getByText(/answer all 14 factors/i)).toBeInTheDocument();
  });

  it('scores a change-characteristics factor (1–5)', async () => {
    const onScore = vi.fn();
    render(<RiskEditor run={run('risk', { risk: { cc: null, oa: null, quadrant: null } })} onScore={onScore} />);
    await userEvent.click(screen.getAllByRole('radio', { name: '5' })[0]!);
    expect(onScore).toHaveBeenCalledWith(riskItemKey('cc', 0), 5);
  });
});

describe('AdkarEditor', () => {
  it('renders each ADKAR statement and scores one', async () => {
    const onScore = vi.fn();
    render(
      <AdkarEditor
        run={run('adkar', { adkar: { scores: {}, barrierPoint: 'Desire' } })}
        onScore={onScore}
      />,
    );
    expect(screen.getByText(ADKAR_STATEMENTS[ADKAR_ELEMENTS[0]!])).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('radio', { name: '4' })[0]!);
    expect(onScore).toHaveBeenCalledWith(adkarItemKey(ADKAR_ELEMENTS[0]!), 4);
  });
});

describe('CompetencyEditor', () => {
  it('renders sponsor sections with the running total and scores an item', async () => {
    const onScore = vi.fn();
    render(
      <CompetencyEditor
        run={run('sponsor_competency', { competency: { total: 42, interpretation: 'Good' } })}
        onScore={onScore}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(SPONSOR_COMPETENCY_SECTIONS[0]!.items[0]!)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('radio', { name: '5' })[0]!);
    expect(onScore).toHaveBeenCalledWith(competencyItemKey('sponsor', SPONSOR_COMPETENCY_SECTIONS[0]!.key, 0), 5);
  });
});
