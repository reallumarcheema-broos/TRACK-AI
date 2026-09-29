import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../exercises';
import { runSet } from '../testing/runSet';
import { demoScript } from './simulator';

describe('demoScript', () => {
  for (const ex of EXERCISES.filter((e) => e.kind === 'reps')) {
    it(`${ex.id}: the demo athlete reaches every target option`, () => {
      for (const target of ex.targetOptions.filter((n) => n > 0)) {
        const counted = runSet(demoScript(ex.id, target)).analyzer.reps.length;
        expect(counted, `target ${target}`).toBeGreaterThanOrEqual(target);
      }
    });
  }

  it('scripted partial reps are exactly the ones the analyzer rejects', () => {
    for (const ex of EXERCISES.filter((e) => e.kind === 'reps')) {
      const script = demoScript(ex.id);
      const expected = (script.reps as { counts?: false }[]).filter((r) => r.counts === false).length;
      expect(runSet(script).analyzer.partialReps.length, ex.id).toBe(expected);
    }
  });

  it('open sets still show a few mistakes', () => {
    const out = runSet(demoScript('squat'));
    expect(out.analyzer.reps.length).toBeGreaterThanOrEqual(8);
    expect(out.repFaults.flat().length).toBeGreaterThan(0);
    expect(out.partialFaults.length).toBeGreaterThan(0);
  });

  it('plank: holds past a long target', () => {
    const out = runSet(demoScript('plank', 60));
    expect(out.analyzer.holdMs).toBeGreaterThanOrEqual(60_000);
  });
});
