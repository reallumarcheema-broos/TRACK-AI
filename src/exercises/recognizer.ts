/**
 * Works out which exercise the athlete is doing, so they can press start and just move.
 *
 * Every exercise's own analyzer watches the same frames. The first to count a rep (or, for the
 * plank, to time a few seconds of steady hold) nominates its exercise, and a few body-shape
 * measurements from that rep have to agree: squats and lunges bend the knees (lunges with one
 * thigh far ahead of the other), deadlifts hinge with the knees nearly straight, presses take the
 * hands overhead with bent elbows, jumping jacks with straight arms, curls bend the elbows below the
 * shoulders, and push-ups and planks are done lying down. Form faults don't change these, so a
 * messy rep is still recognised (and then coached). That settles the
 * movements two analyzers can both count. The winning analyzer keeps everything it counted, so
 * the set carries on without a restart.
 */
import { WorkoutAnalyzer, type AnalyzerEvent, type AnalyzerOptions, type AnalyzerSnapshot } from '../core/analyzer';
import type { Calibration, ExerciseDef, ExerciseId } from '../core/exercise';
import type { PoseFrame } from '../core/frame';
import { LM, SIDE, type PoseInput } from '../core/landmarks';
import { median } from '../core/vec';
import { thighInclination } from './helpers';
import { EXERCISES } from './index';

export type RecognizerEvent =
  /** Someone is in a start position: time to move. */
  | { type: 'watching' }
  /** The exercise is known; the set continues with its analyzer. */
  | { type: 'recognized'; def: ExerciseDef; reps: number; holdMs: number };

export type Recognized = Extract<RecognizerEvent, { type: 'recognized' }>;

export type SessionEvent = AnalyzerEvent | RecognizerEvent;

/** On-screen guidance while the exercise is still unknown. */
export const RECOGNIZER_HINTS = {
  noOne: "I can't see you yet — step into the frame",
  position: 'Get into your start position and hold still…',
  start: "Start your exercise — I'll recognise it",
  keepGoing: 'Keep going — working out your exercise…',
  turnFloor: 'Turn sideways to the camera — I coach push-ups and planks side-on',
  turnHinge: 'Turn sideways to the camera — I coach deadlifts side-on',
  faceJacks: 'Face the camera for jumping jacks',
  unknown: "I can't tell which exercise this is. I coach squats, push-ups, lunges, deadlifts, curls, presses, jumping jacks and planks",
} as const;

/** Thresholds, measured on the test athlete with wide margins either side (see the tests). */
export const RECOGNIZE = {
  /** A plank is called after this much steady hold with no push-up started. */
  plankHoldMs: 5000,
  /** …and only if the elbows barely moved (degrees): push-ups bend them 60° or more. */
  plankElbowRange: 25,
  /** Standing exercises: shoulders→ankles at least this many degrees from horizontal (3D). */
  standingMin: 50,
  /** Upper-body exercises only rule out lying down. */
  uprightMin: 30,
  /** Floor exercises: at most this. */
  floorMax: 40,
  /** Thigh-angle difference (degrees) that makes a knee bend a lunge rather than a squat. */
  lungeAsymmetry: 35,
  /**
   * Knee angle (degrees): bending below it is a squat or lunge, staying above it a hip hinge.
   * A squat deep enough to count bends the knee to ~105° or less; deadlift knees stay above ~140°.
   */
  hingeKnee: 125,
  /**
   * Wrists this far above the shoulders (torso lengths) are overhead: presses reach 0.8+, curls
   * stay below 0.3 even when the elbows drift forward.
   */
  overheadUp: 0.5,
  /** Straight arms raised past this (degrees, hip–shoulder–wrist): jumping jacks. */
  raisedArm: 100,
  /** Elbows that never bend past this (degrees) are straight: jumping jacks, not presses or curls. */
  straightElbow: 140,
  /** World inclination below which an upright-looking move is a hinge (front view help). */
  hingeIncline: 76,
  /** Moving this long without a recognised exercise brings up help. */
  stuckMs: 6000,
  /** Attempts that fell short of a rep: this many of the same movement still identify it. */
  partialEvidence: 2,
  /** Moving counts when a tracked point travels this far (torso lengths) within a second. */
  motion: 0.3,
} as const;

const STANDING: ReadonlySet<ExerciseId> = new Set(['squat', 'lunge', 'rdl', 'jumping_jack']);
const UPPER: ReadonlySet<ExerciseId> = new Set(['curl', 'press']);
const FLOOR: ReadonlySet<ExerciseId> = new Set(['pushup', 'plank']);

interface Shadow {
  def: ExerciseDef;
  analyzer: WorkoutAnalyzer;
  events: AnalyzerEvent[];
  snapshot: AnalyzerSnapshot | null;
  lastRepStartT: number | null;
}

interface Sample {
  t: number;
  /** Shoulders→ankles from horizontal in 3D (0 lying, 90 standing), whatever the camera angle. */
  incline: number | null;
  /** Difference between the two thighs' inclination (degrees). */
  asym: number | null;
  /** The more bent knee (degrees). */
  knee: number | null;
  /** The higher arm raise, hip–shoulder–wrist (degrees). */
  arm: number | null;
  /** The higher wrist above its shoulder, in torso lengths (negative = below). */
  wristUp: number | null;
  /** Elbow angle (degrees). */
  elbow: number | null;
  /** Hips, wrists and ankles, in torso lengths, to tell moving from standing still. */
  pts: { x: number; y: number }[] | null;
}

/** What a stretch of movement looked like. */
export interface MoveStats {
  incline: number | null;
  asym: number | null;
  knee: number | null;
  arm: number | null;
  wristUp: number | null;
  /** Most-bent elbow (degrees). */
  elbow: number | null;
}

const quantile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

function worldIncline(f: PoseFrame): number | null {
  const shoulders = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER];
  const ends = f.allVisible([LM.LEFT_ANKLE, LM.RIGHT_ANKLE], 0.35)
    ? [LM.LEFT_ANKLE, LM.RIGHT_ANKLE]
    : f.allVisible([LM.LEFT_KNEE, LM.RIGHT_KNEE], 0.35)
      ? [LM.LEFT_KNEE, LM.RIGHT_KNEE]
      : null;
  if (!ends || !f.allVisible(shoulders, 0.35)) return null;
  const s = f.mid(shoulders[0], shoulders[1], 'world');
  const e = f.mid(ends[0], ends[1], 'world');
  return (Math.atan2(Math.abs(e.y - s.y), Math.hypot(e.x - s.x, e.z - s.z)) * 180) / Math.PI;
}

/** Does the movement look like this exercise? Unknown measurements don't count against it. */
export function consistent(id: ExerciseId, m: MoveStats): boolean {
  const R = RECOGNIZE;
  const below = (v: number | null, max: number) => v === null || v < max;
  const atLeast = (v: number | null, min: number) => v === null || v >= min;
  if (STANDING.has(id) && !atLeast(m.incline, R.standingMin)) return false;
  if (UPPER.has(id) && !atLeast(m.incline, R.uprightMin)) return false;
  if (FLOOR.has(id) && !(m.incline === null || m.incline <= R.floorMax)) return false;
  switch (id) {
    case 'squat':
      return below(m.asym, R.lungeAsymmetry) && below(m.knee, R.hingeKnee);
    case 'lunge':
      return atLeast(m.asym, R.lungeAsymmetry) && below(m.knee, R.hingeKnee);
    case 'rdl':
      return atLeast(m.knee, R.hingeKnee);
    case 'curl':
      return below(m.elbow, R.straightElbow) && below(m.wristUp, R.overheadUp);
    case 'press':
      return below(m.elbow, R.straightElbow) && atLeast(m.wristUp, R.overheadUp);
    case 'jumping_jack':
      return atLeast(m.elbow, R.straightElbow) && atLeast(m.arm, R.raisedArm);
    default:
      return true;
  }
}

export class ExerciseRecognizer {
  readonly shadows: Shadow[];
  chosen: Shadow | null = null;

  private samples: Sample[] = [];
  private watching = false;
  private movingSince: number | null = null;
  private lastMovingT = -Infinity;

  constructor(defs: readonly ExerciseDef[] = EXERCISES, opts: Partial<AnalyzerOptions> = {}) {
    this.shadows = defs.map((def) => ({
      def,
      // Presses start with the hands at the shoulders, a spot people rarely pause in: calibrate
      // on a shorter stillness so the first reps still count.
      analyzer: new WorkoutAnalyzer(def, def.id === 'press' ? { stableMs: 300, calibrateMs: 250, ...opts } : opts),
      events: [],
      snapshot: null,
      lastRepStartT: null,
    }));
  }

  /** The analyzer of the recognised (or chosen) exercise. */
  get analyzer(): WorkoutAnalyzer | null {
    return this.chosen?.analyzer ?? null;
  }

  get exercise(): ExerciseDef | null {
    return this.chosen?.def ?? null;
  }

  /** Switches to another exercise (the athlete corrected us), keeping what it has counted. */
  choose(id: ExerciseId): Recognized | null {
    const s = this.shadows.find((x) => x.def.id === id);
    if (!s || s === this.chosen) return null;
    this.chosen = s;
    return { type: 'recognized', def: s.def, reps: s.analyzer.reps.length, holdMs: s.analyzer.holdMs };
  }

  process(pose: PoseInput | null, t: number, aspect: number): { events: SessionEvent[]; snapshot: AnalyzerSnapshot } {
    for (const s of this.shadows) {
      const out = s.analyzer.process(pose, t, aspect);
      s.events = out.events;
      s.snapshot = out.snapshot;
      if (out.events.some((e) => e.type === 'repStart')) s.lastRepStartT = t;
    }
    if (this.chosen) return { events: this.chosen.events, snapshot: this.chosen.snapshot! };

    const ref = this.shadows[0];
    const frame = ref.snapshot!.frame;
    this.record(frame, t);
    const events: SessionEvent[] = [];

    const winner = this.decide(t);
    if (winner) {
      this.chosen = winner;
      // This frame's own events (e.g. the rep that settled it) are covered by the announcement.
      events.push({ type: 'recognized', def: winner.def, reps: winner.analyzer.reps.length, holdMs: winner.analyzer.holdMs });
      return { events, snapshot: winner.snapshot! };
    }

    const anyActive = this.shadows.some((s) => s.analyzer.status === 'active');
    if (anyActive && !this.watching) {
      this.watching = true;
      events.push({ type: 'watching' });
    }
    const { status, hint } = this.guidance(frame, t, anyActive, pose !== null);
    return {
      events,
      snapshot: {
        status,
        hint,
        view: frame?.view ?? null,
        reps: 0,
        partials: 0,
        phase: 'start',
        progress: 0,
        metric: null,
        activeFaults: [],
        faultJoints: [],
        holdMs: 0,
        goodHoldMs: 0,
        holding: false,
        frame,
      },
    };
  }

  /** The movement since `from`, or null when there's nothing to go on. */
  stats(from: number, to = Infinity): MoveStats {
    const xs = this.samples.filter((s) => s.t >= from && s.t <= to);
    const vals = (k: 'incline' | 'asym' | 'knee' | 'arm' | 'wristUp' | 'elbow') =>
      xs.map((s) => s[k]).filter((v): v is number => v !== null && Number.isFinite(v));
    return {
      incline: vals('incline').length ? median(vals('incline')) : null,
      asym: quantile(vals('asym'), 0.9),
      knee: quantile(vals('knee'), 0.1),
      arm: quantile(vals('arm'), 0.9),
      wristUp: quantile(vals('wristUp'), 0.9),
      elbow: quantile(vals('elbow'), 0.1),
    };
  }

  // ---------------------------------------------------------------------------------------

  private byId(id: ExerciseId): Shadow | undefined {
    return this.shadows.find((s) => s.def.id === id);
  }

  /** A calibration that knows the athlete's limb lengths, for depth-free thigh angles. */
  private standingCal(): Calibration | null {
    for (const id of ['lunge', 'squat'] as const) {
      const cal = this.byId(id)?.analyzer.cal;
      if (cal?.done) return cal;
    }
    return null;
  }

  private record(f: PoseFrame | null, t: number): void {
    while (this.samples.length && t - this.samples[0].t > 20000) this.samples.shift();
    if (!f) return;
    const sides = ['left', 'right'] as const;
    const cal = this.standingCal();
    let asym: number | null = null;
    if (cal) {
      const l = thighInclination(f, cal, 'left');
      const r = thighInclination(f, cal, 'right');
      if (l !== null && r !== null) asym = Math.abs(l - r);
    }
    const knees = sides.filter((s) => f.sideVisible(s, ['hip', 'knee', 'ankle'])).map((s) => f.kneeAngle(s));
    const arms = sides
      .filter((s) => f.sideVisible(s, ['shoulder', 'wrist', 'hip']))
      .map((s) => f.armRaiseAngle(s, f.spaceFor('frontal')));
    const elbow = f.bySide((s) => f.elbowAngle(s), ['shoulder', 'elbow', 'wrist']);
    const torso = f.torsoLength2D;
    const wristUps =
      torso > 1e-3
        ? sides
            .filter((s) => f.sideVisible(s, ['shoulder', 'wrist']))
            .map((s) => (f.img[SIDE[s].shoulder].y - f.img[SIDE[s].wrist].y) / torso)
        : [];
    const tracked = [
      f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image'),
      ...sides.flatMap((s) => [f.img[SIDE[s].wrist], f.img[SIDE[s].ankle]]),
    ];
    this.samples.push({
      t,
      incline: worldIncline(f),
      asym,
      knee: knees.length ? Math.min(...knees) : null,
      arm: arms.length ? Math.max(...arms) : null,
      wristUp: wristUps.length ? Math.max(...wristUps) : null,
      elbow,
      pts: torso > 1e-3 ? tracked.map((p) => ({ x: p.x / torso, y: p.y / torso })) : null,
    });
    this.updateMotion(t);
  }

  private updateMotion(t: number): void {
    const recent = this.samples.filter((s) => s.pts && t - s.t <= 1000);
    let moving = false;
    if (recent.length > 5) {
      const n = recent[0].pts!.length;
      for (let i = 0; i < n && !moving; i++) {
        const xs = recent.map((s) => s.pts![i].x);
        const ys = recent.map((s) => s.pts![i].y);
        moving = Math.max(...xs) - Math.min(...xs) > RECOGNIZE.motion || Math.max(...ys) - Math.min(...ys) > RECOGNIZE.motion;
      }
    }
    if (moving) {
      this.movingSince ??= t;
      this.lastMovingT = t;
    } else if (t - this.lastMovingT > 2500) {
      this.movingSince = null;
    }
  }

  private decide(t: number): Shadow | null {
    const pushup = this.byId('pushup');
    const counted = this.shadows.filter((s) => {
      if (s.def.kind === 'reps') return s.analyzer.reps.length > 0;
      // A steady hold, with no push-up under way.
      const pushing =
        pushup &&
        (pushup.analyzer.reps.length > 0 || (pushup.lastRepStartT !== null && t - pushup.lastRepStartT < RECOGNIZE.plankHoldMs));
      return s.analyzer.holdMs >= RECOGNIZE.plankHoldMs && !pushing && this.elbowsSteady(t - RECOGNIZE.plankHoldMs, t);
    });
    const winner = this.pick(counted, t);
    if (winner) return winner;
    // No counted rep fits: repeated attempts that fall short (shallow squats…) still say what it is.
    const tried = this.shadows.filter((s) => s.def.kind === 'reps' && s.analyzer.partialReps.length >= RECOGNIZE.partialEvidence);
    return this.pick(tried, t);
  }

  /** The one candidate whose movement fits, if there is exactly one (or one clearly ahead). */
  private pick(candidates: Shadow[], t: number): Shadow | null {
    if (!candidates.length) return null;
    // Judge the movement from the start of the earliest rep or attempt (the hold, for a plank).
    const starts = candidates.map(
      (s) => (s.analyzer.reps[0] ?? s.analyzer.partialReps[0])?.window.startT ?? t - RECOGNIZE.plankHoldMs,
    );
    const m = this.stats(Math.min(...starts) - 200, t);
    let fits = candidates.filter((s) => consistent(s.def.id, m));
    if (fits.length > 1 && fits.some((s) => s.def.id === 'pushup')) fits = fits.filter((s) => s.def.id !== 'plank');
    if (fits.length === 1) return fits[0];
    if (fits.length > 1) {
      // Still two contenders: the one with more reps, once it's clearly ahead.
      const score = (s: Shadow) => s.analyzer.reps.length + s.analyzer.partialReps.length;
      const sorted = [...fits].sort((a, b) => score(b) - score(a));
      if (score(sorted[0]) > score(sorted[1])) return sorted[0];
    }
    return null;
  }

  /** The elbows held still (a plank), rather than bending and straightening (push-ups). */
  private elbowsSteady(from: number, to: number): boolean {
    const xs = this.samples.filter((s) => s.t >= from && s.t <= to && s.elbow !== null).map((s) => s.elbow!);
    if (xs.length < 10) return false;
    return quantile(xs, 0.9)! - quantile(xs, 0.1)! < RECOGNIZE.plankElbowRange;
  }

  private guidance(
    f: PoseFrame | null,
    t: number,
    anyActive: boolean,
    seen: boolean,
  ): { status: AnalyzerSnapshot['status']; hint: string } {
    const H = RECOGNIZER_HINTS;
    if (!seen || !f) return { status: 'searching', hint: H.noOne };
    // Lying down facing the camera: push-ups and planks are only tracked side-on.
    const lying = this.stats(t - 1500, t).incline;
    if (lying !== null && lying <= RECOGNIZE.floorMax && f.view !== 'side') return { status: 'positioning', hint: H.turnFloor };
    if (this.shadows.every((s) => s.analyzer.status === 'searching')) {
      return { status: 'searching', hint: this.shadows[0].snapshot?.hint ?? H.noOne };
    }
    // Every analyzer first needs a moment of stillness to measure the athlete.
    if (!anyActive) return { status: 'positioning', hint: H.position };
    const moving = this.movingSince !== null;
    if (moving && t - this.movingSince! >= RECOGNIZE.stuckMs) return { status: 'positioning', hint: this.stuckHint(f, t) };
    return { status: 'positioning', hint: moving ? H.keepGoing : H.start };
  }

  /**
   * Help when someone has been moving for a while and nothing fits: going by the kind of
   * movement, either the camera angle rules the exercise out, or its analyzer never got the
   * moment of stillness it needs to measure the athlete.
   */
  private stuckHint(f: PoseFrame, t: number): string {
    const H = RECOGNIZER_HINTS;
    const R = RECOGNIZE;
    const active = (id: ExerciseId) => this.byId(id)?.analyzer.status === 'active';
    const move = this.stats(t - 4000, t);
    const standing = (move.incline ?? 90) >= R.standingMin;
    const squat = this.byId('squat');
    if (standing && squat?.analyzer.status === 'searching' && squat.snapshot?.hint) return squat.snapshot.hint;

    let ready: boolean;
    if (!standing) {
      ready = active('pushup') || active('plank');
    } else if (
      (move.wristUp !== null && move.wristUp >= R.overheadUp) ||
      (move.elbow !== null && move.elbow >= R.straightElbow && move.arm !== null && move.arm >= R.raisedArm)
    ) {
      // Arms going up: straight, jumping jacks (front-on only); bending, a press.
      const straightArms = move.elbow !== null && move.elbow >= R.straightElbow;
      if (straightArms && f.view === 'side') return H.faceJacks;
      ready = straightArms ? active('jumping_jack') : active('press');
    } else if (move.knee !== null && move.knee >= R.hingeKnee && this.hinged(t)) {
      if (f.view !== 'side') return H.turnHinge;
      ready = active('rdl');
    } else if (move.knee !== null && move.knee < R.hingeKnee) {
      ready = active('squat') || active('lunge');
    } else {
      ready = active('curl');
    }
    if (!ready) return H.position;
    return t - this.movingSince! >= R.stuckMs * 2 ? H.unknown : H.keepGoing;
  }

  /** The body tipped forward lately with straight legs: a hip hinge. */
  private hinged(t: number): boolean {
    const inclines = this.samples.filter((s) => t - s.t <= 4000 && s.incline !== null).map((s) => s.incline!);
    const lowest = quantile(inclines, 0.1);
    return lowest !== null && lowest < RECOGNIZE.hingeIncline;
  }
}
