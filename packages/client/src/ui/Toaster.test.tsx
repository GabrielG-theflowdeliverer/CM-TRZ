import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toaster } from './Toaster';
import { dismissToast, pushToast, subscribeToasts } from '../lib/toast';

// The toast store is module-level and auto-dismisses on a 6s timer; fake timers
// let us drive that deterministically and flush any leftovers between tests.
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => vi.runOnlyPendingTimers());
  vi.useRealTimers();
});

describe('Toaster', () => {
  it('renders nothing until a toast is pushed', () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  it('surfaces a pushed message as an alert', () => {
    render(<Toaster />);
    act(() => pushToast('Saved', 'info'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Saved');
    expect(alert.className).not.toContain('bg-red-600');
  });

  it('styles error toasts distinctly', () => {
    render(<Toaster />);
    act(() => pushToast('Could not save', 'error'));
    expect(screen.getByRole('alert').className).toContain('bg-red-600');
  });

  it('lets the user dismiss a toast', () => {
    render(<Toaster />);
    act(() => pushToast('Dismiss me', 'info'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 6 seconds so nothing lingers', () => {
    render(<Toaster />);
    act(() => pushToast('Temporary', 'info'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('toast store', () => {
  it('stops notifying a listener after it unsubscribes', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.length));
    act(() => pushToast('one', 'info'));
    const countWhileSubscribed = seen.length;
    unsubscribe();
    act(() => pushToast('two', 'info'));
    expect(seen.length).toBe(countWhileSubscribed); // no further notifications
    // clean up the two toasts we pushed
    act(() => vi.runOnlyPendingTimers());
    dismissToast(-1); // no-op on unknown id, exercises the filter path
  });
});
