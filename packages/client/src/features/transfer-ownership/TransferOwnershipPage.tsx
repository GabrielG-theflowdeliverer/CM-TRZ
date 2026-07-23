import { useState } from 'react';
import { TRANSFER_RESPONSIBILITIES, transferProgress, type TransferItem } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { TextField } from '../../ui/controls';
import { useTransferItems, useTransferMutations } from './useTransferOwnership';

type Mutations = ReturnType<typeof useTransferMutations>;

export function TransferOwnershipPage() {
  const { projectId } = useProject();
  const { data: items } = useTransferItems(projectId);
  const m = useTransferMutations(projectId);
  const [responsibility, setResponsibility] = useState('');

  if (!items) return null;
  const progress = transferProgress(items);
  const used = new Set(items.map((i) => i.responsibility));
  const suggestions = TRANSFER_RESPONSIBILITIES.filter((r) => !used.has(r));

  const add = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) m.create.mutate({ responsibility: trimmed });
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Transfer of Ownership</h2>
        <p className="text-sm text-slate-500">
          Sustain the change (Phase 3): hand the ongoing sustainment responsibilities from the temporary project
          structure to the permanent business owners, so the future state holds as business-as-usual after the team
          rolls off. Confirm each responsibility once its new owner is equipped to carry it.
        </p>
      </div>

      <section className="cmt-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Handoff checklist</h3>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              <strong>{progress.transferred}</strong> of <strong>{progress.total}</strong> transferred
            </span>
            {progress.complete && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                Handoff complete
              </span>
            )}
          </span>
        </div>

        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="cmt-th w-10"></th>
                <th className="cmt-th text-left">Responsibility</th>
                <th className="cmt-th w-56">New owner</th>
                <th className="cmt-th w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TransferRow key={item.id} item={item} m={m} />
              ))}
            </tbody>
          </table>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(responsibility);
            setResponsibility('');
          }}
        >
          <input
            className="cmt-input flex-1"
            placeholder="Add a responsibility to transfer…"
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
          />
          <button type="submit" className="cmt-btn" disabled={!responsibility.trim() || m.create.isPending}>
            Add
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Suggested:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                onClick={() => add(s)}
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TransferRow({ item, m }: { item: TransferItem; m: Mutations }) {
  return (
    <tr className={item.done ? 'text-slate-400' : undefined}>
      <td className="cmt-td text-center">
        <input
          type="checkbox"
          aria-label={`Transferred: ${item.responsibility}`}
          checked={item.done}
          onChange={(e) => m.update.mutate({ id: item.id, fields: { done: e.target.checked } })}
        />
      </td>
      <td className={`cmt-td ${item.done ? 'line-through' : ''}`}>{item.responsibility}</td>
      <td className="cmt-td">
        <TextField
          value={item.newOwner}
          placeholder="Owner"
          onSave={(v) => m.update.mutate({ id: item.id, fields: { newOwner: v } })}
        />
      </td>
      <td className="cmt-td text-right">
        <button className="cmt-btn-danger" aria-label="Remove" onClick={() => m.remove.mutate(item.id)}>
          ✕
        </button>
      </td>
    </tr>
  );
}
