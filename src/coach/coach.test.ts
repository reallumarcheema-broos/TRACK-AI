import { describe, expect, it } from 'vitest';
import { WorkoutAnalyzer } from '../core/analyzer';
import type { ExerciseId } from '../core/exercise';
import { EXERCISE_BY_ID } from '../exercises';
import { rng } from '../sim/skeleton';
import { simulate, type SimOptions } from '../sim/simulator';
import { Coach, type CoachLine } from './coach';
import { VoiceQueue, type SpeechEngine } from './voice';

/** Speech engine with a realistic speaking time (~2.8 words/s), driven by frame time. */
class TimedEngine implements SpeechEngine {
  readonly available = true;
  spoken: { text: string; at: number }[] = [];
  private cur: { end: number; done: () => void } | null = null;
  now = 0;
  speak(text: string, onDone: () => void): void {
    this.spoken.push({ text, at: this.now });
    const words = text.split(/\s+/).length;
    this.cur = { end: this.now + 300 + words * 350, done: onDone };
  }
  cancel(): void {
    const c = this.cur;
    this.cur = null;
    c?.done();
  }
  advance(t: number): void {
    this.now = t;
    if (this.cur && t >= this.cur.end) {
      const c = this.cur;
      this.cur = null;
      c.done();
    }
  }
}

describe('Coach: announcing the set', () => {
  it('names the target with the exercise’s rep noun', () => {
    const engine = new TimedEngine();
    const voice = new VoiceQueue(engine, () => engine.now);
    const def = EXERCISE_BY_ID.rdl;
    const analyzer = new WorkoutAnalyzer(def);
    // rand = 0 picks the first line of each pool.
    const coach = new Coach(def, { target: 10, voice, rand: () => 0 });
    for (const fr of simulate({ exercise: 'rdl', reps: 1 })) {
      engine.advance(fr.t);
      const { events, snapshot } = analyzer.process(fr.pose, fr.t, fr.aspect);
      coach.handle(events, snapshot, fr.t);
    }
    expect(engine.spoken.map((s) => s.text)).toContain("Got you! 10 deadlifts. Let's go!");
  });
});

function coachSet(opts: SimOptions & { exercise: ExerciseId }, target: number | null) {
  const engine = new TimedEngine();
  const voice = new VoiceQueue(engine, () => engine.now);
  const lines: CoachLine[] = [];
  const def = EXERCISE_BY_ID[opts.exercise];
  const analyzer = new WorkoutAnalyzer(def);
  const coach = new Coach(def, { target, voice, rand: rng(3), onLine: (l) => lines.push(l) });
  for (const fr of simulate(opts)) {
    engine.advance(fr.t);
    const { events, snapshot } = analyzer.process(fr.pose, fr.t, fr.aspect);
    coach.handle(events, snapshot, fr.t);
  }
  return { spoken: engine.spoken.map((s) => s.text), timed: engine.spoken, lines, coach, analyzer };
}

describe('Coach', () => {
  it('guides setup, counts every rep and celebrates the finish', () => {
    const { spoken, coach } = coachSet({ exercise: 'squat', absentSeconds: 1, reps: 5 }, 5);
    expect(spoken[0]).toMatch(/step into the frame/i);
    expect(spoken.some((s) => /\bgo!/i.test(s))).toBe(true);
    for (const word of ['One.', 'Two.', 'Three.', 'Four.', 'Five.']) {
      expect(spoken.some((s) => s.startsWith(word))).toBe(true);
    }
    expect(spoken.find((s) => s.startsWith('Four.'))).toMatch(/last/i);
    expect(spoken.find((s) => s.startsWith('Five.'))).toMatch(/done|complete|well done/i);
    expect(coach.targetReached).toBe(true);
  });

  it('corrects a fault mid-rep and praises the fix on the next rep', () => {
    const { spoken, timed, analyzer } = coachSet(
      { exercise: 'squat', reps: [{}, { faults: { heelLift: 24 } }, {}, {}] },
      null,
    );
    const heelsCue = EXERCISE_BY_ID.squat.rules.find((r) => r.id === 'heels_rising')!.cues;
    const correction = timed.find((s) => heelsCue.includes(s.text));
    expect(correction).toBeDefined();
    // Said while the faulty (second) rep was still in progress.
    const second = analyzer.reps[1];
    expect(correction!.at).toBeGreaterThan(second.window.startT);
    expect(correction!.at).toBeLessThan(second.window.endT);
    const three = spoken.find((s) => s.startsWith('Three.'));
    expect(three).toMatch(/better|that's it|nice fix|like that/i);
  });

  it("tells the athlete when a rep didn't count", () => {
    const { spoken } = coachSet({ exercise: 'squat', reps: [{}, { depth: 0.42 }, {}] }, null);
    expect(spoken.some((s) => /didn't count|deeper|lower/i.test(s))).toBe(true);
    // The shallow attempt must not be counted out loud.
    expect(spoken.filter((s) => s.startsWith('Two.'))).toHaveLength(1);
    expect(spoken.some((s) => s.startsWith('Three.'))).toBe(false);
  });

  it("doesn't nag: the same correction is not repeated within its cooldown", () => {
    const reps = Array.from({ length: 6 }, () => ({ faults: { heelLift: 24 } }));
    const { timed } = coachSet({ exercise: 'squat', reps }, null);
    const heelsCue = EXERCISE_BY_ID.squat.rules.find((r) => r.id === 'heels_rising')!.cues;
    const times = timed.filter((s) => heelsCue.some((c) => s.text.includes(c))).map((s) => s.at);
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(6000);
  });

  it('calls out hold time, corrects sagging and counts down the last seconds', () => {
    const { spoken, coach } = coachSet(
      { exercise: 'plank', holdSeconds: 24, holdFaults: [{ from: 6, to: 10, faults: { sag: 0.1 } }] },
      20,
    );
    expect(spoken.some((s) => /timer/i.test(s))).toBe(true);
    expect(spoken.some((s) => /10 seconds/i.test(s))).toBe(true);
    expect(spoken.some((s) => /hips/i.test(s))).toBe(true);
    for (const n of ['Three', 'Two', 'One']) expect(spoken).toContain(n);
    expect(spoken.some((s) => /time/i.test(s) && /hold|plank/i.test(s))).toBe(true);
    expect(coach.targetReached).toBe(true);
  });
});
