import { describe, expect, it } from 'vitest';
import { transferProgress } from './transfer.js';

describe('transferProgress', () => {
  it('is empty and not complete for no items', () => {
    expect(transferProgress([])).toEqual({ total: 0, transferred: 0, percentComplete: null, complete: false });
  });

  it('counts transferred items and rounds the percentage', () => {
    const p = transferProgress([{ done: true }, { done: false }, { done: true }]);
    expect(p).toEqual({ total: 3, transferred: 2, percentComplete: 67, complete: false });
  });

  it('is complete only when every item is transferred', () => {
    expect(transferProgress([{ done: true }, { done: true }]).complete).toBe(true);
    expect(transferProgress([{ done: true }, { done: false }]).complete).toBe(false);
  });
});
