/** Turns a finished set into a verdict, a spoken debrief and tips — no network needed. */
import type { SetResult } from '../core/analyzer';
import type { DebriefRequest } from '../shared/debrief';

export interface SetStory {
  /** Short verdict for the summary screen, e.g. "Great set!". */
  verdict: string;
  /** What the coach says out loud (2–3 sentences). */
  spoken: string;
  /** Up to three actionable tips, most important first. */
  tips: string[];
  cleanReps: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function cleanRepCount(r: SetResult): number {
  return r.reps.filter((rep) => rep.faults.length === 0).length;
}

export function describeSet(r: SetResult): SetStory {
  const tips = r.faults.slice(0, 3).map((f) => f.cue.tip);
  const clean = cleanRepCount(r);
  const top = r.faults[0];

  if (r.kind === 'hold') {
    const held = Math.round(r.holdMs / 1000);
    const good = r.holdMs > 0 ? Math.round((100 * r.goodHoldMs) / r.holdMs) : 0;
    if (held < 3) {
      return { verdict: 'No hold recorded', spoken: "I didn't catch a hold that time. Let's set up and try again.", tips, cleanReps: 0 };
    }
    const parts = [`You held it for ${plural(held, 'second')}, with solid form ${good}% of the time.`];
    if (top) parts.push(`Watch out for ${top.cue.title.toLowerCase()}: ${top.cue.tip}`);
    else parts.push('Your body line stayed straight the whole way. Excellent!');
    return { verdict: verdictFor(good, true), spoken: parts.join(' '), tips, cleanReps: 0 };
  }

  const n = r.reps.length;
  if (n === 0) {
    const spoken =
      r.partialReps.length > 0
        ? `None of those counted — ${top ? top.cue.tip.charAt(0).toLowerCase() + top.cue.tip.slice(1) : 'go through the full range of motion.'}`
        : "I didn't count any reps that time. Let's set up and go again.";
    return { verdict: 'No reps counted', spoken, tips, cleanReps: 0 };
  }

  const parts: string[] = [];
  const ofTarget = r.target && n < r.target ? ` of ${r.target}` : '';
  if (clean === n) parts.push(`${plural(n, 'rep')}${ofTarget}, and every one of them was clean.`);
  else parts.push(`${plural(n, 'rep')}${ofTarget}, ${clean === 0 ? 'none' : clean} ${clean === 1 ? 'was' : 'were'} clean.`);

  if (top && top.count > 0) {
    const where = top.count === 1 ? 'once' : `on ${plural(top.count, 'rep')}`;
    parts.push(`Main thing to work on: ${top.cue.title.toLowerCase()} ${where}. ${top.cue.tip}`);
  }
  if (r.partialReps.length > 0 && top?.cue.id !== r.partialReps[0].faults[0]?.id) {
    parts.push(`${plural(r.partialReps.length, 'rep')} didn't count.`);
  }
  if (r.formScore >= 90) parts.push('Excellent work!');
  else if (r.formScore >= 75) parts.push('Good job. Rest up and go again.');
  else parts.push("Take a breather, then let's go again and focus on that one thing.");

  return { verdict: verdictFor(r.formScore, clean === n), spoken: parts.join(' '), tips, cleanReps: clean };
}

function verdictFor(score: number, flawless: boolean): string {
  if (flawless && score >= 95) return 'Flawless set!';
  if (score >= 90) return 'Great set!';
  if (score >= 75) return 'Solid work';
  if (score >= 50) return 'Getting there';
  return "Let's clean that up";
}

export function toDebriefRequest(r: SetResult, previous: DebriefRequest['previous'] = []): DebriefRequest {
  const repSecs = r.reps.map((rep) => (rep.window.endT - rep.window.startT) / 1000);
  return {
    exercise: r.exerciseName,
    kind: r.kind,
    target: r.target,
    reps: r.reps.length,
    cleanReps: cleanRepCount(r),
    partialReps: r.partialReps.length,
    formScore: r.formScore,
    durationSec: Math.round(r.durationMs / 1000),
    holdSec: r.kind === 'hold' ? Math.round(r.holdMs / 1000) : undefined,
    goodFormSec: r.kind === 'hold' ? Math.round(r.goodHoldMs / 1000) : undefined,
    avgRepSec: repSecs.length ? repSecs.reduce((a, b) => a + b, 0) / repSecs.length : undefined,
    faults: r.faults.map((f) => ({ title: f.cue.title, count: f.count, severity: f.cue.severity, tip: f.cue.tip })),
    repScores: r.reps.map((rep) => rep.score),
    previous,
  };
}
