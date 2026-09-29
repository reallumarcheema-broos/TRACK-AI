import type { BodySide } from './landmarks';
import type { PoseFrame, Space, View } from './frame';
import type { RepCounterConfig, RepPhase, RepWindow } from './repCounter';
import type { Vec3 } from './vec';

export type ExerciseId =
  | 'squat'
  | 'pushup'
  | 'lunge'
  | 'rdl'
  | 'curl'
  | 'press'
  | 'jumping_jack'
  | 'plank';

export type Severity = 'minor' | 'major';

/** A coaching point: what went wrong, how we label it on screen and how we say it. */
export interface Cue {
  id: string;
  /** Short on-screen label, e.g. "Knees caving in". */
  title: string;
  /** Short spoken corrections; one is picked at random so the coach doesn't sound robotic. */
  cues: string[];
  severity: Severity;
  /** One-sentence explanation used in the set summary. */
  tip: string;
}

export interface Calibration {
  /** Unit vectors pointing "up" in image and world space (corrects for phone tilt). */
  up: { image: Vec3; world: Vec3 };
  /** Metric value in the athlete's resting start position. */
  restMetric: number | null;
  /** Exercise-specific baselines captured while the athlete stood still. */
  base: Record<string, number>;
  done: boolean;
}

export type Phase = RepPhase | 'hold';

export interface RuleContext {
  cal: Calibration;
  phase: Phase;
  /** Current rep progress (0 = start position, 1 = full range of motion). */
  progress: number;
  /** Current raw rep metric (e.g. knee angle in degrees). */
  metric: number | null;
  space: Space;
}

export interface FrameRule extends Cue {
  /** Camera views in which this rule can be judged reliably (default: any). */
  views?: View[];
  /** Rep phases in which the rule applies (default: whole rep, or the hold). */
  phases?: Phase[];
  /** Only evaluate once the rep has progressed this far (0..1). */
  minProgress?: number;
  /** Fault must persist this long before it counts (default 250 ms). */
  persistMs?: number;
  /** Landmarks to highlight in red while the fault is active. */
  joints?: number[];
  /** true = fault present, false = fine, null = can't tell (landmarks hidden). */
  check: (f: PoseFrame, ctx: RuleContext) => boolean | null;
}

export interface Aggregate {
  min: number;
  max: number;
}

export interface RepStats {
  window: RepWindow;
  /** Raw metric at the deepest point of the rep. */
  metricPeak: number;
  /** Min/max of each exercise tracker during the rep. */
  agg: Record<string, Aggregate>;
  side?: BodySide;
}

export interface RepRule extends Cue {
  check: (rep: RepStats, cal: Calibration) => boolean;
}

export interface MetricContext {
  cal: Calibration;
}

export interface RepSpec {
  /** Scalar that moves monotonically through the rep (degrees, ratios…). */
  metric: (f: PoseFrame, ctx: MetricContext) => number | null;
  /**
   * Optional per-side metric. When set, each side is counted independently and reps that
   * finish together are merged — this supports both simultaneous and alternating curls.
   */
  perSide?: (f: PoseFrame, side: BodySide, ctx: MetricContext) => number | null;
  /** Which way the athlete travels toward the target (drives the on-screen gauge). */
  direction: 'down' | 'up';
  /** Nominal metric value at the start position. */
  start: number;
  /** Metric value that counts as a full rep. */
  target: number;
  /** Metric value for textbook range of motion (reps short of it get the `depth` cue). */
  ideal?: number;
  /** Calibrated resting value is trusted within ±this of `start`. */
  startTolerance?: number;
  counter?: Partial<RepCounterConfig>;
  /** Attempt that never reached the target (not counted). */
  shallow: Cue;
  /** Counted rep that didn't reach `ideal`. */
  depth?: Cue;
  /** Next rep began without returning to the start position. */
  lockout?: Cue;
  /** Rep was rushed. */
  tempo?: { minGoingMs?: number; minReturningMs?: number; cue: Cue };
}

export interface HoldSpec {
  /** Whether the athlete is currently in the hold position. */
  inPosition: (f: PoseFrame, ctx: MetricContext) => boolean;
  /** Spoken when the athlete drops out of position mid-hold. */
  lostCues: string[];
}

export interface ExerciseDef {
  id: ExerciseId;
  name: string;
  /** Spoken plural for rep counts ("10 squats"); defaults to "reps". */
  repNoun?: string;
  tagline: string;
  kind: 'reps' | 'hold';
  camera: {
    recommended: View;
    allowed: View[];
    /** How to prop the phone, shown before the set. */
    placement: string;
    /** Why this view matters, e.g. "Side-on lets me judge depth and back angle". */
    why: string;
  };
  /** Horizontal exercises can't calibrate "up" from the torso. */
  horizontal?: boolean;
  /** Landmarks that must be visible to track this exercise. Evaluated per view. */
  required: (f: PoseFrame) => number[];
  /** Returns guidance while the athlete isn't in the start position (null = ready). */
  startPosition: (f: PoseFrame, ctx: MetricContext) => string | null;
  /** Baselines recorded during calibration (medians). */
  calibrate?: Record<string, (f: PoseFrame, cal: Calibration) => number | null>;
  /** Per-rep min/max trackers available to rep rules. */
  trackers?: Record<string, (f: PoseFrame, ctx: RuleContext) => number | null>;
  rep?: RepSpec;
  hold?: HoldSpec;
  rules: FrameRule[];
  repRules?: RepRule[];
  /** Exercise-specific praise for clean reps. */
  praise: string[];
  defaultTarget: number;
  targetOptions: number[];
  /** Muscles worked — shown on the exercise card. */
  muscles: string;
}

/** All cues an exercise can produce, keyed by id (used for summaries). */
export function exerciseCues(def: ExerciseDef): Map<string, Cue> {
  const m = new Map<string, Cue>();
  for (const r of def.rules) m.set(r.id, r);
  for (const r of def.repRules ?? []) m.set(r.id, r);
  if (def.rep) {
    m.set(def.rep.shallow.id, def.rep.shallow);
    if (def.rep.depth) m.set(def.rep.depth.id, def.rep.depth);
    if (def.rep.lockout) m.set(def.rep.lockout.id, def.rep.lockout);
    if (def.rep.tempo) m.set(def.rep.tempo.cue.id, def.rep.tempo.cue);
  }
  return m;
}
