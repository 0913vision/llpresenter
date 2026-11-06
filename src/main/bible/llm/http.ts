export const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080';

/** The timeout covers both the response headers and the JSON body. */
export async function fetchJson({
  url,
  init,
  timeoutMs,
  signal,
}: {
  readonly url: string;
  readonly init: RequestInit;
  readonly timeoutMs: number;
  readonly signal: AbortSignal | undefined;
}): Promise<unknown> {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1') {
    throw new Error('Local LLM requests require IPv4 loopback HTTP');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
