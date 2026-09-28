import type {
  Aggregate,
  Calibration,
  Cue,
  ExerciseDef,
  FrameRule,
  MetricContext,
  Phase,
  RepStats,
  RuleContext,
} from './exercise';
import { IMAGE_UP, PoseFrame, ViewTracker, WORLD_UP, bodyUp, type View } from './frame';
import { BODY_REGIONS, LM, type BodySide, type PoseInput } from './landmarks';
import { PoseSmoother } from './oneEuro';
import { RepCounter, type RepEvent, type RepPhase, type RepWindow } from './repCounter';
import { measureSegments } from './segments';
import { median, normalize, type Vec3 } from './vec';

export type AnalyzerStatus = 'searching' | 'positioning' | 'calibrating' | 'active';

export interface RepResult {
  /** 1-based rep number. Partial reps carry the number the rep would have had. */
  index: number;
  counted: boolean;
  /** 0..100 form score. */
  score: number;
  faults: Cue[];
  window: RepWindow;
  /** Raw metric at the deepest point (e.g. minimum knee angle). */
  metricPeak: number;
  side?: BodySide;
}

export type AnalyzerEvent =
  | { type: 'status'; status: AnalyzerStatus; hint: string | null }
  | { type: 'ready' }
  | { type: 'repStart' }
  | { type: 'rep'; rep: RepResult }
  | { type: 'partial'; rep: RepResult }
  /** A form fault was detected. `midRep` = happening right now (vs. judged after the rep). */
  | { type: 'fault'; cue: Cue; repIndex: number; midRep: boolean }
  | { type: 'faultCleared'; cue: Cue }
  | { type: 'lost' }
  | { type: 'found' }
  | { type: 'holdStart' }
  | { type: 'holdPause' }
  | { type: 'holdTick'; seconds: number }
  | { type: 'idle'; seconds: number };

export interface AnalyzerSnapshot {
  status: AnalyzerStatus;
  hint: string | null;
  view: View | null;
  reps: number;
  partials: number;
  phase: Phase;
  /** 0..1+ progress through the current rep. */
  progress: number;
  metric: number | null;
  activeFaults: Cue[];
  faultJoints: number[];
  holdMs: number;
  goodHoldMs: number;
  holding: boolean;
  frame: PoseFrame | null;
}

export interface AnalyzerOptions {
  /** Time the athlete must hold still in the start position before calibration (ms). */
  stableMs: number;
  /** Calibration window (ms). */
  calibrateMs: number;
  /** Tracking must be missing this long before we announce it (ms). */
  lostAfterMs: number;
  /** Emit an idle event every this many ms without reps (after the first rep). */
  idleEveryMs: number;
  /** Smoothing; set to false for pre-smoothed input (tests). */
  smoothing: boolean;
}

const DEFAULT_OPTIONS: AnalyzerOptions = {
  stableMs: 700,
  calibrateMs: 500,
  lostAfterMs: 1500,
  idleEveryMs: 10000,
  smoothing: true,
};

const MERGE_WINDOW_MS = 700;

interface CurrentRep {
  agg: Record<string, Aggregate>;
  metricPeak: number;
  peakProgress: number;
  faults: Map<string, Cue>;
}

class Track {
  readonly counter: RepCounter;
  cur: CurrentRep | null = null;
  progress = 0;
  metric: number | null = null;
  constructor(
    readonly side: BodySide | undefined,
    def: ExerciseDef,
  ) {
    this.counter = new RepCounter(def.rep?.counter);
  }
}

interface RuleState {
  since: number | null;
  falseSince: number | null;
  active: boolean;
}

interface StableSample {
  t: number;
  p: number;
  x: number;
  y: number;
}

export function scoreFaults(faults: Iterable<Cue>): number {
  let s = 100;
  for (const f of faults) s -= f.severity === 'major' ? 35 : 15;
  return Math.max(0, s);
}

export class WorkoutAnalyzer {
  readonly opts: AnalyzerOptions;
  status: AnalyzerStatus = 'searching';
  hint: string | null = null;
  cal: Calibration = {
    up: { image: IMAGE_UP, world: WORLD_UP },
    restMetric: null,
    base: {},
    done: false,
  };

  /** Counted reps, in order. */
  readonly reps: RepResult[] = [];
  /** Attempts that were not counted. */
  readonly partialReps: RepResult[] = [];
  /** For holds: how often / how long each fault was active. */
  readonly holdFaults = new Map<string, { cue: Cue; count: number; ms: number }>();

  holdMs = 0;
  goodHoldMs = 0;
  holding = false;
  activeSince: number | null = null;
  lastT = 0;

  private readonly smoother = new PoseSmoother();
  private readonly viewTracker = new ViewTracker();
  private readonly tracks: Track[];
  private readonly ruleStates = new Map<string, RuleState>();
  private stable: StableSample[] = [];
  private calibSamples: { metric: number[]; upI: Vec3[]; upW: Vec3[]; frames: PoseFrame[] } | null = null;
  private calibStart = 0;
  /** When the athlete last entered the start position (setup only). */
  private inPositionSince: number | null = null;
  private lastSeenT: number | null = null;
  private lostAnnounced = false;
  private lastActivityT = 0;
  private idleEmitted = 0;
  private holdOutSince: number | null = null;
  private holdTicks = 0;
  private lastFrame: PoseFrame | null = null;
  private merged = new WeakSet<RepResult>();

  constructor(
    readonly def: ExerciseDef,
    opts: Partial<AnalyzerOptions> = {},
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.tracks = def.rep?.perSide
      ? [new Track('left', def), new Track('right', def)]
      : [new Track(undefined, def)];
  }

  get repCount(): number {
    return this.reps.length;
  }

  /**
   * Feed one frame. `pose` is null when no person was detected.
   * `aspect` is the video frame's width / height.
   */
  process(pose: PoseInput | null, t: number, aspect: number): { events: AnalyzerEvent[]; snapshot: AnalyzerSnapshot } {
    const events: AnalyzerEvent[] = [];
    const dt = this.lastT ? Math.min(Math.max(t - this.lastT, 0), 200) : 0;
    this.lastT = t;

    let frame: PoseFrame | null = null;
    if (pose) {
      const smoothed = this.opts.smoothing ? this.smoother.smooth(pose, t) : pose;
      frame = new PoseFrame(smoothed, t, aspect);
      this.viewTracker.update(frame);
    }
    this.lastFrame = frame;

    const trackHint = frame
      ? this.trackingHint(frame, this.status !== 'active')
      : "I can't see you yet — step into the frame";
    if (trackHint) {
      this.handleMissing(t, trackHint, events);
    } else {
      this.handleSeen(events);
      if (this.status === 'active') {
        if (this.def.kind === 'reps') this.processReps(frame!, t, events);
        else this.processHold(frame!, t, dt, events);
      } else {
        this.processSetup(frame!, t, events);
      }
    }
    return { events, snapshot: this.snapshot() };
  }

  snapshot(): AnalyzerSnapshot {
    const lead = this.leadTrack();
    const active: Cue[] = [];
    const joints = new Set<number>();
    for (const rule of this.def.rules) {
      if (this.ruleStates.get(rule.id)?.active) {
        active.push(rule);
        rule.joints?.forEach((j) => joints.add(j));
      }
    }
    return {
      status: this.status,
      hint: this.hint,
      view: this.lastFrame?.view ?? null,
      reps: this.reps.length,
      partials: this.partialReps.length,
      phase: this.def.kind === 'hold' ? 'hold' : lead.counter.phase,
      progress: this.def.kind === 'hold' ? 0 : Math.max(0, lead.progress),
      metric: lead.metric,
      activeFaults: active,
      faultJoints: [...joints],
      holdMs: this.holdMs,
      goodHoldMs: this.goodHoldMs,
      holding: this.holding,
      frame: this.lastFrame,
    };
  }

  // ---------------------------------------------------------------------------------------
  // Visibility / tracking

  /**
   * Guidance when the athlete can't be tracked properly, or null when they can. Before the
   * set starts we insist on every required landmark; mid-set we keep analysing as long as
   * most of the body is visible (individual metrics cope with the odd hidden joint).
   */
  private trackingHint(f: PoseFrame, strict: boolean): string | null {
    const required = this.def.required(f);
    const missing = required.filter((i) => !f.visible(i));
    if (!strict && missing.length <= required.length * 0.4) return null;
    if (missing.length === 0) {
      const size = f.bodyExtent;
      if (size > 0 && size < 0.28) return 'Come a little closer to the camera';
      return null;
    }
    const lower = new Set<number>([...BODY_REGIONS.feet, LM.LEFT_KNEE, LM.RIGHT_KNEE]);
    const upper = new Set<number>([LM.NOSE, LM.LEFT_EAR, LM.RIGHT_EAR, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]);
    const arms = new Set<number>([LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_ELBOW]);
    const lowMissing = missing.some((i) => lower.has(i));
    const upMissing = missing.some((i) => upper.has(i));
    if (lowMissing && upMissing) return 'Step back so your whole body fits in the frame';
    if (lowMissing) return "Step back or tilt the phone down — I can't see your legs and feet";
    if (upMissing) return "Step back or tilt the phone up — I can't see your head and shoulders";
    if (missing.every((i) => arms.has(i))) return 'Keep your arms in view of the camera';
    return 'Step back so I can see your whole body';
  }

  private handleMissing(t: number, hint: string, events: AnalyzerEvent[]): void {
    if (this.status === 'active') {
      if (this.lastSeenT === null) this.lastSeenT = t;
      if (!this.lostAnnounced && t - this.lastSeenT >= this.opts.lostAfterMs) {
        this.lostAnnounced = true;
        events.push({ type: 'lost' });
        for (const tr of this.tracks) {
          tr.counter.reset();
          tr.cur = null;
        }
        this.resetRules();
        if (this.holding) {
          this.holding = false;
          events.push({ type: 'holdPause' });
        }
      }
      // Keep "active" status (the set continues) but surface the hint.
      this.setHint(this.lostAnnounced ? hint : null, events);
      return;
    }
    this.stable = [];
    this.calibSamples = null;
    this.inPositionSince = null;
    this.setStatus('searching', hint, events);
  }

  private handleSeen(events: AnalyzerEvent[]): void {
    this.lastSeenT = null;
    if (this.lostAnnounced) {
      this.lostAnnounced = false;
      events.push({ type: 'found' });
      this.setHint(null, events);
    }
  }

  private setStatus(status: AnalyzerStatus, hint: string | null, events: AnalyzerEvent[]): void {
    if (status !== this.status || hint !== this.hint) {
      this.status = status;
      this.hint = hint;
      events.push({ type: 'status', status, hint });
    }
  }

  private setHint(hint: string | null, events: AnalyzerEvent[]): void {
    if (hint !== this.hint) {
      this.hint = hint;
      events.push({ type: 'status', status: this.status, hint });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Setup: view check → start position → hold still → calibrate

  private metricCtx(): MetricContext {
    return { cal: this.cal };
  }

  /** Progress for the setup/stability check (single representative value). */
  private setupProgress(f: PoseFrame): number {
    if (!this.def.rep) return 0;
    const lead = this.def.rep.perSide ? null : this.def.rep.metric(f, this.metricCtx());
    if (lead !== null && lead !== undefined) return this.progressOf(lead);
    if (this.def.rep.perSide) {
      const ps = (['left', 'right'] as const)
        .map((s) => this.def.rep!.perSide!(f, s, this.metricCtx()))
        .filter((m): m is number => m !== null && Number.isFinite(m))
        .map((m) => this.progressOf(m));
      return ps.length ? Math.max(...ps) : 0;
    }
    return 0;
  }

  private processSetup(f: PoseFrame, t: number, events: AnalyzerEvent[]): void {
    const cam = this.def.camera;
    if (!cam.allowed.includes(f.view)) {
      this.stable = [];
      this.calibSamples = null;
      this.inPositionSince = null;
      const hint =
        cam.recommended === 'side'
          ? 'Turn sideways to the camera'
          : cam.recommended === 'front'
            ? 'Face the camera'
            : 'Turn about halfway toward the camera';
      this.setStatus('positioning', hint, events);
      return;
    }

    const startHint = this.def.startPosition(f, this.metricCtx());
    if (startHint) {
      this.stable = [];
      this.calibSamples = null;
      this.inPositionSince = null;
      this.setStatus('positioning', startHint, events);
      return;
    }
    this.inPositionSince ??= t;

    const hip = f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image');
    const p = this.setupProgress(f);
    this.stable.push({ t, p, x: hip.x, y: hip.y });
    while (this.stable.length && t - this.stable[0].t > this.opts.stableMs) this.stable.shift();
    const span = this.stable.length ? t - this.stable[0].t : 0;
    const ps = this.stable.map((s) => s.p);
    const xs = this.stable.map((s) => s.x);
    const ys = this.stable.map((s) => s.y);
    const still =
      Math.max(...ps) - Math.min(...ps) < 0.2 &&
      Math.max(...xs) - Math.min(...xs) < 0.04 &&
      Math.max(...ys) - Math.min(...ys) < 0.04;
    // Jittery tracking must never trap the athlete in setup: after a few seconds in the start
    // position we calibrate anyway (medians shrug off the noise).
    const patient = t - this.inPositionSince >= 3000;

    if (!still && !patient) {
      this.calibSamples = null;
      this.setStatus('positioning', 'Hold still for a second…', events);
      return;
    }

    if (!this.calibSamples) {
      if (span < this.opts.stableMs * 0.8) {
        this.setStatus('positioning', 'Hold still for a second…', events);
        return;
      }
      this.calibSamples = { metric: [], upI: [], upW: [], frames: [] };
      this.calibStart = t;
      this.setStatus('calibrating', 'Hold it…', events);
    }

    this.collectCalibration(f);
    if (t - this.calibStart >= this.opts.calibrateMs) {
      this.finishCalibration();
      this.activeSince = t;
      this.lastActivityT = t;
      this.stable = [];
      this.inPositionSince = null;
      this.setStatus('active', null, events);
      events.push({ type: 'ready' });
    }
  }

  private collectCalibration(f: PoseFrame): void {
    const s = this.calibSamples!;
    if (this.def.rep && !this.def.rep.perSide) {
      const m = this.def.rep.metric(f, this.metricCtx());
      if (m !== null && Number.isFinite(m)) s.metric.push(m);
    } else if (this.def.rep?.perSide) {
      for (const side of ['left', 'right'] as const) {
        const m = this.def.rep.perSide(f, side, this.metricCtx());
        if (m !== null && Number.isFinite(m)) s.metric.push(m);
      }
    }
    if (!this.def.horizontal) {
      s.upI.push(bodyUp(f, 'image'));
      s.upW.push(bodyUp(f, 'world'));
    }
    s.frames.push(f);
  }

  private finishCalibration(): void {
    const s = this.calibSamples!;
    const medianVec = (vs: Vec3[], fallback: Vec3): Vec3 =>
      vs.length
        ? normalize({ x: median(vs.map((v) => v.x)), y: median(vs.map((v) => v.y)), z: median(vs.map((v) => v.z)) })
        : fallback;
    const upImage = medianVec(s.upI, IMAGE_UP);
    const upWorld = medianVec(s.upW, WORLD_UP);
    const cal: Calibration = {
      // Guard against a wildly tilted estimate (e.g. calibrating mid-lean).
      up: {
        image: upImage.y < -0.8 ? upImage : IMAGE_UP,
        world: upWorld.y < -0.7 ? upWorld : WORLD_UP,
      },
      restMetric: s.metric.length ? median(s.metric) : null,
      base: {},
      done: true,
    };
    // True limb lengths while standing tall (see segments.ts), for depth-free angles.
    const segs = s.frames.map(measureSegments);
    for (const k of new Set(segs.flatMap((m) => Object.keys(m)))) {
      const values = segs.map((m) => m[k]).filter((v): v is number => Number.isFinite(v));
      if (values.length) cal.base[k] = median(values);
    }
    // Baselines are measured against the final "up" so rules compare like with like.
    for (const [key, fn] of Object.entries(this.def.calibrate ?? {})) {
      const values = s.frames.map((f) => fn(f, cal)).filter((v): v is number => v !== null && Number.isFinite(v));
      if (values.length) cal.base[key] = median(values);
    }
    this.cal = cal;
    this.calibSamples = null;
  }

  // ---------------------------------------------------------------------------------------
  // Reps

  private startValue(): number {
    const spec = this.def.rep!;
    const tol = spec.startTolerance ?? 12;
    const rest = this.cal.restMetric;
    if (rest === null || !Number.isFinite(rest)) return spec.start;
    // Only move the start toward the rest value, never past the target.
    const lo = spec.start - tol;
    const hi = spec.start + tol;
    return Math.max(lo, Math.min(hi, rest));
  }

  private progressOf(metric: number): number {
    const spec = this.def.rep!;
    const start = this.startValue();
    const span = start - spec.target;
    if (Math.abs(span) < 1e-9) return 0;
    return (start - metric) / span;
  }

  private leadTrack(): Track {
    let best = this.tracks[0];
    for (const tr of this.tracks) if (tr.progress > best.progress) best = tr;
    return best;
  }

  private processReps(f: PoseFrame, t: number, events: AnalyzerEvent[]): void {
    const spec = this.def.rep!;
    const mctx = this.metricCtx();

    for (const tr of this.tracks) {
      const metric = tr.side ? spec.perSide!(f, tr.side, mctx) : spec.metric(f, mctx);
      if (metric === null || !Number.isFinite(metric)) continue;
      const p = this.progressOf(metric);
      tr.metric = metric;
      tr.progress = p;
      for (const ev of tr.counter.update(p, t)) this.handleRepEvent(tr, ev, t, events);
      if (tr.cur && tr.counter.phase !== 'start') {
        if (p > tr.cur.peakProgress) {
          tr.cur.peakProgress = p;
          tr.cur.metricPeak = metric;
        }
      }
    }

    const inRep = this.tracks.filter((tr) => tr.cur && tr.counter.phase !== 'start');
    if (inRep.length === 0) {
      this.resetRules();
      this.checkIdle(t, events);
      return;
    }
    this.lastActivityT = t;
    this.idleEmitted = 0;

    const lead = inRep.reduce((a, b) => (b.progress > a.progress ? b : a));
    const ctx: RuleContext = {
      cal: this.cal,
      phase: lead.counter.phase,
      progress: lead.progress,
      metric: lead.metric,
      space: f.angleSpace,
    };

    // Per-rep trackers (min/max of helper metrics, used by rep rules).
    for (const [key, fn] of Object.entries(this.def.trackers ?? {})) {
      const v = fn(f, ctx);
      if (v === null || !Number.isFinite(v)) continue;
      for (const tr of inRep) {
        const a = (tr.cur!.agg[key] ??= { min: v, max: v });
        if (v < a.min) a.min = v;
        if (v > a.max) a.max = v;
      }
    }

    const repIndex = this.reps.length + 1;
    this.evaluateRules(f, ctx, t, (rule) => {
      for (const tr of inRep) tr.cur!.faults.set(rule.id, rule);
      events.push({ type: 'fault', cue: rule, repIndex, midRep: true });
    });
  }

  private handleRepEvent(tr: Track, ev: RepEvent, t: number, events: AnalyzerEvent[]): void {
    const spec = this.def.rep!;
    switch (ev.type) {
      case 'repStart':
        tr.cur = { agg: {}, metricPeak: tr.metric ?? NaN, peakProgress: tr.progress, faults: new Map() };
        this.resetRules();
        this.lastActivityT = t;
        events.push({ type: 'repStart' });
        break;
      case 'targetReached':
        break;
      case 'rep': {
        const rep = this.finishRep(tr, ev.window, true, ev.chained);
        tr.cur = null;
        if (rep) events.push({ type: 'rep', rep });
        break;
      }
      case 'partial': {
        const rep = this.finishRep(tr, ev.window, false, false);
        tr.cur = null;
        if (!rep) break;
        // Per-side: a partial right next to the other arm's rep (counted or not) is the same rep.
        const near = (r: RepResult | undefined) =>
          !!r && r.side !== tr.side && Math.abs(r.window.endT - ev.window.endT) < MERGE_WINDOW_MS;
        const last = this.reps[this.reps.length - 1];
        const lastPartial = this.partialReps[this.partialReps.length - 1];
        if (tr.side && near(last)) {
          this.addFault(last, spec.shallow);
          events.push({ type: 'fault', cue: spec.shallow, repIndex: last.index, midRep: false });
        } else if (tr.side && near(lastPartial)) {
          lastPartial.side = undefined;
        } else {
          this.partialReps.push(rep);
          events.push({ type: 'partial', rep });
        }
        break;
      }
      case 'noLockout': {
        const last = this.reps[this.reps.length - 1];
        if (spec.lockout && last && !last.faults.some((c) => c.id === spec.lockout!.id)) {
          this.addFault(last, spec.lockout);
          events.push({ type: 'fault', cue: spec.lockout, repIndex: last.index, midRep: false });
        }
        break;
      }
    }
  }

  private finishRep(tr: Track, window: RepWindow, counted: boolean, chained: boolean): RepResult | null {
    const spec = this.def.rep!;
    const cur = tr.cur ?? { agg: {}, metricPeak: tr.metric ?? NaN, peakProgress: 0, faults: new Map<string, Cue>() };
    const faults = new Map(cur.faults);
    const stats: RepStats = { window, metricPeak: cur.metricPeak, agg: cur.agg, side: tr.side };

    if (counted) {
      if (spec.ideal !== undefined && spec.depth && Number.isFinite(cur.metricPeak)) {
        const decreasing = spec.target < this.startValue();
        const short = decreasing ? cur.metricPeak > spec.ideal : cur.metricPeak < spec.ideal;
        if (short) faults.set(spec.depth.id, spec.depth);
      }
      if (spec.tempo) {
        const { minGoingMs, minReturningMs, cue } = spec.tempo;
        if ((minGoingMs && window.goingMs < minGoingMs) || (minReturningMs && window.returningMs < minReturningMs)) {
          faults.set(cue.id, cue);
        }
      }
      if (chained && spec.lockout) faults.set(spec.lockout.id, spec.lockout);
      for (const rule of this.def.repRules ?? []) {
        if (rule.check(stats, this.cal)) faults.set(rule.id, rule);
      }
    } else {
      faults.set(spec.shallow.id, spec.shallow);
    }

    const list = [...faults.values()];
    const rep: RepResult = {
      index: this.reps.length + 1,
      counted,
      score: scoreFaults(list),
      faults: list,
      window,
      metricPeak: cur.metricPeak,
      side: tr.side,
    };

    if (!counted) return rep;

    // Per-side: two arms finishing together are one rep.
    const last = this.reps[this.reps.length - 1];
    if (
      tr.side &&
      last &&
      last.side &&
      last.side !== tr.side &&
      !this.merged.has(last) &&
      Math.abs(last.window.endT - window.endT) < MERGE_WINDOW_MS
    ) {
      this.merged.add(last);
      for (const c of list) this.addFault(last, c);
      last.side = undefined;
      return null;
    }
    this.reps.push(rep);
    return rep;
  }

  private addFault(rep: RepResult, cue: Cue): void {
    if (rep.faults.some((c) => c.id === cue.id)) return;
    rep.faults.push(cue);
    rep.score = scoreFaults(rep.faults);
  }

  private checkIdle(t: number, events: AnalyzerEvent[]): void {
    if (this.reps.length === 0) return;
    const idleMs = t - this.lastActivityT;
    const due = (this.idleEmitted + 1) * this.opts.idleEveryMs;
    if (idleMs >= due) {
      this.idleEmitted++;
      events.push({ type: 'idle', seconds: Math.round(idleMs / 1000) });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Holds (plank)

  private processHold(f: PoseFrame, t: number, dt: number, events: AnalyzerEvent[]): void {
    const spec = this.def.hold!;
    const inPos = spec.inPosition(f, this.metricCtx());
    if (inPos) {
      this.holdOutSince = null;
      if (!this.holding) {
        this.holding = true;
        events.push({ type: 'holdStart' });
      }
    } else if (this.holding) {
      this.holdOutSince ??= t;
      if (t - this.holdOutSince > 600) {
        this.holding = false;
        this.resetRules();
        events.push({ type: 'holdPause' });
      }
    }
    if (!this.holding) return;

    this.holdMs += dt;
    const ctx: RuleContext = { cal: this.cal, phase: 'hold', progress: 0, metric: null, space: f.angleSpace };
    this.evaluateRules(f, ctx, t, (rule) => {
      const stat = this.holdFaults.get(rule.id) ?? { cue: rule, count: 0, ms: 0 };
      stat.count++;
      this.holdFaults.set(rule.id, stat);
      events.push({ type: 'fault', cue: rule, repIndex: 0, midRep: true });
    }, events);

    let major = false;
    for (const rule of this.def.rules) {
      if (!this.ruleStates.get(rule.id)?.active) continue;
      if (rule.severity === 'major') major = true;
      const stat = this.holdFaults.get(rule.id);
      if (stat) stat.ms += dt;
    }
    if (!major) this.goodHoldMs += dt;

    const ticks = Math.floor(this.holdMs / 10000);
    if (ticks > this.holdTicks) {
      this.holdTicks = ticks;
      events.push({ type: 'holdTick', seconds: ticks * 10 });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Form rules with persistence

  private resetRules(): void {
    for (const st of this.ruleStates.values()) {
      st.active = false;
      st.since = null;
      st.falseSince = null;
    }
  }

  private evaluateRules(
    f: PoseFrame,
    ctx: RuleContext,
    t: number,
    onActivate: (rule: FrameRule) => void,
    events?: AnalyzerEvent[],
  ): void {
    const defaultPhases: Phase[] = this.def.kind === 'hold' ? ['hold'] : ['going', 'target', 'returning'];
    for (const rule of this.def.rules) {
      let st = this.ruleStates.get(rule.id);
      if (!st) {
        st = { since: null, falseSince: null, active: false };
        this.ruleStates.set(rule.id, st);
      }
      const phases = rule.phases ?? defaultPhases;
      const applicable =
        (!rule.views || rule.views.includes(f.view)) &&
        phases.includes(ctx.phase) &&
        (rule.minProgress === undefined || ctx.progress >= rule.minProgress);
      const result = applicable ? rule.check(f, ctx) : false;
      if (result === null) continue; // can't judge this frame; keep state
      if (result) {
        st.falseSince = null;
        st.since ??= t;
        if (!st.active && t - st.since >= (rule.persistMs ?? 250)) {
          st.active = true;
          onActivate(rule);
        }
      } else {
        st.since = null;
        if (st.active) {
          st.falseSince ??= t;
          if (t - st.falseSince >= 300) {
            st.active = false;
            st.falseSince = null;
            events?.push({ type: 'faultCleared', cue: rule });
          }
        }
      }
    }
  }
}

export interface SetResult {
  exerciseId: ExerciseDef['id'];
  exerciseName: string;
  kind: ExerciseDef['kind'];
  startedAt: number;
  durationMs: number;
  target: number | null;
  reps: RepResult[];
  partialReps: RepResult[];
  holdMs: number;
  goodHoldMs: number;
  /** Faults ordered by how often they happened (reps affected, or activations for holds). */
  faults: { cue: Cue; count: number }[];
  /** 0..100 */
  formScore: number;
}

export function summarizeSet(a: WorkoutAnalyzer, opts: { startedAt: number; endT: number; target: number | null }): SetResult {
  const counts = new Map<string, { cue: Cue; count: number }>();
  if (a.def.kind === 'hold') {
    for (const [id, s] of a.holdFaults) counts.set(id, { cue: s.cue, count: s.count });
  } else {
    for (const rep of [...a.reps, ...a.partialReps]) {
      for (const cue of rep.faults) {
        const c = counts.get(cue.id) ?? { cue, count: 0 };
        c.count++;
        counts.set(cue.id, c);
      }
    }
  }
  const faults = [...counts.values()].sort(
    (x, y) => y.count - x.count || (x.cue.severity === 'major' ? -1 : 1) - (y.cue.severity === 'major' ? -1 : 1),
  );
  let formScore: number;
  if (a.def.kind === 'hold') {
    formScore = a.holdMs > 0 ? Math.round((100 * a.goodHoldMs) / a.holdMs) : 0;
  } else {
    formScore = a.reps.length ? Math.round(a.reps.reduce((s, r) => s + r.score, 0) / a.reps.length) : 0;
  }
  return {
    exerciseId: a.def.id,
    exerciseName: a.def.name,
    kind: a.def.kind,
    startedAt: opts.startedAt,
    durationMs: a.activeSince !== null ? Math.max(0, opts.endT - a.activeSince) : 0,
    target: opts.target,
    reps: [...a.reps],
    partialReps: [...a.partialReps],
    holdMs: a.holdMs,
    goodHoldMs: a.goodHoldMs,
    faults,
    formScore,
  };
}

/** Re-export for convenience. */
export type { RepPhase };
