import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../exercises';
import { simulate } from '../sim/simulator';
import { runSet } from '../testing/runSet';
import { summarizeSet, WorkoutAnalyzer, type AnalyzerEvent } from './analyzer';

const types = (events: { e: AnalyzerEvent }[]) => events.map(({ e }) => e.type);

describe('WorkoutAnalyzer setup flow', () => {
  it('asks the athlete to step in, then calibrates and starts', () => {
    const out = runSet({ exercise: 'squat', absentSeconds: 1, reps: 2 });
    const statuses = out.events.flatMap(({ e }) => (e.type === 'status' ? [`${e.status}:${e.hint ?? ''}`] : []));
    expect(statuses[0]).toMatch(/^searching:.*step into the frame/i);
    expect(statuses).toContain('calibrating:Hold it…');
    expect(types(out.events).filter((t) => t === 'ready')).toHaveLength(1);
    expect(out.analyzer.reps).toHaveLength(2);
  });

  it('asks the athlete to turn when the camera angle is wrong', () => {
    // Push-ups need a side view; facing the camera shouldn't start the set.
    const out = runSet({ exercise: 'pushup', yaw: 0, reps: 1 });
    expect(out.analyzer.status).not.toBe('active');
    const hints = out.events.flatMap(({ e }) => (e.type === 'status' && e.hint ? [e.hint] : []));
    expect(hints).toContain('Turn sideways to the camera');
  });

  it('does not count reps done before the athlete is ready', () => {
    // No lead-in: the athlete starts squatting immediately and never holds still.
    const out = runSet({ exercise: 'squat', leadInSeconds: 0, restSeconds: 0, reps: 3 });
    // The first rep starts before calibration completes.
    expect(out.analyzer.reps.length).toBeLessThan(3);
  });

  it('announces when tracking is lost and found mid-set', () => {
    const def = EXERCISE_BY_ID.squat;
    const a = new WorkoutAnalyzer(def);
    const frames = simulate({ exercise: 'squat', reps: 2 });
    const all: AnalyzerEvent[] = [];
    let t = 0;
    for (const fr of frames) {
      t = fr.t;
      all.push(...a.process(fr.pose, fr.t, fr.aspect).events);
    }
    for (let i = 1; i <= 60; i++) all.push(...a.process(null, t + i * 33, frames[0].aspect).events);
    const back = simulate({ exercise: 'squat', reps: 1 });
    for (const fr of back) all.push(...a.process(fr.pose, t + 3000 + fr.t, fr.aspect).events);
    const kinds = all.map((e) => e.type);
    expect(kinds).toContain('lost');
    expect(kinds.indexOf('found')).toBeGreaterThan(kinds.indexOf('lost'));
    expect(a.reps).toHaveLength(3);
  });

  it('emits idle reminders after the first rep', () => {
    const out = runSet({ exercise: 'squat', reps: 1, tailSeconds: 21 });
    const idle = out.events.filter(({ e }) => e.type === 'idle');
    expect(idle.length).toBe(2);
  });
});

describe('false positives', () => {
  // Clean sets with heavier landmark noise must produce exact counts and no faults.
  const cases = EXERCISES.filter((e) => e.kind === 'reps').flatMap((e) => [4, 5, 6].map((seed) => [e.id, seed] as const));
  it.each(cases)('%s (seed %i) — clean reps stay clean', (id, seed) => {
    const out = runSet({ exercise: id, reps: 5, seed, noise: 0.005 });
    expect(out.analyzer.reps).toHaveLength(5);
    expect(out.repFaults.flat()).toEqual([]);
    expect(out.analyzer.partialReps).toHaveLength(0);
  });

  it('clean plank has no faults', () => {
    const out = runSet({ exercise: 'plank', holdSeconds: 20, seed: 9, noise: 0.005 });
    expect(out.analyzer.holdFaults.size).toBe(0);
    expect(out.analyzer.goodHoldMs).toBeCloseTo(out.analyzer.holdMs, -2);
  });
});

describe('summarizeSet', () => {
  it('ranks faults and computes a form score', () => {
    const out = runSet({
      exercise: 'squat',
      reps: [{}, { faults: { heelLift: 24 } }, { faults: { heelLift: 24 } }, { depth: 0.42 }, { faults: { lean: 32 } }, {}],
    });
    const summary = summarizeSet(out.analyzer, { startedAt: 0, endT: 30000, target: 5 });
    expect(summary.reps).toHaveLength(5);
    expect(summary.partialReps).toHaveLength(1);
    expect(summary.faults[0]).toMatchObject({ cue: { id: 'heels_rising' }, count: 2 });
    expect(summary.faults.map((f) => f.cue.id)).toEqual(expect.arrayContaining(['squat_shallow', 'chest_forward']));
    // 2 clean (100) + 3 reps with one minor fault (85) → 91.
    expect(summary.formScore).toBe(91);
  });
});
