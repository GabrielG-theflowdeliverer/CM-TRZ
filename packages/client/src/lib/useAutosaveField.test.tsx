import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from '../ui/controls';

describe('TextField autosave', () => {
  it('commits on blur only when changed, converting empty to null', async () => {
    const onSave = vi.fn();
    render(
      <div>
        <TextField value="hello" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );
    const input = screen.getByDisplayValue('hello');

    // Blur without editing: no save.
    await userEvent.click(input);
    await userEvent.click(screen.getByText('elsewhere'));
    expect(onSave).not.toHaveBeenCalled();

    // Edit then blur: one save with the new value.
    await userEvent.clear(input);
    await userEvent.type(input, 'world');
    await userEvent.click(screen.getByText('elsewhere'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('world');

    // Clearing to empty commits null.
    await userEvent.clear(input);
    await userEvent.click(screen.getByText('elsewhere'));
    expect(onSave).toHaveBeenLastCalledWith(null);
  });
});
