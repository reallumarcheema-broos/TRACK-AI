import type { DebriefRequest, DebriefResponse } from '../shared/debrief';

/** Base URL of the debrief API. Same origin by default; override with VITE_COACH_API_URL. */
const API_BASE = (import.meta.env.VITE_COACH_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Builds for hosts without the TRACK AI server (GitHub Pages) set VITE_AI_DEBRIEF=off: the option
 * is hidden and every set gets the on-device summary straight away.
 */
export const AI_DEBRIEF_ENABLED = import.meta.env.VITE_AI_DEBRIEF !== 'off';

let available: Promise<boolean> | null = null;

/** Whether a server with AI debriefs is reachable (checked once per session). */
export function aiDebriefAvailable(): Promise<boolean> {
  if (!AI_DEBRIEF_ENABLED) return Promise.resolve(false);
  available ??= fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(4000) })
    .then(async (res) => res.ok && (await res.json()).ai === true)
    .catch(() => false);
  return available;
}

/**
 * Asks the server for an AI-written debrief of the set. Resolves to null when the endpoint
 * isn't deployed, has no API key configured, or is too slow — callers fall back to the
 * locally generated summary.
 */
export async function fetchDebrief(req: DebriefRequest, timeoutMs = 14000): Promise<DebriefResponse | null> {
  if (!(await aiDebriefAvailable())) return null;
  try {
    const res = await fetch(`${API_BASE}/api/debrief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DebriefResponse>;
    if (typeof data.text !== 'string' || !data.text.trim()) return null;
    return { text: data.text.trim(), source: data.source === 'claude' ? 'claude' : 'local' };
  } catch {
    return null;
  }
}
