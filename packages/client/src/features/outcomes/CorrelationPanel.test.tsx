import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ASPECT_KEYS } from '@cmt/domain';
import type { GroupDto } from '../../lib/types';
import type { MetricDto, ObjectiveDto } from './useOutcomes';
import { CorrelationPanel } from './CorrelationPanel';

const group = (id: string, name: string, adkar: Record<string, number>, barrier: string | null): GroupDto => ({
  id, projectId: 'p1', position: 0, name, numPeople: null,
  adoptionUsageDefinition: null, uniqueConsiderations: null, tags: [], orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar, adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: barrier, risk: null },
});

const adoptionMetric = (groupId: string, pct: number | null): MetricDto => ({
  id: `m-${groupId}`, projectId: 'p1', objectiveId: 'o1', kind: 'adoption', name: 'Utilization',
  unit: '%', baseline: 0, target: 100, direction: 'increase', adoptionMeasure: 'utilization', groupId, createdAt: 'x',
  measurements: [], computed: { current: pct, pct },
});

const objective = (metrics: MetricDto[]): ObjectiveDto => ({
  id: 'o1', projectId: 'p1', level: 'initiative', statement: 'Drive adoption', notes: null, createdAt: 'x',
  metrics, realization: null,
});

describe('CorrelationPanel', () => {
  it('plots one dot per group with adoption metrics and lists ADKAR vs adoption', () => {
    const groups = [
      group('g1', 'Sales', { awareness: 5, desire: 4, knowledge: 4, ability: 4, reinforcement: 3 }, null),
      group('g2', 'Ops', { awareness: 3, desire: 2, knowledge: 2, ability: 2, reinforcement: 2 }, 'Desire'),
      group('g3', 'Finance', { awareness: 4, desire: 4, knowledge: 4, ability: 4, reinforcement: 4 }, null), // no adoption metric
    ];
    const objectives = [objective([adoptionMetric('g1', 85), adoptionMetric('g2', 30)])];

    render(<CorrelationPanel objectives={objectives} groups={groups} />);

    expect(screen.getByText('Readiness vs adoption')).toBeInTheDocument();
    // Both groups with adoption metrics appear; Finance (no adoption) does not.
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Ops')).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
    // ADKAR averages: Sales (5+4+4+4+3)/5 = 4.0; Ops (3+2+2+2+2)/5 = 2.2.
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByText('2.2')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    // The directional-not-causal caption is present.
    expect(screen.getByText(/not proof of cause/i)).toBeInTheDocument();
  });

  it('nudges when no group has adoption metrics', () => {
    render(<CorrelationPanel objectives={[objective([])]} groups={[group('g1', 'Sales', {}, null)]} />);
    expect(screen.getByText(/Add adoption metrics scoped to impacted groups/i)).toBeInTheDocument();
  });
});
