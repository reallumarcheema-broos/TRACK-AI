/**
 * The coach's brain: turns analyzer events into what to say and what to show, the way a
 * good trainer would — count every rep, correct faults the moment they happen (without
 * nagging), notice when form improves, and keep the athlete going to the end of the set.
 */
import type { AnalyzerSnapshot, RepResult } from '../core/analyzer';
import type { Cue, ExerciseDef } from '../core/exercise';
import { RECOGNIZER_HINTS, type SessionEvent } from '../exercises/recognizer';
import { countWord, Picker, PHRASES } from './phrases';
import { Priority, type VoiceQueue } from './voice';

export type Tone = 'good' | 'warn' | 'bad' | 'info';

export interface CoachLine {
  text: string;
  tone: Tone;
  at: number;
}

export interface SoundEffects {
  good(): void;
  warn(): void;
  tick(): void;
}

export interface CoachOptions {
  /** Target reps (or seconds for holds); 0/null = open-ended. */
  target: number | null;
  voice: VoiceQueue;
  sfx?: SoundEffects | null;
  rand?: () => number;
  onLine?: (line: CoachLine) => void;
}

/** Don't repeat the same correction more often than this. */
const FAULT_COOLDOWN_MS = 6000;
/** Minimum gap between any two corrections. */
const CORRECTION_GAP_MS = 1800;
/** Repeat an unchanged setup hint after this long. */
const HINT_REPEAT_MS = 8000;
/** Minimum gap between two different setup hints. */
const HINT_GAP_MS = 2500;
/** Hints that are too brief to be worth saying out loud, or that the coach has just said in other words. */
const SILENT_HINTS = new Set<string>(['Hold it…', RECOGNIZER_HINTS.start, RECOGNIZER_HINTS.keepGoing]);

const speakable = (s: string) => s.replace(/…/g, '.');

export class Coach {
  readonly lines: CoachLine[] = [];
  /** True once the target reps / hold time has been reached. */
  targetReached = false;

  private readonly picker: Picker;
  private readonly target: number | null;
  private readonly cooldown = new Map<string, number>();
  private readonly spokenThisRep = new Set<string>();
  private lastCorrectionAt = -Infinity;
  private hint: string | null = null;
  private hintSpoken: string | null = null;
  private hintSpokenAt = -Infinity;
  private cleanStreak = 0;
  private lastRepHadFault = false;
  private holdStarted = false;
  private countdownSaid = 0;
  private started = false;

  /**
   * `def` is null while the exercise is still being recognised; a `recognized` event sets it.
   */
  constructor(
    private def: ExerciseDef | null,
    private readonly opts: CoachOptions,
  ) {
    this.picker = new Picker(opts.rand);
    this.target = opts.target && opts.target > 0 ? opts.target : null;
  }

  get lastLine(): CoachLine | null {
    return this.lines[this.lines.length - 1] ?? null;
  }

  /** Feed every frame's analyzer output. `t` is in ms. */
  handle(events: SessionEvent[], snapshot: AnalyzerSnapshot, t: number): void {
    for (const e of events) this.onEvent(e, t);
    this.updateHint(snapshot, t);
    if (this.def?.kind === 'hold') this.updateHold(snapshot, t);
    this.opts.voice.tick();
  }

  private onEvent(e: SessionEvent, t: number): void {
    switch (e.type) {
      case 'watching':
        this.hint = null;
        this.say(this.picker.pick(PHRASES.watching), 'good', t, { priority: Priority.urgent, interrupt: true, ttlMs: 4000 });
        break;
      case 'recognized':
        this.onRecognized(e.def, e.reps, e.holdMs, t);
        break;
      case 'status':
        this.hint = e.status === 'active' ? null : e.hint;
        break;
      case 'ready':
        this.started = true;
        this.hint = null;
        if (!this.def || this.def.kind === 'hold') break; // holds are announced on holdStart
        this.say(
          this.picker.pick(this.target ? PHRASES.readyWithTarget(this.target, this.def.repNoun ?? 'reps') : PHRASES.ready),
          'good',
          t,
          { priority: Priority.urgent, interrupt: true, ttlMs: 4000 },
        );
        break;
      case 'repStart':
        this.spokenThisRep.clear();
        break;
      case 'fault':
        this.correct(e.cue, t);
        break;
      case 'rep':
        this.onRep(e.rep, t);
        break;
      case 'partial':
        this.onPartial(e.rep, t);
        break;
      case 'lost':
        this.say(this.picker.pick(PHRASES.lost), 'bad', t, { priority: Priority.urgent, interrupt: true, ttlMs: 4000 });
        break;
      case 'found':
        this.say(this.picker.pick(PHRASES.found), 'info', t, { priority: Priority.chatter, ttlMs: 2000 });
        break;
      case 'idle':
        this.say(
          this.picker.pick(e.seconds <= 12 ? PHRASES.idleFirst : PHRASES.idleLater),
          'info',
          t,
          { priority: Priority.guidance, ttlMs: 4000 },
        );
        break;
      case 'holdStart':
        this.say(
          this.picker.pick(this.holdStarted ? PHRASES.holdResume : PHRASES.holdReady(this.target)),
          'good',
          t,
          { priority: Priority.urgent, interrupt: true, ttlMs: 4000 },
        );
        this.holdStarted = true;
        this.started = true;
        break;
      case 'holdPause':
        if (!this.targetReached) {
          this.say(this.picker.pick(this.def?.hold?.lostCues ?? ['Get back into position']), 'bad', t, {
            priority: Priority.correction,
            interrupt: true,
          });
        }
        break;
      case 'holdTick':
        this.onHoldTick(e.seconds, t);
        break;
      case 'faultCleared':
        if (this.def?.kind === 'hold' && t - this.lastCorrectionAt > 1500) {
          this.say(this.picker.pick(['Better — hold it there.', "That's it, stay right there."]), 'good', t, {
            priority: Priority.chatter,
            ttlMs: 2000,
          });
        }
        break;
    }
  }

  // ---- reps ---------------------------------------------------------------------------------

  private onRep(rep: RepResult, t: number): void {
    const parts: string[] = [`${countWord(rep.index)}.`];
    let tone: Tone = 'good';
    let priority: Priority = Priority.count;

    if (this.target) {
      const left = this.target - rep.index;
      if (left <= 0 && !this.targetReached) {
        this.targetReached = true;
        parts.push(this.picker.pick(PHRASES.done));
        priority = Priority.urgent;
      } else if (left === 1) parts.push(this.picker.pick(PHRASES.lastOne));
      else if (left === 2) parts.push(this.picker.pick(PHRASES.twoLeft));
      else if (this.target >= 8 && rep.index === Math.floor(this.target / 2)) parts.push(this.picker.pick(PHRASES.halfway));
    }

    const faults = rep.faults;
    if (faults.length) {
      tone = faults.some((f) => f.severity === 'major') ? 'bad' : 'warn';
      // Faults judged after the rep (depth, tempo…) haven't been voiced yet.
      const unspoken = faults.filter((f) => !this.spokenThisRep.has(f.id)).sort(bySeverity);
      const next = unspoken.find((f) => this.canCorrect(f, t));
      if (next && !this.targetReached) {
        parts.push(this.picker.pick(next.cues));
        this.markCorrected(next, t);
      }
      this.cleanStreak = 0;
      this.lastRepHadFault = true;
      this.opts.sfx?.warn();
    } else {
      if (this.lastRepHadFault) parts.push(this.picker.pick(PHRASES.cleanAfterFault));
      else if (this.cleanStreak % 3 === 2) parts.push(this.picker.pick(this.def?.praise ?? PHRASES.streak));
      else if (this.cleanStreak >= 5 && this.cleanStreak % 5 === 0) parts.push(this.picker.pick(PHRASES.streak));
      this.cleanStreak++;
      this.lastRepHadFault = false;
      this.opts.sfx?.good();
    }

    this.say(parts.join(' '), tone, t, { priority, key: 'count', ttlMs: 2500 });
  }

  private onPartial(rep: RepResult, t: number): void {
    const cue = rep.faults.find((f) => f.id === this.def?.rep?.shallow.id) ?? rep.faults[0];
    this.cleanStreak = 0;
    this.lastRepHadFault = true;
    this.opts.sfx?.warn();
    if (!cue || !this.canCorrect(cue, t, 3500)) return;
    this.markCorrected(cue, t);
    this.say(this.picker.pick(cue.cues), 'bad', t, { priority: Priority.correction, key: 'correction', ttlMs: 2000 });
  }

  private correct(cue: Cue, t: number): void {
    if (this.targetReached || this.spokenThisRep.has(cue.id) || !this.canCorrect(cue, t)) return;
    this.markCorrected(cue, t);
    this.say(this.picker.pick(cue.cues), cue.severity === 'major' ? 'bad' : 'warn', t, {
      priority: Priority.correction,
      key: 'correction',
      ttlMs: 1500,
    });
  }

  private canCorrect(cue: Cue, t: number, cooldown = FAULT_COOLDOWN_MS): boolean {
    const last = this.cooldown.get(cue.id) ?? -Infinity;
    return t - last >= cooldown && t - this.lastCorrectionAt >= CORRECTION_GAP_MS;
  }

  private markCorrected(cue: Cue, t: number): void {
    this.cooldown.set(cue.id, t);
    this.lastCorrectionAt = t;
    this.spokenThisRep.add(cue.id);
  }

  // ---- recognising the exercise -------------------------------------------------------------

  /** "Squats — got it! That's two." The reps so far were counted while we worked it out. */
  private onRecognized(def: ExerciseDef, reps: number, holdMs: number, t: number): void {
    this.def = def;
    this.started = true;
    this.hint = null;
    let text: string;
    if (def.kind === 'hold') {
      this.holdStarted = holdMs > 0;
      text = `${def.name} — got it! The timer's running, hold it.`;
    } else {
      const noun = def.repNoun ?? def.name;
      const name = noun.charAt(0).toUpperCase() + noun.slice(1);
      text =
        reps > 0
          ? `${name} — got it! That's ${countWord(reps).toLowerCase()}.`
          : `${name} — got it. ${this.picker.pick(def.rep?.shallow.cues ?? PHRASES.ready)}`;
    }
    this.say(text, 'good', t, { priority: Priority.urgent, interrupt: true, key: 'count', ttlMs: 4000 });
  }

  // ---- holds --------------------------------------------------------------------------------

  private onHoldTick(seconds: number, t: number): void {
    if (this.targetReached) return;
    if (this.target && seconds >= this.target) return; // "Time!" is handled in updateHold
    if (this.target && this.target - seconds <= 5) return; // the countdown takes over
    let text = `${seconds} seconds.`;
    if (this.target && seconds === this.target / 2) text += ` ${this.picker.pick(PHRASES.halfway)}`;
    else if (seconds % 20 === 0) text += ' Keep breathing.';
    this.say(text, 'info', t, { priority: Priority.count, key: 'count', ttlMs: 2500 });
  }

  private updateHold(s: AnalyzerSnapshot, t: number): void {
    if (!this.target || this.targetReached || !s.holding) return;
    const remaining = this.target * 1000 - s.holdMs;
    if (remaining <= 0) {
      this.targetReached = true;
      this.say(this.picker.pick(PHRASES.holdDone), 'good', t, { priority: Priority.urgent, interrupt: true, ttlMs: 4000 });
      return;
    }
    // "Five, four, three, two, one" over the last five seconds.
    const idx = 5 - Math.ceil(remaining / 1000);
    if (remaining <= 5000 && idx >= this.countdownSaid && idx < 5) {
      this.countdownSaid = idx + 1;
      this.opts.sfx?.tick();
      this.say(PHRASES.countdown[idx], 'info', t, { priority: Priority.urgent, interrupt: true, key: 'count', ttlMs: 900 });
    }
  }

  // ---- setup hints --------------------------------------------------------------------------

  private updateHint(s: AnalyzerSnapshot, t: number): void {
    const hint = s.status === 'active' ? (this.started ? null : s.hint) : this.hint;
    if (!hint || SILENT_HINTS.has(hint)) return;
    const same = hint === this.hintSpoken;
    if (same && t - this.hintSpokenAt < HINT_REPEAT_MS) return;
    if (!same && t - this.hintSpokenAt < HINT_GAP_MS) return;
    this.hintSpoken = hint;
    this.hintSpokenAt = t;
    this.say(speakable(hint), 'info', t, { priority: Priority.guidance, key: 'hint', ttlMs: 3000 });
  }

  // ---- output -------------------------------------------------------------------------------

  private say(
    text: string,
    tone: Tone,
    t: number,
    opts: { priority: Priority; key?: string; ttlMs?: number; interrupt?: boolean },
  ): void {
    const line = { text, tone, at: t };
    this.lines.push(line);
    if (this.lines.length > 50) this.lines.shift();
    this.opts.onLine?.(line);
    this.opts.voice.speak(text, opts);
  }
}

const bySeverity = (a: Cue, b: Cue) => (a.severity === b.severity ? 0 : a.severity === 'major' ? -1 : 1);
