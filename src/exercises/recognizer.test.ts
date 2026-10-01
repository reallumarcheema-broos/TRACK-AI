import { describe, expect, it } from 'vitest';
import type { ExerciseId } from '../core/exercise';
import { demoScript, simulate, type SimOptions } from '../sim/simulator';
import { runSet } from '../testing/runSet';
import { consistent, ExerciseRecognizer, RECOGNIZER_HINTS, type SessionEvent } from './recognizer';

/** Runs a simulated set through the recognizer, as the workout screen does. */
function recognize(opts: SimOptions) {
  const r = new ExerciseRecognizer();
  const events: { t: number; e: SessionEvent }[] = [];
  const hints = new Set<string>();
  let lastHint: string | null = null;
  for (const f of simulate(opts)) {
    const out = r.process(f.pose, f.t, f.aspect);
    for (const e of out.events) events.push({ t: f.t, e });
    if (!r.chosen) {
      lastHint = out.snapshot.hint;
      if (lastHint) hints.add(lastHint);
    }
  }
  const recognized = events.find((x) => x.e.type === 'recognized');
  return { r, events, hints, lastHint, recognizedAt: recognized?.t ?? null, id: r.exercise?.id ?? null };
}

/** Every exercise, from every camera view its own analyzer works in. */
const VIEWS: [ExerciseId, number[]][] = [
  ['squat', [0, 45, 90]],
  ['lunge', [0, 45, 90]],
  ['rdl', [90]],
  ['curl', [0, 45, 90]],
  ['press', [0, 45, 90]],
  ['jumping_jack', [0, 45]],
  ['pushup', [90]],
];

describe('ExerciseRecognizer', () => {
  for (const [exercise, yaws] of VIEWS) {
    it(`${exercise}: recognised from every supported view, keeping every rep`, () => {
      for (const yaw of yaws) {
        for (const extra of [{}, { noise: 0.004, depthError: 0.03, seed: 5 }]) {
          const opts: SimOptions = { exercise, reps: 3, yaw, ...extra };
          const out = recognize(opts);
          const label = `yaw ${yaw} ${JSON.stringify(extra)}`;
          expect(out.id, label).toBe(exercise);
          // Worked out by the end of the first rep…
          const firstRep = out.r.analyzer!.reps[0];
          expect(out.recognizedAt, label).toBeLessThanOrEqual(firstRep.window.endT + 100);
          // …and the set lost nothing to the detour: same count as when picking the exercise.
          expect(out.r.analyzer!.reps.length, label).toBe(runSet(opts).analyzer.reps.length);
        }
      }
    });
  }

  it('recognises the demo sets, mistakes and half reps included', () => {
    for (const [exercise] of VIEWS) {
      const script = demoScript(exercise);
      const out = recognize(script);
      expect(out.id, exercise).toBe(exercise);
      expect(out.r.analyzer!.reps.length, exercise).toBe(runSet(script).analyzer.reps.length);
    }
  });

  it('recognises alternating curls', () => {
    expect(recognize({ exercise: 'curl', reps: 4, alternate: true }).id).toBe('curl');
  });

  it('counts presses even when the athlete never pauses at the shoulders', () => {
    const out = recognize({ exercise: 'press', reps: 4, leadInSeconds: 0.3 });
    expect(out.id).toBe('press');
    expect(out.r.analyzer!.reps.length).toBeGreaterThanOrEqual(3);
  });

  it('calls a plank after a few seconds of steady hold, with the time already held', () => {
    const out = recognize({ exercise: 'plank', holdSeconds: 12 });
    expect(out.id).toBe('plank');
    expect(out.recognizedAt).toBeGreaterThan(5000);
    expect(out.recognizedAt).toBeLessThan(9000);
    expect(out.r.analyzer!.holdMs).toBeGreaterThan(10000);
  });

  it('never mistakes push-ups for a plank, even when push-up tracking struggles', () => {
    for (const seed of [7, 11]) {
      const out = recognize({ exercise: 'pushup', reps: 5, noise: 0.006, depthError: 0.05, seed });
      expect(out.id, `seed ${seed}`).not.toBe('plank');
    }
  });

  it('says go once someone is in position, before any rep', () => {
    const out = recognize({ exercise: 'squat', reps: 2 });
    const watching = out.events.filter((x) => x.e.type === 'watching');
    expect(watching).toHaveLength(1);
    expect(watching[0].t).toBeLessThan(out.recognizedAt!);
  });

  it('recognises shallow squats from the attempts, before any counts', () => {
    const out = recognize({ exercise: 'squat', reps: [{ depth: 0.45 }, { depth: 0.45 }, { depth: 0.45 }] });
    expect(out.id).toBe('squat');
    expect(out.r.analyzer!.reps).toHaveLength(0);
    expect(out.r.analyzer!.partialReps.length).toBeGreaterThanOrEqual(2);
  });

  it('standing still is not an exercise', () => {
    const out = recognize({ exercise: 'squat', reps: 0, leadInSeconds: 10 });
    expect(out.id).toBeNull();
    expect(out.lastHint).toBe(RECOGNIZER_HINTS.start);
  });

  it('asks for stillness first when nobody has held still yet', () => {
    const out = recognize({ exercise: 'squat', reps: 5, leadInSeconds: 0.3, restSeconds: 0.2, tailSeconds: 0 });
    expect(out.id).toBeNull();
    expect(out.lastHint).toBe(RECOGNIZER_HINTS.position);
  });

  it('says when nobody is in view', () => {
    const out = recognize({ exercise: 'squat', reps: 0, absentSeconds: 3, leadInSeconds: 0, tailSeconds: 0 });
    expect(out.hints.has(RECOGNIZER_HINTS.noOne)).toBe(true);
  });

  it('explains which way to face when the camera angle rules an exercise out', () => {
    const cases: [SimOptions, string][] = [
      [{ exercise: 'pushup', reps: 5, yaw: 0 }, RECOGNIZER_HINTS.turnFloor],
      [{ exercise: 'plank', holdSeconds: 8, yaw: 0 }, RECOGNIZER_HINTS.turnFloor],
      [{ exercise: 'rdl', reps: 5, yaw: 0 }, RECOGNIZER_HINTS.turnHinge],
      [{ exercise: 'jumping_jack', reps: 12, yaw: 90 }, RECOGNIZER_HINTS.faceJacks],
    ];
    for (const [opts, hint] of cases) {
      const out = recognize(opts);
      expect(out.id, opts.exercise).toBeNull();
      expect(out.hints.has(hint), `${opts.exercise}: ${[...out.hints].join(' | ')}`).toBe(true);
    }
  });

  it('lets the athlete switch exercise, keeping what that exercise counted', () => {
    const out = recognize({ exercise: 'squat', reps: 3 });
    expect(out.id).toBe('squat');
    const e = out.r.choose('lunge');
    // The lunge analyzer counted the same knee bends, so nothing is lost by switching.
    expect(e).toMatchObject({ type: 'recognized', reps: 3 });
    expect(out.r.exercise?.id).toBe('lunge');
    expect(out.r.choose('lunge')).toBeNull();
  });

  it('checks the movement against each exercise', () => {
    const squatLike = { incline: 88, asym: 8, knee: 60, arm: 40, wristUp: -0.3, elbow: 50 };
    expect(consistent('squat', squatLike)).toBe(true);
    expect(consistent('lunge', squatLike)).toBe(false);
    expect(consistent('rdl', squatLike)).toBe(false);
    expect(consistent('lunge', { ...squatLike, asym: 70, knee: 75 })).toBe(true);
    expect(consistent('rdl', { ...squatLike, knee: 150 })).toBe(true);
    // Curls bend the elbows below the shoulders, presses take the hands overhead, jumping jacks
    // raise straight arms.
    const curlLike = { ...squatLike, knee: 175, wristUp: 0.25, arm: 110 };
    expect(consistent('curl', curlLike)).toBe(true);
    expect(consistent('press', curlLike)).toBe(false);
    expect(consistent('jumping_jack', curlLike)).toBe(false);
    const pressLike = { ...curlLike, wristUp: 1.1, arm: 178, elbow: 80 };
    expect(consistent('press', pressLike)).toBe(true);
    expect(consistent('curl', pressLike)).toBe(false);
    expect(consistent('jumping_jack', pressLike)).toBe(false);
    const jackLike = { ...pressLike, elbow: 170 };
    expect(consistent('jumping_jack', jackLike)).toBe(true);
    expect(consistent('press', jackLike)).toBe(false);
    // Lying down rules out standing exercises (a push-up facing the camera looks upright in 2D).
    expect(consistent('squat', { ...squatLike, incline: 18 })).toBe(false);
    expect(consistent('pushup', { ...squatLike, incline: 18 })).toBe(true);
    expect(consistent('pushup', squatLike)).toBe(false);
    // Unknown measurements don't count against an exercise.
    expect(consistent('squat', { incline: null, asym: null, knee: null, arm: null, wristUp: null, elbow: null })).toBe(true);
  });

  it('still recognises sets where every rep has the same mistake', () => {
    const every = (n: number, rep: object) => Array.from({ length: n }, () => rep);
    const sets: SimOptions[] = [
      { exercise: 'squat', reps: every(3, { faults: { lean: 30 } }) },
      { exercise: 'squat', reps: every(3, { faults: { heelLift: 24 } }) },
      { exercise: 'lunge', reps: every(3, { faults: { lean: 38 } }) },
      { exercise: 'rdl', reps: every(3, { faults: { round: 1 } }) },
      { exercise: 'curl', reps: every(3, { faults: { swing: 22 } }) },
      { exercise: 'curl', reps: every(3, { faults: { elbowDrift: 55 } }) },
      { exercise: 'press', reps: every(3, { faults: { uneven: 1 } }) },
      { exercise: 'press', reps: every(3, { faults: { softLockout: 45 } }) },
      { exercise: 'pushup', reps: every(3, { faults: { sag: 0.1 } }) },
      { exercise: 'jumping_jack', reps: every(5, { faults: { narrowFeet: 1 } }) },
    ];
    for (const opts of sets) {
      expect(recognize(opts).id, JSON.stringify(opts.reps)).toBe(opts.exercise);
    }
  });
});
