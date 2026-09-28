import type { SetResult } from '../core/analyzer';
import type { ExerciseId } from '../core/exercise';
import { cleanRepCount } from '../coach/summary';
import type { DebriefRequest } from '../shared/debrief';

export interface HistoryEntry {
  id: string;
  exerciseId: ExerciseId;
  exerciseName: string;
  kind: 'reps' | 'hold';
  /** Epoch ms. */
  startedAt: number;
  durationSec: number;
  target: number | null;
  reps: number;
  cleanReps: number;
  partialReps: number;
  formScore: number;
  holdSec?: number;
  topFaults: { title: string; count: number }[];
  debrief?: string;
  demo?: boolean;
}

const KEY = 'track-ai:history:v1';
const MAX_ENTRIES = 300;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage unavailable — history is best-effort.
  }
}

export function entryFromResult(r: SetResult, demo: boolean): HistoryEntry {
  return {
    id: `${r.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    exerciseId: r.exerciseId,
    exerciseName: r.exerciseName,
    kind: r.kind,
    startedAt: r.startedAt,
    durationSec: Math.round(r.durationMs / 1000),
    target: r.target,
    reps: r.reps.length,
    cleanReps: cleanRepCount(r),
    partialReps: r.partialReps.length,
    formScore: r.formScore,
    holdSec: r.kind === 'hold' ? Math.round(r.holdMs / 1000) : undefined,
    topFaults: r.faults.slice(0, 3).map((f) => ({ title: f.cue.title, count: f.count })),
    demo: demo || undefined,
  };
}

export function addHistory(entry: HistoryEntry): void {
  save([entry, ...loadHistory().filter((e) => e.id !== entry.id)]);
}

export function updateHistory(id: string, patch: Partial<HistoryEntry>): void {
  save(loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function clearHistory(): void {
  save([]);
}

/** Recent real (non-demo) sets of an exercise, for the AI coach's "progress" remarks. */
export function previousSets(exerciseId: ExerciseId, beforeMs: number): NonNullable<DebriefRequest['previous']> {
  return loadHistory()
    .filter((e) => e.exerciseId === exerciseId && !e.demo && e.startedAt < beforeMs)
    .slice(0, 5)
    .map((e) => ({
      daysAgo: Math.max(0, Math.floor((beforeMs - e.startedAt) / 86_400_000)),
      reps: e.kind === 'hold' ? (e.holdSec ?? 0) : e.reps,
      formScore: e.formScore,
    }));
}
