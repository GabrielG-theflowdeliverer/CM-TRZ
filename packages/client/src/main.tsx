import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ApiError } from './lib/api';
import { pushToast } from './lib/toast';
import { Toaster } from './ui/Toaster';
import './index.css';

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}

// Surface every query/mutation failure to the user instead of swallowing it.
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => pushToast(`Couldn't load data: ${toMessage(error)}`),
  }),
  mutationCache: new MutationCache({
    onError: (error) => pushToast(`Save failed: ${toMessage(error)}`),
  }),
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
