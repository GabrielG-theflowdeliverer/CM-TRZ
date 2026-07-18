/** Shared header for methodology doc pages with a Mark Complete toggle. */
export function DocHeader(props: {
  title: string;
  subtitle: string;
  complete: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{props.title}</h2>
        <p className="text-sm text-slate-500">{props.subtitle}</p>
      </div>
      <button className={props.complete ? 'cmt-btn' : 'cmt-btn-secondary'} onClick={props.onToggle}>
        {props.complete ? '✓ Completed' : 'Mark Complete'}
      </button>
    </div>
  );
}
