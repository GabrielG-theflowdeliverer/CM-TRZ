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

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
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
