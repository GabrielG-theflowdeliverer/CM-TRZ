export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Requests that hang longer than this are aborted so the UI can recover. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * View-only share mode. When the SPA boots on /view/:token (see main.tsx), all
 * feature code runs unchanged while every request is rerouted onto the
 * token-scoped read-only mirror (/api/X -> /api/share/:token/X) and writes are
 * refused before they leave the client (the server 403s them anyway — this
 * just fails fast). Module-level because it's a whole-app mode fixed at boot
 * from the URL, never toggled mid-session.
 */
let shareViewToken: string | null = null;

export function setShareViewToken(token: string | null): void {
  shareViewToken = token;
}

export function isShareView(): boolean {
  return shareViewToken !== null;
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (shareViewToken !== null) {
    if (method !== 'GET') throw new ApiError(403, 'This link is view-only');
    url = `/api/share/${shareViewToken}${url.slice('/api'.length)}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // Abort (timeout) and network failures land here — normalise to ApiError.
    if (controller.signal.aborted) throw new ApiError(0, `Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`);
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => req<T>('GET', url),
  post: <T>(url: string, body?: unknown) => req<T>('POST', url, body),
  patch: <T>(url: string, body: unknown) => req<T>('PATCH', url, body),
  put: <T>(url: string, body: unknown) => req<T>('PUT', url, body),
  del: <T = void>(url: string) => req<T>('DELETE', url),
};
