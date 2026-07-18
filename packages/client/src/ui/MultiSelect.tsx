import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

/** Compact multi-select popover with checkboxes; closes on outside click / Escape. */
export function MultiSelect(props: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const labels = props.options.filter((o) => props.selected.includes(o.value)).map((o) => o.label);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="cmt-input cursor-pointer truncate text-left"
        title={labels.join(', ')}
        onClick={() => setOpen((v) => !v)}
      >
        {labels.length ? labels.join(', ') : <span className="text-slate-400">{props.placeholder ?? 'Select…'}</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-52 w-64 overflow-auto rounded border border-slate-200 bg-white p-2 shadow-lg">
          {props.options.length === 0 && <p className="text-xs text-slate-400">{props.emptyHint ?? 'No options.'}</p>}
          {props.options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 py-0.5 text-sm">
              <input
                type="checkbox"
                checked={props.selected.includes(option.value)}
                onChange={(e) =>
                  props.onChange(
                    e.target.checked
                      ? [...props.selected, option.value]
                      : props.selected.filter((v) => v !== option.value),
                  )
                }
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
