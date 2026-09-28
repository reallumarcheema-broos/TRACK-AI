/**
 * Rep counting as a hysteresis state machine over a normalised progress signal:
 * p = 0 at the start position (standing tall, arms extended…) and p = 1 when the rep has
 * reached the required range of motion (squat depth, chest near the floor…).
 *
 *   start ──p≥enter──▶ going ──p≥target──▶ target ──p<target──▶ returning ──p≤exit──▶ start (+1 rep)
 *                        │                                          │
 *                        └──p≤exit (never reached target)──▶ start (partial rep, not counted)
 *
 * It also detects reps that never return to the start position before the next one begins
 * ("no lockout"), and reps chained without returning past the exit threshold.
 */

export type RepPhase = 'start' | 'going' | 'target' | 'returning';

export interface RepCounterConfig {
  /** Progress above which a rep attempt begins. */
  enter: number;
  /** Progress below which a rep attempt ends. */
  exit: number;
  /** Progress that counts as full range of motion. */
  target: number;
  /** Minimum peak progress for an aborted attempt to be reported as a partial rep. */
  partialMin: number;
  /** Progress the athlete should return below between reps (full lockout). */
  lockout: number;
  /** Rise from a mid-rep trough that means a new rep started without returning. */
  rebound: number;
  /** Reps faster than this are treated as noise. */
  minRepMs: number;
}

export const DEFAULT_REP_CONFIG: RepCounterConfig = {
  enter: 0.35,
  exit: 0.25,
  target: 1,
  partialMin: 0.55,
  lockout: 0.12,
  rebound: 0.25,
  minRepMs: 300,
};

export interface RepWindow {
  /** When the athlete started moving out of the start position. */
  startT: number;
  /** When the deepest point of the rep was reached. */
  peakT: number;
  endT: number;
  /** Maximum progress reached during the rep. */
  peak: number;
  /** Duration of the outbound half (e.g. squat descent). */
  goingMs: number;
  /** Duration of the return half (e.g. squat ascent). */
  returningMs: number;
}

export type RepEvent =
  | { type: 'repStart'; t: number }
  | { type: 'targetReached'; t: number }
  | { type: 'rep'; window: RepWindow; chained: boolean }
  | { type: 'partial'; window: RepWindow }
  /** The previous counted rep never returned fully to the start position. */
  | { type: 'noLockout'; t: number };

interface Attempt {
  startT: number;
  peak: number;
  peakT: number;
  trough: number;
  troughT: number;
  reachedTarget: boolean;
  /** Previous rep didn't lock out; reported once this attempt proves to be a real rep. */
  pendingNoLockout: boolean;
}

export class RepCounter {
  readonly cfg: RepCounterConfig;
  phase: RepPhase = 'start';
  count = 0;
  partials = 0;
  /** Latest progress value fed in. */
  progress = 0;

  private attempt: Attempt | null = null;
  private restMin = Infinity;
  private onsetT = 0;
  private awaitingLockout = false;

  constructor(cfg: Partial<RepCounterConfig> = {}) {
    this.cfg = { ...DEFAULT_REP_CONFIG, ...cfg };
  }

  reset(): void {
    this.phase = 'start';
    this.attempt = null;
    this.restMin = Infinity;
    this.awaitingLockout = false;
  }

  update(p: number, t: number): RepEvent[] {
    const c = this.cfg;
    const events: RepEvent[] = [];
    this.progress = p;

    switch (this.phase) {
      case 'start': {
        if (p <= c.lockout) this.awaitingLockout = false;
        // Movement onset = last moment we were near the resting minimum.
        if (p < this.restMin) this.restMin = p;
        if (p <= this.restMin + 0.05) this.onsetT = t;
        if (p >= c.enter) {
          this.beginAttempt(p, t, this.onsetT, this.awaitingLockout);
          this.awaitingLockout = false;
          events.push({ type: 'repStart', t });
          if (p >= c.target) this.reachTarget(t, events);
        }
        break;
      }
      case 'going': {
        const a = this.attempt!;
        this.trackPeak(a, p, t);
        if (p >= c.target) {
          this.reachTarget(t, events);
        } else if (p <= c.exit) {
          if (a.peak >= c.partialMin && t - a.startT >= c.minRepMs) {
            this.partials++;
            this.flushNoLockout(a, t, events);
            events.push({ type: 'partial', window: this.window(a, t) });
            this.awaitingLockout = false;
          } else {
            // Noise or a tiny wiggle: restore any pending lockout check.
            this.awaitingLockout = a.pendingNoLockout;
          }
          this.toStart(p, t);
        }
        break;
      }
      case 'target': {
        const a = this.attempt!;
        this.trackPeak(a, p, t);
        if (p < c.target) {
          this.phase = 'returning';
          a.trough = p;
          a.troughT = t;
        }
        break;
      }
      case 'returning': {
        const a = this.attempt!;
        if (p < a.trough) {
          a.trough = p;
          a.troughT = t;
        }
        // Came well back up (≥40% of the way from the deepest point) but not all the way?
        const cameBack = a.trough < c.target && a.trough <= 0.6 * a.peak;
        if (p <= c.exit) {
          this.completeRep(a, t, false, events);
          this.toStart(p, t);
          this.awaitingLockout = p > c.lockout;
        } else if (cameBack && (p - a.trough >= c.rebound || (p >= c.target && p - a.trough >= 0.1))) {
          // …then went down again: count it as a chained rep and begin the next one.
          this.completeRep(a, a.troughT, true, events);
          this.beginAttempt(p, t, a.troughT, false);
          events.push({ type: 'repStart', t });
          if (p >= c.target) this.reachTarget(t, events);
        } else if (p >= c.target) {
          // Dropped back into the bottom (pause / bounce) — same rep.
          this.phase = 'target';
          this.trackPeak(a, p, t);
        }
        break;
      }
    }
    return events;
  }

  private beginAttempt(p: number, t: number, startT: number, pendingNoLockout: boolean): void {
    this.attempt = {
      startT,
      peak: p,
      peakT: t,
      trough: p,
      troughT: t,
      reachedTarget: false,
      pendingNoLockout,
    };
    this.phase = 'going';
  }

  private reachTarget(t: number, events: RepEvent[]): void {
    const a = this.attempt!;
    this.phase = 'target';
    if (!a.reachedTarget) {
      a.reachedTarget = true;
      this.flushNoLockout(a, t, events);
      events.push({ type: 'targetReached', t });
    }
  }

  private flushNoLockout(a: Attempt, t: number, events: RepEvent[]): void {
    if (a.pendingNoLockout) {
      a.pendingNoLockout = false;
      events.push({ type: 'noLockout', t });
    }
  }

  private trackPeak(a: Attempt, p: number, t: number): void {
    if (p > a.peak) {
      a.peak = p;
      a.peakT = t;
    }
  }

  private completeRep(a: Attempt, endT: number, chained: boolean, events: RepEvent[]): void {
    if (endT - a.startT < this.cfg.minRepMs) return;
    this.count++;
    events.push({ type: 'rep', window: this.window(a, endT), chained });
  }

  private window(a: Attempt, endT: number): RepWindow {
    return {
      startT: a.startT,
      peakT: a.peakT,
      endT,
      peak: a.peak,
      goingMs: Math.max(0, a.peakT - a.startT),
      returningMs: Math.max(0, endT - a.peakT),
    };
  }

  private toStart(p: number, t: number): void {
    this.phase = 'start';
    this.attempt = null;
    this.restMin = p;
    this.onsetT = t;
  }
}
