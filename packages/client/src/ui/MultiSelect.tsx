export interface MultiSelectOption {
  value: string;
  label: string;
}

/** Compact multi-select rendered as a details-popover with checkboxes. */
export function MultiSelect(props: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
}) {
  const labels = props.options.filter((o) => props.selected.includes(o.value)).map((o) => o.label);
  return (
    <details className="relative">
      <summary className="cmt-input cursor-pointer list-none truncate" title={labels.join(', ')}>
        {labels.length ? labels.join(', ') : <span className="text-slate-400">{props.placeholder ?? 'Select…'}</span>}
      </summary>
      <div className="absolute z-10 mt-1 max-h-52 w-64 overflow-auto rounded border border-slate-200 bg-white p-2 shadow-lg">
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
    </details>
  );
}
