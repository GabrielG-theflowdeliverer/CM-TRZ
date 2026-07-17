import { useEffect, useRef, useState } from 'react';

/**
 * Local-first editing for a text-ish field: keeps keystrokes in local state,
 * commits on blur (and on unmount) only when the value changed.
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
  const latest = useRef({ value, save });
  latest.current = { value, save };

  // Adopt server updates unless the user has unsaved local edits.
  useEffect(() => {
    if (!dirty.current) setValue(serverValue ?? '');
  }, [serverValue]);

  useEffect(
    () => () => {
      if (dirty.current) {
        latest.current.save(latest.current.value === '' ? null : latest.current.value);
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
      dirty.current = false;
      save(value === '' ? null : value);
    },
  };
}
