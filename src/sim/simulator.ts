/**
 * Scripts a whole set for the synthetic athlete: lead-in, reps (optionally with faults),
 * rests and holds, sampled at a fixed frame rate.
 */
import type { ExerciseId } from '../core/exercise';
import type { PoseInput } from '../core/landmarks';
import { POSE_BUILDERS, type Faults, type PoseParams } from './motions';
import {
  completeSkeleton,
  gaussian,
  LANDSCAPE_FLOOR_CAMERA,
  PORTRAIT_CAMERA,
  project,
  rng,
  smoothstep,
  type CameraSetup,
} from './skeleton';

export interface RepScript {
  /** Scales the range of motion (1 = full depth). */
  depth?: number;
  faults?: Faults;
  /** Rush the outbound half of the rep. */
  fast?: boolean;
  /** Start the next rep before returning to the start position. */
  noReturn?: boolean;
}

export interface SimOptions {
  exercise: ExerciseId;
  /** A number means that many clean reps. */
  reps?: number | RepScript[];
  repSeconds?: number;
  restSeconds?: number;
  /** Seconds with nobody in frame at the beginning. */
  absentSeconds?: number;
  /** Seconds standing still in the start position before the first rep. */
  leadInSeconds?: number;
  /** Seconds after the last rep. */
  tailSeconds?: number;
  /** 0 = facing the camera, 90 = side-on facing the frame's right. */
  yaw?: number;
  camera?: CameraSetup;
  fps?: number;
  /** Landmark noise in normalised image units (world noise is scaled to match). */
  noise?: number;
  /** Std-dev (metres) of a fixed per-joint depth error in the 3D world landmarks. */
  depthError?: number;
  seed?: number;
  /** For holds (plank): seconds to hold. */
  holdSeconds?: number;
  /** For holds: fault windows in seconds from the start of the hold. */
  holdFaults?: { from: number; to: number; faults: Faults }[];
  /** Curls: alternate arms instead of curling both together. */
  alternate?: boolean;
}

export interface SimFrame {
  /** Milliseconds. */
  t: number;
  pose: PoseInput | null;
  aspect: number;
}

const FLOOR: ReadonlySet<ExerciseId> = new Set(['pushup', 'plank']);
const FRONT: ReadonlySet<ExerciseId> = new Set(['curl', 'press', 'jumping_jack']);

const REP_SECONDS: Record<ExerciseId, number> = {
  squat: 2.4,
  pushup: 2.0,
  lunge: 3.2,
  rdl: 3.0,
  curl: 2.2,
  press: 2.2,
  jumping_jack: 0.9,
  plank: 0,
};

export function defaultYaw(exercise: ExerciseId): number {
  return FRONT.has(exercise) ? 0 : 90;
}

export function defaultCamera(exercise: ExerciseId): CameraSetup {
  return FLOOR.has(exercise) ? LANDSCAPE_FLOOR_CAMERA : PORTRAIT_CAMERA;
}

interface Segment {
  start: number;
  end: number;
  script: RepScript;
  index: number;
  fromD: number;
}

/** Depth profile inside one rep: out → brief pause → back. */
function repDepth(u: number, seg: Segment): number {
  const g = seg.script.fast ? 0.12 : 0.42;
  const hold = 0.08;
  const endD = seg.script.noReturn ? 0.4 : 0;
  const depth = seg.script.depth ?? 1;
  if (u < g) return (seg.fromD + (1 - seg.fromD) * smoothstep(u / g)) * depth;
  if (u < g + hold) return depth;
  const k = smoothstep((u - g - hold) / (1 - g - hold));
  return (1 + (endD - 1) * k) * depth;
}

export function simulate(opts: SimOptions): SimFrame[] {
  const exercise = opts.exercise;
  const build = POSE_BUILDERS[exercise];
  const fps = opts.fps ?? 30;
  const camera = opts.camera ?? defaultCamera(exercise);
  const yaw = opts.yaw ?? defaultYaw(exercise);
  const rand = rng(opts.seed ?? 1);
  const noise = opts.noise ?? 0.002;
  const aspect = camera.width / camera.height;
  const depthBias = opts.depthError ? Array.from({ length: 33 }, () => gaussian(rand) * opts.depthError!) : undefined;
  const absent = opts.absentSeconds ?? 0;
  const leadIn = opts.leadInSeconds ?? 2.5;
  const tail = opts.tailSeconds ?? 1.5;
  const repSec = opts.repSeconds ?? REP_SECONDS[exercise];
  const rest = opts.restSeconds ?? 0.5;

  const scripts: RepScript[] =
    typeof opts.reps === 'number' ? Array.from({ length: opts.reps }, () => ({})) : (opts.reps ?? []);

  // Lay out rep segments on the timeline.
  const segments: Segment[] = [];
  let t = absent + leadIn;
  let fromD = 0;
  scripts.forEach((script, index) => {
    segments.push({ start: t, end: t + repSec, script, index, fromD });
    t += repSec + (script.noReturn ? 0 : rest);
    fromD = script.noReturn ? 0.4 * (script.depth ?? 1) : 0;
  });
  const hold = exercise === 'plank' ? (opts.holdSeconds ?? 20) : 0;
  const total = (exercise === 'plank' ? absent + leadIn + hold : t) + tail;

  const frames: SimFrame[] = [];
  const dt = 1 / fps;
  for (let i = 0; Math.round(i * dt * 1000) <= Math.round(total * 1000); i++) {
    const time = i * dt;
    if (time < absent) {
      frames.push({ t: Math.round(time * 1000), pose: null, aspect });
      continue;
    }
    const params: PoseParams = { d: 0, faults: {}, t: time, step: 0 };
    if (exercise === 'plank') {
      const since = time - absent - leadIn;
      for (const w of opts.holdFaults ?? []) {
        if (since >= w.from && since < w.to) params.faults = { ...params.faults, ...w.faults };
      }
    } else {
      const seg = segments.find((s) => time >= s.start && time < s.end);
      if (seg) {
        const u = (time - seg.start) / (seg.end - seg.start);
        params.faults = seg.script.faults ?? {};
        if (exercise === 'lunge') {
          params.side = seg.index % 2 === 0 ? 'left' : 'right';
          params.step = smoothstep(u / 0.2) * (1 - smoothstep((u - 0.8) / 0.2));
          const inner = Math.min(1, Math.max(0, (u - 0.2) / 0.6));
          params.d = inner > 0 && inner < 1 ? repDepth(inner, seg) : 0;
        } else if (exercise === 'curl' && opts.alternate) {
          const dd = repDepth(u, seg);
          params.dLeft = seg.index % 2 === 0 ? dd : 0;
          params.dRight = seg.index % 2 === 0 ? 0 : dd;
          params.d = dd;
        } else {
          params.d = repDepth(u, seg);
        }
      } else {
        // Between reps: rest where the previous rep finished.
        const prev = [...segments].reverse().find((s) => s.end <= time);
        params.d = prev?.script.noReturn ? 0.4 * (prev.script.depth ?? 1) : 0;
      }
    }
    const skeleton = completeSkeleton(build(params));
    const pose = project(skeleton, { camera, yaw, imageNoise: noise, worldNoise: noise * 3, depthBias, rand });
    frames.push({ t: Math.round(time * 1000), pose, aspect });
  }
  return frames;
}

/** A demo attempt; `counts: false` marks an aborted partial rep that the analyzer won't count. */
type DemoRep = RepScript & { counts?: false };
const partial = (depth: number): DemoRep => ({ depth, counts: false });

/** Demo attempts: clean reps mixed with the typical mistakes for each exercise. */
const DEMO_REPS: Record<Exclude<ExerciseId, 'plank'>, DemoRep[]> = {
  squat: [{}, {}, partial(0.42), {}, { faults: { lean: 30 } }, {}, { faults: { heelLift: 24 } }, {}, { depth: 0.68 }, {}, {}],
  pushup: [{}, {}, { faults: { sag: 0.1 } }, {}, partial(0.45), {}, { fast: true }, {}, {}],
  lunge: [{}, {}, { faults: { lean: 38 } }, {}, partial(0.25), {}, {}, {}],
  rdl: [{}, {}, { faults: { round: 1 } }, {}, { faults: { kneesBent: 1 } }, {}, {}, {}],
  curl: [{}, {}, { faults: { swing: 22 } }, {}, partial(0.55), {}, { faults: { elbowDrift: 55 } }, {}, {}, {}],
  press: [{}, {}, partial(0.4), {}, { faults: { uneven: 1 } }, {}, { faults: { softLockout: 45 } }, {}, {}],
  jumping_jack: [{}, {}, {}, partial(0.6), {}, {}, { faults: { narrowFeet: 1 } }, {}, {}, {}, {}, {}],
};

/**
 * Trims or pads the demo attempts so the set reaches `target` counted reps (0 = open set),
 * plus one spare rep in case the analyzer rejects a scripted one.
 */
function fitToTarget(attempts: DemoRep[], target: number): RepScript[] {
  if (target <= 0) return attempts;
  const reps: RepScript[] = [];
  let counted = 0;
  for (const rep of attempts) {
    if (counted >= target) break;
    reps.push(rep);
    if (rep.counts !== false) counted++;
  }
  for (; counted < target; counted++) reps.push({});
  reps.push({});
  return reps;
}

/** Scripted set for the camera-free demo, long enough to reach the chosen target. */
export function demoScript(exercise: ExerciseId, target = 0): SimOptions {
  if (exercise === 'plank') {
    return {
      exercise,
      holdSeconds: Math.max(32, target + 2),
      holdFaults: [
        { from: 9, to: 14, faults: { sag: 0.1 } },
        { from: 20, to: 24, faults: { sag: -0.13 } },
      ],
    };
  }
  return { exercise, reps: fitToTarget(DEMO_REPS[exercise], target) };
}
