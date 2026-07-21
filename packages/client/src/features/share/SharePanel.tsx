import { useState } from 'react';
import { useDisableShare, useEnableShare, useShareState } from './useShare';

/**
 * Practitioner controls for view-only sharing: turn it on to get a link any
 * stakeholder can open (see everything, touch nothing), rotate it to cut off
 * everyone holding the old link, or turn it off entirely.
 */
export function SharePanel({ projectId }: { projectId: string }) {
  const { data: state } = useShareState(projectId);
  const enable = useEnableShare(projectId);
  const disable = useDisableShare(projectId);
  const [copied, setCopied] = useState(false);

  const link = state?.token ? `${window.location.origin}/view/${state.token}` : null;

  return (
    <div className="cmt-card space-y-3">
      <div>
        <h3 className="font-semibold">View-only sharing</h3>
        <p className="text-sm text-slate-500">
          Give stakeholders a link to this project’s dashboard. They can see everything and change nothing.
        </p>
      </div>

      {link ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input className="cmt-input flex-1 text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="cmt-btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  },
                  () => {
                    /* clipboard blocked — the link remains selectable in the field */
                  },
                );
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="cmt-btn-secondary"
              disabled={enable.isPending}
              onClick={() => {
                // Rotation kills every previously sent link — make that explicit.
                if (window.confirm('Generate a new link? Everyone holding the current link loses access.')) {
                  enable.mutate();
                }
              }}
            >
              Rotate link
            </button>
            <button
              type="button"
              className="cmt-btn-secondary"
              disabled={disable.isPending}
              onClick={() => {
                if (window.confirm('Turn off sharing? The link stops working for everyone.')) {
                  disable.mutate();
                }
              }}
            >
              Turn off sharing
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="cmt-btn" disabled={enable.isPending} onClick={() => enable.mutate()}>
          {enable.isPending ? 'Enabling…' : 'Enable view-only link'}
        </button>
      )}
    </div>
  );
}
