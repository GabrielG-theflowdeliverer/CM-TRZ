import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ShareApp } from './app/ShareApp';
import { createQueryClient } from './lib/queryClient';
import { setShareViewToken } from './lib/api';
import { Toaster } from './ui/Toaster';
import './index.css';

const queryClient = createQueryClient();

// Booting on /view/:token puts the whole SPA into view-only share mode: the
// token becomes the router basename (so regular pages' absolute links resolve
// inside the share view) and the api layer reroutes reads onto the token
// mirror and refuses writes. Determined once from the URL — never mid-session.
const shareMatch = /^\/view\/([^/]+)/.exec(window.location.pathname);
const shareToken = shareMatch?.[1] ?? null;
if (shareToken) setShareViewToken(shareToken);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {shareToken ? (
        <BrowserRouter basename={`/view/${shareToken}`}>
          <ShareApp token={shareToken} />
          <Toaster />
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);
