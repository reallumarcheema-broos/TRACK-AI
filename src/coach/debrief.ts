import type { DebriefRequest, DebriefResponse } from '../shared/debrief';

/** Base URL of the debrief API. Same origin by default; override with VITE_COACH_API_URL. */
const API_BASE = (import.meta.env.VITE_COACH_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Asks the server for an AI-written debrief of the set. Resolves to null when the endpoint
 * isn't deployed, has no API key configured, or is too slow — callers fall back to the
 * locally generated summary.
 */
export async function fetchDebrief(req: DebriefRequest, timeoutMs = 9000): Promise<DebriefResponse | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/debrief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DebriefResponse>;
    if (typeof data.text !== 'string' || !data.text.trim()) return null;
    return { text: data.text.trim(), source: data.source === 'claude' ? 'claude' : 'local' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
