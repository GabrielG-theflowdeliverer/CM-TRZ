import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandChip, BarrierBadge, HeatCell, RiskBadge, ScorePicker, adkarCellColor } from './scores';
import { TriangleChart } from './TriangleChart';

describe('BandChip', () => {
  it('maps scores to Excel bands at the boundaries', () => {
    const { rerender, container } = render(<BandChip label="S" score={25} />);
    expect(container.querySelector('.bg-green-600')).toBeInTheDocument();
    rerender(<BandChip label="S" score={24} />);
    expect(container.querySelector('.bg-amber-500')).toBeInTheDocument();
    rerender(<BandChip label="S" score={19} />);
    expect(container.querySelector('.bg-red-600')).toBeInTheDocument();
  });

  it('shows a dash for missing scores (partially answered aspect)', () => {
    render(<BandChip label="S" score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('ScorePicker', () => {
  it('renders exactly the allowed range', () => {
    render(<ScorePicker value={null} onChange={() => {}} min={1} max={3} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('selects a value on click and clears when clicked again', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ScorePicker value={null} onChange={onChange} min={1} max={5} />);
    await userEvent.click(screen.getByText('4'));
    expect(onChange).toHaveBeenLastCalledWith(4);
    rerender(<ScorePicker value={4} onChange={onChange} min={1} max={5} />);
    await userEvent.click(screen.getByText('4'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('badges and cells', () => {
  it('marks barrier points red and "No barrier" green', () => {
    const { rerender, container } = render(<BarrierBadge barrier="Desire" />);
    expect(container.querySelector('.bg-red-100')).toHaveTextContent('Desire');
    rerender(<BarrierBadge barrier="No barrier" />);
    expect(container.querySelector('.bg-green-100')).toHaveTextContent('No barrier');
  });

  it('colors risk quadrants', () => {
    const { rerender, container } = render(<RiskBadge quadrant="High" />);
    expect(container.querySelector('.bg-red-100')).toHaveTextContent('High risk');
    rerender(<RiskBadge quadrant={null} />);
    expect(screen.getByText('Not assessed')).toBeInTheDocument();
  });

  it('renders heat cells with one decimal for fractional values', () => {
    render(<HeatCell value={3.5} colorFor={adkarCellColor} />);
    expect(screen.getByText('3.5')).toBeInTheDocument();
  });
});

describe('TriangleChart', () => {
  it('shows all four aspects with band colors and dashes for missing', () => {
    const { container } = render(
      <TriangleChart
        scores={{ success: 30, leadership: 22, project_management: 12, change_management: null }}
      />,
    );
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    const circles = [...container.querySelectorAll('circle')].map((c) => c.getAttribute('fill'));
    expect(circles).toContain('#16a34a'); // strength
    expect(circles).toContain('#d97706'); // alert
    expect(circles).toContain('#dc2626'); // risk
    expect(circles).toContain('#94a3b8'); // missing
  });
});
