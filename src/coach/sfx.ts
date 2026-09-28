import type { SoundEffects } from './coach';

/**
 * Tiny synthesized feedback sounds (no audio files): a bright chime for a clean rep, a low
 * blip for a faulty one, and a tick for countdowns. Instant, even when speech is busy.
 */
export class WebAudioSfx implements SoundEffects {
  private ctx: AudioContext | null = null;

  /** Must be called from a user gesture (Start button) to satisfy autoplay policies. */
  unlock(): void {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx ??= new Ctor();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  good(): void {
    this.tone(880, 0.07, 'sine', 0.18);
    this.tone(1320, 0.12, 'sine', 0.16, 0.07);
  }

  warn(): void {
    this.tone(260, 0.16, 'triangle', 0.22);
  }

  tick(): void {
    this.tone(1000, 0.05, 'square', 0.08);
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
