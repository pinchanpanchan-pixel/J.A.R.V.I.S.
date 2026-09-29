/** fetch con timeout (AbortController). */
export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export const NOMINATIM_UA = "JARVIS-PWA/1.0 (+https://github.com/pinchanpanchan-pixel/J.A.R.V.I.S.)";
