export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

type Listener = (toasts: Toast[]) => void;

/**
 * Tiny module-level toast store. Lives outside React so TanStack Query's
 * MutationCache/QueryCache onError callbacks (which run outside the tree) can
 * surface failures without prop-drilling.
 */
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

export function pushToast(message: string, kind: Toast['kind'] = 'error'): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => dismissToast(id), 6000);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}
