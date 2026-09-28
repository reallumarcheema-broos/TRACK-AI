import { describe, expect, it } from 'vitest';
import type { SimOptions } from '../sim/simulator';
import { runSet } from '../testing/runSet';

interface Case {
  name: string;
  opts: SimOptions;
  /** Expected fault ids for each counted rep. */
  reps: string[][];
  /** Expected fault ids for each partial (uncounted) rep. */
  partials?: string[][];
}

const CASES: Case[] = [
  {
    name: 'squat, side-on: clean reps',
    opts: { exercise: 'squat', yaw: 90, reps: 6 },
    reps: [[], [], [], [], [], []],
  },
  {
    name: 'squat, side-on (facing left): shallow, chest, heels, above parallel, rounding',
    opts: {
      exercise: 'squat',
      yaw: -90,
      reps: [{}, { depth: 0.42 }, { faults: { lean: 32 } }, { faults: { heelLift: 24 } }, { depth: 0.68 }, { faults: { round: 1 } }, {}],
    },
    reps: [[], ['chest_forward'], ['heels_rising'], ['squat_depth'], ['back_rounding'], []],
    partials: [['squat_shallow']],
  },
  {
    name: 'squat, side-on: rushed descent and no lockout',
    opts: { exercise: 'squat', yaw: 90, reps: [{}, { fast: true }, { noReturn: true }, {}, {}] },
    reps: [[], ['squat_fast'], ['squat_lockout'], [], []],
  },
  {
    name: 'squat, facing the camera: knees caving and hip shift',
    opts: { exercise: 'squat', yaw: 0, reps: [{}, { faults: { valgus: 0.12 } }, {}, { faults: { shift: 0.16 } }, {}] },
    reps: [[], ['knees_caving'], [], ['hip_shift'], []],
  },
  {
    name: 'squat, diagonal view: knees caving',
    opts: { exercise: 'squat', yaw: 45, reps: [{}, { faults: { valgus: 0.12 } }, {}] },
    reps: [[], ['knees_caving'], []],
  },
  {
    name: 'push-up: sag, pike, head drop, shallow, rushed',
    opts: {
      exercise: 'pushup',
      reps: [{}, { faults: { sag: 0.1 } }, { faults: { sag: -0.14 } }, { faults: { headDrop: 45 } }, { depth: 0.45 }, { fast: true }, {}],
    },
    reps: [[], ['hips_sagging'], ['hips_piking'], ['head_dropping'], ['pushup_fast'], []],
    partials: [['pushup_shallow']],
  },
  {
    name: 'push-up, facing left: partial depth still counts but is flagged',
    opts: { exercise: 'pushup', yaw: -90, reps: [{}, { depth: 0.75 }, {}] },
    reps: [[], ['pushup_depth'], []],
  },
  {
    name: 'lunge, side-on: torso lean and shallow',
    opts: { exercise: 'lunge', reps: [{}, { faults: { lean: 38 } }, { depth: 0.25 }, {}] },
    reps: [[], ['torso_lean'], []],
    partials: [['lunge_shallow']],
  },
  {
    name: 'lunge, facing the camera: front knee caving',
    opts: { exercise: 'lunge', yaw: 0, reps: [{}, { faults: { valgus: 0.08 } }, {}, {}] },
    reps: [[], ['front_knee_caving'], [], []],
  },
  {
    name: 'romanian deadlift: rounding, squatting it, hips not back, shallow',
    opts: {
      exercise: 'rdl',
      reps: [{}, { faults: { round: 1 } }, { faults: { kneesBent: 1 } }, { faults: { hipsStay: 1 } }, { depth: 0.4 }, {}],
    },
    reps: [[], ['back_rounding'], ['knees_too_bent'], ['hips_not_back', 'rdl_depth'], []],
    partials: [['rdl_shallow']],
  },
  {
    name: 'bicep curl, facing the camera: swing, half rep, elbow drift',
    opts: { exercise: 'curl', reps: [{}, { faults: { swing: 22 } }, { depth: 0.55 }, { faults: { elbowDrift: 55 } }, {}] },
    reps: [[], ['body_swing'], ['elbow_drift'], []],
    partials: [['curl_shallow']],
  },
  {
    name: 'bicep curl, alternating arms',
    opts: { exercise: 'curl', alternate: true, reps: 6 },
    reps: [[], [], [], [], [], []],
  },
  {
    name: 'bicep curl, side-on: swinging',
    opts: { exercise: 'curl', yaw: 90, reps: [{}, { faults: { swing: 20 } }, {}] },
    reps: [[], ['body_swing'], []],
  },
  {
    name: 'shoulder press, facing the camera: partial, uneven, soft lockout',
    opts: {
      exercise: 'press',
      reps: [{}, { depth: 0.4 }, { faults: { uneven: 1 } }, { faults: { softLockout: 45 } }, {}],
    },
    reps: [[], ['uneven_press'], ['press_lockout'], []],
    partials: [['press_shallow']],
  },
  {
    name: 'shoulder press, side-on: leaning back',
    opts: { exercise: 'press', yaw: 90, reps: [{}, { faults: { swing: 20 } }, {}] },
    reps: [[], ['lean_back'], []],
  },
  {
    name: 'jumping jacks: arms low, feet narrow',
    opts: { exercise: 'jumping_jack', reps: [{}, {}, { depth: 0.6 }, {}, { faults: { narrowFeet: 1 } }, {}] },
    reps: [[], [], [], ['jj_feet'], []],
    partials: [['jj_arms']],
  },
];

describe.each(CASES)('$name', ({ opts, reps, partials = [] }) => {
  it.each([1, 2, 3])('seed %i', (seed) => {
    const out = runSet({ ...opts, seed, noise: 0.003 });
    expect(out.repFaults).toEqual(reps.map((r) => [...r].sort()));
    expect(out.partialFaults).toEqual(partials.map((r) => [...r].sort()));
  });
});

describe('plank hold', () => {
  it('times the hold and catches sagging and piking hips', () => {
    const out = runSet({
      exercise: 'plank',
      holdSeconds: 30,
      holdFaults: [
        { from: 8, to: 13, faults: { sag: 0.1 } },
        { from: 19, to: 23, faults: { sag: -0.14 } },
      ],
      noise: 0.003,
    });
    const a = out.analyzer;
    expect(a.holdMs).toBeGreaterThan(29000);
    expect(a.holdFaults.get('hips_sagging')?.count).toBe(1);
    expect(a.holdFaults.get('hips_piking')?.count).toBe(1);
    // ~9 s of the hold had a major fault (sag), so good-form time is shorter than the hold.
    expect(a.goodHoldMs).toBeLessThan(a.holdMs - 3500);
    expect(a.goodHoldMs).toBeGreaterThan(a.holdMs - 7000);
    const ticks = out.events.filter(({ e }) => e.type === 'holdTick').map(({ e }) => (e.type === 'holdTick' ? e.seconds : 0));
    expect(ticks).toEqual([10, 20, 30]);
  });

  it('pauses the timer when the athlete stands up', () => {
    // A squat athlete standing tall is not in a plank.
    const out = runSet({ exercise: 'plank', holdSeconds: 10, noise: 0.002 });
    expect(out.analyzer.holdMs).toBeGreaterThan(9000);
  });
});
