import { describe, expect, it } from 'vitest';
import { summarizeSet } from '../core/analyzer';
import { parseDebriefRequest } from '../shared/debrief';
import { runSet } from '../testing/runSet';
import { describeSet, toDebriefRequest } from './summary';

describe('describeSet', () => {
  it('leads with the rep count and names the main fault with a tip', () => {
    const out = runSet({ exercise: 'squat', reps: [{}, { faults: { heelLift: 24 } }, { faults: { heelLift: 24 } }, {}, {}] });
    const story = describeSet(summarizeSet(out.analyzer, { startedAt: 0, endT: 20000, target: 5 }));
    expect(story.spoken).toMatch(/^5 reps, 3 were clean\./);
    expect(story.spoken).toMatch(/main thing to fix: heels lifting — flagged on 2 reps\./i);
    expect(story.tips[0]).toMatch(/heels/i);
    expect(story.cleanReps).toBe(3);
  });

  it('celebrates a flawless set', () => {
    const out = runSet({ exercise: 'pushup', reps: 4 });
    const story = describeSet(summarizeSet(out.analyzer, { startedAt: 0, endT: 15000, target: 4 }));
    expect(story.verdict).toBe('Flawless set!');
    expect(story.spoken).toMatch(/every one of them was clean/);
  });

  it('mentions reps short of the target', () => {
    const out = runSet({ exercise: 'squat', reps: 3 });
    const story = describeSet(summarizeSet(out.analyzer, { startedAt: 0, endT: 15000, target: 10 }));
    expect(story.spoken).toMatch(/^3 reps of 10/);
  });

  it('summarises a plank hold', () => {
    const out = runSet({ exercise: 'plank', holdSeconds: 20, holdFaults: [{ from: 5, to: 9, faults: { sag: 0.1 } }] });
    const story = describeSet(summarizeSet(out.analyzer, { startedAt: 0, endT: 25000, target: 20 }));
    expect(story.spoken).toMatch(/held it for 2\d seconds/);
    expect(story.spoken).toMatch(/hips sagging/i);
  });

  it('handles a set with no counted reps', () => {
    const out = runSet({ exercise: 'squat', reps: [{ depth: 0.42 }, { depth: 0.42 }] });
    const story = describeSet(summarizeSet(out.analyzer, { startedAt: 0, endT: 10000, target: 5 }));
    expect(story.verdict).toBe('No reps counted');
    expect(story.spoken).toMatch(/none of those counted/i);
  });
});

describe('debrief request', () => {
  it('round-trips through validation', () => {
    const out = runSet({ exercise: 'squat', reps: [{}, { faults: { heelLift: 24 } }, {}] });
    const req = toDebriefRequest(summarizeSet(out.analyzer, { startedAt: 0, endT: 12000, target: 3 }), [
      { daysAgo: 2, reps: 8, formScore: 70 },
    ]);
    const parsed = parseDebriefRequest(JSON.parse(JSON.stringify(req)));
    expect(parsed).not.toBeNull();
    expect(parsed!.exercise).toBe('Squat');
    expect(parsed!.reps).toBe(3);
    expect(parsed!.faults[0].title).toBe('Heels lifting');
    expect(parsed!.previous).toEqual([{ daysAgo: 2, reps: 8, formScore: 70 }]);
  });

  it('rejects malformed bodies and caps untrusted strings', () => {
    expect(parseDebriefRequest(null)).toBeNull();
    expect(parseDebriefRequest({ exercise: 'Squat', kind: 'dance', reps: 1, formScore: 50, durationSec: 10 })).toBeNull();
    expect(parseDebriefRequest({ exercise: 'Squat', kind: 'reps', reps: -1, formScore: 50, durationSec: 10 })).toBeNull();
    const parsed = parseDebriefRequest({
      exercise: 'x'.repeat(5000),
      kind: 'reps',
      reps: 2,
      formScore: 80,
      durationSec: 10,
      faults: Array.from({ length: 50 }, () => ({ title: 'y'.repeat(999), count: 1, tip: 'z', severity: 'weird' })),
      extra: 'ignored',
    });
    expect(parsed!.exercise.length).toBe(160);
    expect(parsed!.faults).toHaveLength(8);
    expect(parsed!.faults[0].severity).toBe('minor');
    expect('extra' in parsed!).toBe(false);
  });
});
