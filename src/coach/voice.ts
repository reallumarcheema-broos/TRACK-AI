/**
 * Speech output with priorities. Coaching lines compete for a single voice: a rep count
 * must not wait behind stale praise, and a correction is useless two reps later. The queue
 * logic is engine-agnostic so it can be tested without a browser.
 */

export const Priority = {
  /** Encouragement, small talk — dropped first. */
  chatter: 0,
  /** Setup guidance ("step back…"). */
  guidance: 1,
  /** Form corrections. */
  correction: 2,
  /** Rep counts and milestones. */
  count: 3,
  /** Must be heard: set complete, lost tracking. */
  urgent: 4,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export interface SpeakOptions {
  priority: Priority;
  /** Drop the line if it can't start within this many ms. */
  ttlMs?: number;
  /** Replace any queued line with the same key (e.g. only the latest rep count matters). */
  key?: string;
  /** Cut off a lower-priority line that is currently playing. */
  interrupt?: boolean;
}

export interface SpeechEngine {
  readonly available: boolean;
  speak(text: string, onDone: () => void): void;
  cancel(): void;
}

interface Item extends Required<Omit<SpeakOptions, 'key'>> {
  text: string;
  key?: string;
  at: number;
}

export class VoiceQueue {
  private queue: Item[] = [];
  private current: Item | null = null;
  private startedAt = 0;
  private seq = 0;
  muted = false;

  constructor(
    private readonly engine: SpeechEngine,
    private readonly now: () => number = () => performance.now(),
    /** Safety net for engines that forget to fire `onend` (Chrome, iOS). */
    private readonly watchdogMs = 8000,
  ) {}

  get speaking(): boolean {
    return this.current !== null;
  }

  get currentText(): string | null {
    return this.current?.text ?? null;
  }

  speak(text: string, opts: SpeakOptions): void {
    if (this.muted || !this.engine.available || !text.trim()) return;
    const item: Item = {
      text,
      key: opts.key,
      priority: opts.priority,
      ttlMs: opts.ttlMs ?? 3000,
      interrupt: opts.interrupt ?? false,
      at: this.now(),
    };
    this.checkWatchdog();
    if (!this.current) {
      this.play(item);
      return;
    }
    if (item.interrupt && item.priority > this.current.priority) {
      this.queue = this.queue.filter((q) => !(item.key && q.key === item.key));
      this.play(item, true);
      return;
    }
    if (item.key) this.queue = this.queue.filter((q) => q.key !== item.key);
    this.queue.push(item);
    // Highest priority first, then oldest first.
    this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
    // Never let the backlog grow: keep the three most important lines.
    this.queue.length = Math.min(this.queue.length, 3);
  }

  /** Stop talking and forget everything queued. */
  clear(): void {
    this.queue = [];
    this.current = null;
    this.seq++;
    this.engine.cancel();
  }

  /** Call periodically (e.g. every frame) to recover from engines that never report `end`. */
  tick(): void {
    this.checkWatchdog();
  }

  private checkWatchdog(): void {
    if (this.current && this.now() - this.startedAt > this.watchdogMs) {
      const id = this.seq;
      this.engine.cancel();
      this.finish(id);
    }
  }

  private play(item: Item, interrupting = false): void {
    const id = ++this.seq;
    if (interrupting) this.engine.cancel();
    this.current = item;
    this.startedAt = this.now();
    this.engine.speak(item.text, () => this.finish(id));
  }

  private finish(id: number): void {
    if (id !== this.seq) return; // a stale callback from an interrupted line
    this.current = null;
    const now = this.now();
    while (this.queue.length) {
      const next = this.queue.shift()!;
      if (now - next.at <= next.ttlMs) {
        this.play(next);
        return;
      }
    }
  }
}

// ---- Web Speech API adapter ------------------------------------------------------------

const PREFERRED_VOICES = [
  /samantha/i,
  /ava/i,
  /aria/i,
  /jenny/i,
  /google us english/i,
  /allison/i,
  /daniel/i,
  /karen/i,
  /serena/i,
  /moira/i,
  /english.*united states/i,
];

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredName?: string | null): SpeechSynthesisVoice | null {
  if (preferredName) {
    const named = voices.find((v) => v.name === preferredName);
    if (named) return named;
  }
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice): number => {
    const i = PREFERRED_VOICES.findIndex((re) => re.test(v.name));
    let s = i === -1 ? 0 : 100 - i;
    if (/premium|enhanced|natural|neural/i.test(v.name)) s += 30;
    if (v.localService) s += 10; // lower latency
    if (v.lang.toLowerCase() === 'en-us') s += 5;
    if (v.default) s += 2;
    return s;
  };
  return english.sort((a, b) => score(b) - score(a))[0] ?? voices[0] ?? null;
}

export class WebSpeechEngine implements SpeechEngine {
  voice: SpeechSynthesisVoice | null = null;
  rate = 1.05;
  pitch = 1;
  volume = 1;
  private keepAlive: number | null = null;

  constructor(private preferredVoice: string | null = null) {
    if (!this.available) return;
    const load = () => {
      this.voice = pickVoice(speechSynthesis.getVoices(), this.preferredVoice);
    };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  get available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  setVoice(name: string | null): void {
    this.preferredVoice = name;
    this.voice = pickVoice(speechSynthesis.getVoices(), name);
  }

  /** iOS only allows speech after a user gesture: call this from the Start button. */
  unlock(): void {
    if (!this.available) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  speak(text: string, onDone: () => void): void {
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? 'en-US';
    u.rate = this.rate;
    u.pitch = this.pitch;
    u.volume = this.volume;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.stopKeepAlive();
      onDone();
    };
    u.onend = finish;
    u.onerror = finish;
    // Chrome occasionally leaves the queue paused; resume() is harmless otherwise.
    speechSynthesis.resume();
    speechSynthesis.speak(u);
    this.startKeepAlive();
  }

  cancel(): void {
    this.stopKeepAlive();
    if (this.available) speechSynthesis.cancel();
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    // Chrome stops long utterances after ~15 s unless nudged.
    this.keepAlive = window.setInterval(() => {
      if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10000);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive !== null) {
      window.clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }
}

/** Silent engine for tests, SSR and browsers without speech. */
export class NullEngine implements SpeechEngine {
  readonly available = false;
  speak(_text: string, onDone: () => void): void {
    onDone();
  }
  cancel(): void {}
}
