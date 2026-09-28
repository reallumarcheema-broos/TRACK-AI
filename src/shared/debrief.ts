/**
 * Contract between the app and the optional AI debrief endpoint (`POST /api/debrief`).
 * Shared by the browser and the Node server, so it must stay free of DOM/Node APIs.
 */

export interface DebriefFault {
  title: string;
  /** Reps affected (or times it happened during a hold). */
  count: number;
  severity: 'minor' | 'major';
  tip: string;
}

export interface DebriefRequest {
  exercise: string;
  kind: 'reps' | 'hold';
  /** Target reps (or seconds for holds); null when open-ended. */
  target: number | null;
  reps: number;
  cleanReps: number;
  partialReps: number;
  /** 0..100 */
  formScore: number;
  durationSec: number;
  holdSec?: number;
  goodFormSec?: number;
  /** Average seconds per rep. */
  avgRepSec?: number;
  faults: DebriefFault[];
  /** Form score of each counted rep, in order. */
  repScores: number[];
  /** Previous sets of the same exercise, most recent first. */
  previous?: { daysAgo: number; reps: number; formScore: number }[];
}

export interface DebriefResponse {
  text: string;
  source: 'claude' | 'local';
}

export const DEBRIEF_LIMITS = {
  maxFaults: 8,
  maxRepScores: 200,
  maxPrevious: 5,
  maxString: 160,
  maxBodyBytes: 16_000,
} as const;

const isNum = (v: unknown, lo = 0, hi = 1e6): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v: unknown): string => (typeof v === 'string' ? v.slice(0, DEBRIEF_LIMITS.maxString) : '');

/**
 * Validates and normalises an untrusted request body. Returns null when it isn't a
 * plausible debrief request. Strings are length-capped; unknown fields are dropped.
 */
export function parseDebriefRequest(body: unknown): DebriefRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.exercise !== 'string' || !b.exercise.trim()) return null;
  if (b.kind !== 'reps' && b.kind !== 'hold') return null;
  if (!isNum(b.reps, 0, 10000) || !isNum(b.formScore, 0, 100) || !isNum(b.durationSec, 0, 86400)) return null;
  const faults = Array.isArray(b.faults) ? b.faults : [];
  const repScores = Array.isArray(b.repScores) ? b.repScores : [];
  const previous = Array.isArray(b.previous) ? b.previous : [];
  return {
    exercise: str(b.exercise),
    kind: b.kind,
    target: isNum(b.target, 1, 10000) ? Math.round(b.target) : null,
    reps: Math.round(b.reps),
    cleanReps: isNum(b.cleanReps, 0, 10000) ? Math.round(b.cleanReps) : 0,
    partialReps: isNum(b.partialReps, 0, 10000) ? Math.round(b.partialReps) : 0,
    formScore: Math.round(b.formScore),
    durationSec: Math.round(b.durationSec),
    holdSec: isNum(b.holdSec, 0, 86400) ? Math.round(b.holdSec) : undefined,
    goodFormSec: isNum(b.goodFormSec, 0, 86400) ? Math.round(b.goodFormSec) : undefined,
    avgRepSec: isNum(b.avgRepSec, 0, 600) ? Math.round(b.avgRepSec * 10) / 10 : undefined,
    faults: faults.slice(0, DEBRIEF_LIMITS.maxFaults).flatMap((f): DebriefFault[] => {
      if (!f || typeof f !== 'object') return [];
      const x = f as Record<string, unknown>;
      if (typeof x.title !== 'string' || !isNum(x.count, 0, 10000)) return [];
      return [{ title: str(x.title), count: Math.round(x.count), severity: x.severity === 'major' ? 'major' : 'minor', tip: str(x.tip) }];
    }),
    repScores: repScores.slice(0, DEBRIEF_LIMITS.maxRepScores).filter((s): s is number => isNum(s, 0, 100)),
    previous: previous.slice(0, DEBRIEF_LIMITS.maxPrevious).flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const x = p as Record<string, unknown>;
      if (!isNum(x.daysAgo, 0, 3650) || !isNum(x.reps, 0, 10000) || !isNum(x.formScore, 0, 100)) return [];
      return [{ daysAgo: Math.round(x.daysAgo), reps: Math.round(x.reps), formScore: Math.round(x.formScore) }];
    }),
  };
}
