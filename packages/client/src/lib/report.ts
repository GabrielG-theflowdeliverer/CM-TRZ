/**
 * Send a client-side failure to the server so it lands in `fly logs` next to
 * the server's own lines, instead of vanishing with the 6-second toast.
 *
 * Uses `fetch` directly rather than the `api` helper on purpose: `api` rewrites
 * URLs in share mode, refuses non-GETs there, retries, and reports its own
 * failures — all of which would either misroute this or loop.
 */

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

export interface ClientErrorReport {
  kind: 'render' | 'request' | 'unhandled';
  message: string;
  stack?: string;
  route?: string;
  requestId?: string;
}

/**
 * Survey and share links carry an access token in the path, and this value
 * gets written to a log file. Replace the token segment rather than shipping
 * a live credential into the log — the same reason `Referrer-Policy` is
 * `no-referrer` server-side.
 */
export function safeRoute(pathname: string): string {
  return pathname.replace(/\/(s|view|survey|share)\/[^/]+/g, '/$1/[token]');
}

export function reportClientError(report: ClientErrorReport): void {
  try {
    const body = JSON.stringify({
      kind: report.kind,
      message: report.message.slice(0, MAX_MESSAGE),
      stack: report.stack?.slice(0, MAX_STACK),
      route: safeRoute(window.location.pathname).slice(0, 500),
      requestId: report.requestId,
    });
    // keepalive so a report survives the user navigating away from a broken page.
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Reporting is best-effort. If it fails there is nowhere left to say so.
    });
  } catch {
    // Never let the act of reporting an error throw a second one.
  }
}
