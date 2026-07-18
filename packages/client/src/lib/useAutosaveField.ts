import { useEffect, useRef, useState } from 'react';

/**
 * Local-first editing for a text-ish field: keeps keystrokes in local state,
 * commits on blur (and on unmount) only when the value changed.
 *
 * Resilience: after committing, the field stays "dirty" until the incoming
 * server value reflects what was saved. So a failed save does NOT clear the
 * edit — the value is preserved and re-committed on the next blur/unmount,
 * while the global mutation-error toast tells the user it didn't stick.
 */
export function useAutosaveField(
  serverValue: string | null | undefined,
  save: (value: string | null) => void,
): {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
} {
  const [value, setValue] = useState(serverValue ?? '');
  const dirty = useRef(false);
  // The value we last handed to save(); dirty clears once the server echoes it.
  const savedValue = useRef<string | null>(null);
  const latest = useRef({ value, save });
  latest.current = { value, save };

  useEffect(() => {
    if (!dirty.current) {
      // No local edits in flight — adopt the server value.
      setValue(serverValue ?? '');
    } else if ((serverValue ?? null) === savedValue.current) {
      // The server now reflects our save — it succeeded; sync and clear.
      dirty.current = false;
      setValue(serverValue ?? '');
    }
    // Otherwise a save is still pending (or failed): keep the local edit.
  }, [serverValue]);

  useEffect(
    () => () => {
      if (dirty.current) {
        const v = latest.current.value === '' ? null : latest.current.value;
        savedValue.current = v;
        latest.current.save(v);
      }
    },
    [],
  );

  return {
    value,
    onChange: (next) => {
      dirty.current = true;
      setValue(next);
    },
    onBlur: () => {
      if (!dirty.current) return;
      const v = value === '' ? null : value;
      savedValue.current = v;
      save(v); // stays dirty until the server echoes savedValue; toast surfaces failures
    },
  };
}
