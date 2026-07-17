import { useAutosaveField } from '../lib/useAutosaveField';

export function TextField(props: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const field = useAutosaveField(props.value, props.onSave);
  return (
    <input
      className={props.className ?? 'cmt-input'}
      value={field.value}
      placeholder={props.placeholder}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
    />
  );
}

export function TextArea(props: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const field = useAutosaveField(props.value, props.onSave);
  return (
    <textarea
      className={props.className ?? 'cmt-input min-h-[3.5rem]'}
      rows={props.rows ?? 2}
      value={field.value}
      placeholder={props.placeholder}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
    />
  );
}

export function DateInput(props: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  className?: string;
}) {
  return (
    <input
      type="date"
      className={props.className ?? 'cmt-input'}
      value={props.value ?? ''}
      onChange={(e) => props.onSave(e.target.value === '' ? null : e.target.value)}
    />
  );
}

export function Select(props: {
  value: string | null | undefined;
  onSave: (value: string | null) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      className={props.className ?? 'cmt-input'}
      value={props.value ?? ''}
      onChange={(e) => props.onSave(e.target.value === '' ? null : e.target.value)}
    >
      <option value="">{props.placeholder ?? '—'}</option>
      {props.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function NumberField(props: {
  value: number | null | undefined;
  onSave: (value: number | null) => void;
  min?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={props.min}
      className={props.className ?? 'cmt-input'}
      value={props.value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        props.onSave(raw === '' ? null : Number(raw));
      }}
    />
  );
}
