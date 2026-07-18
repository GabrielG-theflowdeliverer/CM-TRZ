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

  it('preserves the edit and re-commits when the save does not stick (failure path)', async () => {
    // onSave that never causes the server value to change simulates a failed save.
    const onSave = vi.fn();
    render(
      <div>
        <TextField value="hello" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );
    const input = screen.getByDisplayValue('hello');

    await userEvent.clear(input);
    await userEvent.type(input, 'edited');
    await userEvent.click(screen.getByText('elsewhere'));
    expect(onSave).toHaveBeenCalledTimes(1);

    // The edit is NOT lost — it stays in the field because the server never echoed it.
    expect(screen.getByDisplayValue('edited')).toBeInTheDocument();

    // Blurring again re-commits the still-unsaved value (retry).
    await userEvent.click(input);
    await userEvent.click(screen.getByText('elsewhere'));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith('edited');
  });

  it('adopts the server value once it echoes the saved edit (success path)', async () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <div>
        <TextField value="hello" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );
    const input = screen.getByDisplayValue('hello');
    await userEvent.clear(input);
    await userEvent.type(input, 'saved');
    await userEvent.click(screen.getByText('elsewhere'));

    // Server confirms the save by returning the new value.
    rerender(
      <div>
        <TextField value="saved" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );

    // A later unrelated server update is now adopted (field is no longer dirty).
    rerender(
      <div>
        <TextField value="from server" onSave={onSave} />
        <button>elsewhere</button>
      </div>,
    );
    expect(screen.getByDisplayValue('from server')).toBeInTheDocument();
  });
});
