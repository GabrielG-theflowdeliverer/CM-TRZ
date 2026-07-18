import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { createQueryClient } from '../lib/queryClient';
import { subscribeToasts } from '../lib/toast';

/**
 * Shared client-test harness. Renders under the *real* QueryClient
 * (`createQueryClient`), so tests exercise the production error→toast wiring
 * rather than a stand-in — the pattern every feature data-hook test builds on.
 */
export function renderWithClient(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  const client = createQueryClient();
  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
    ...options,
  });
  return { client, ...result };
}

/**
 * Records toast messages emitted from now on. Toasts live in a module-level
 * store outside React, so we observe them by subscribing rather than querying
 * the DOM. Call `stop()` when done to avoid leaking the listener across tests.
 */
export function captureToasts(): { messages: () => string[]; stop: () => void } {
  const seen: string[] = [];
  const stop = subscribeToasts((toasts) => {
    for (const t of toasts) if (!seen.includes(t.message)) seen.push(t.message);
  });
  return { messages: () => seen, stop };
}
