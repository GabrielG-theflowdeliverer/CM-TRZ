import { useEffect, useState } from 'react';
import { dismissToast, subscribeToasts, type Toast } from '../lib/toast';

/** Renders the global toast stack (bottom-right). Mount once at the app root. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ${
            toast.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            className="shrink-0 text-white/80 hover:text-white"
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
