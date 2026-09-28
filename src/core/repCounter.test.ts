import { describe, expect, it } from 'vitest';
import { gaussian, rng } from '../sim/skeleton';
import { RepCounter, type RepEvent } from './repCounter';

/** Feeds a progress curve sampled at 30 fps and collects all events. */
function run(counter: RepCounter, curve: (t: number) => number, seconds: number, noise = 0, seed = 1): RepEvent[] {
  const rand = rng(seed);
  const events: RepEvent[] = [];
  for (let i = 0; i <= seconds * 30; i++) {
    const t = (i / 30) * 1000;
    events.push(...counter.update(curve(t / 1000) + gaussian(rand) * noise, t));
  }
  return events;
}

/** Reps of depth `depths[i]`, each `period` seconds, starting after 1 s. */
const reps =
  (depths: number[], period = 2) =>
  (t: number): number => {
    const k = Math.floor((t - 1) / period);
    if (t < 1 || k >= depths.length) return 0;
    const u = (t - 1 - k * period) / period;
    return depths[k] * Math.sin(Math.PI * u) ** 2;
  };

const count = (events: RepEvent[], type: RepEvent['type']) => events.filter((e) => e.type === type).length;

describe('RepCounter', () => {
  it('counts clean reps exactly', () => {
    const events = run(new RepCounter(), reps([1.4, 1.4, 1.4, 1.4, 1.4]), 13);
    expect(count(events, 'rep')).toBe(5);
    expect(count(events, 'partial')).toBe(0);
  });

  it('is robust to noise on the progress signal', () => {
    for (const seed of [1, 2, 3, 4]) {
      const events = run(new RepCounter(), reps([1.4, 1.3, 1.5, 1.4]), 11, 0.03, seed);
      expect(count(events, 'rep')).toBe(4);
      expect(count(events, 'noLockout')).toBe(0);
    }
  });

  it('reports shallow attempts as partial reps without counting them', () => {
    const counter = new RepCounter();
    const events = run(counter, reps([1.4, 0.8, 1.4]), 9);
    expect(counter.count).toBe(2);
    expect(count(events, 'partial')).toBe(1);
  });

  it('ignores tiny wiggles', () => {
    const events = run(new RepCounter(), reps([0.3, 0.45, 0.2]), 9);
    expect(count(events, 'rep')).toBe(0);
    expect(count(events, 'partial')).toBe(0);
  });

  it('measures the outbound and return halves of a rep', () => {
    const events = run(new RepCounter(), reps([1.5], 2), 4);
    const rep = events.find((e) => e.type === 'rep');
    expect(rep?.type).toBe('rep');
    if (rep?.type !== 'rep') return;
    expect(rep.window.goingMs).toBeGreaterThan(600);
    expect(rep.window.goingMs).toBeLessThan(1200);
    expect(rep.window.peak).toBeCloseTo(1.5, 1);
  });

  it('counts reps that never return to the start (chained) and flags them', () => {
    // Down to 1.5, up only to 0.7, down again, then full return.
    const curve = (t: number) => {
      if (t < 1) return 0;
      if (t < 2) return 1.5 * Math.sin((Math.PI / 2) * (t - 1));
      if (t < 3) return 1.5 - 0.8 * Math.sin(Math.PI * (t - 2));
      if (t < 4) return 1.5 * Math.cos((Math.PI / 2) * (t - 3));
      return 0;
    };
    const events = run(new RepCounter(), curve, 5);
    const done = events.filter((e) => e.type === 'rep');
    expect(done).toHaveLength(2);
    expect(done[0].type === 'rep' && done[0].chained).toBe(true);
  });

  it('emits noLockout when the next rep starts before fully returning', () => {
    // Return only to 0.2 (past exit, short of lockout) between reps.
    const curve = (t: number) => {
      if (t < 1 || t > 7) return 0;
      const u = ((t - 1) % 2) / 2;
      return 0.2 + 1.2 * Math.sin(Math.PI * u) ** 2;
    };
    const events = run(new RepCounter(), (t) => (t < 1.2 ? 0 : curve(t)), 8);
    expect(count(events, 'rep')).toBeGreaterThanOrEqual(3);
    expect(count(events, 'noLockout')).toBeGreaterThanOrEqual(2);
  });

  it('keeps counting when the athlete pauses at the bottom', () => {
    const curve = (t: number) => (t < 1 ? 0 : t < 2 ? t - 1 + 0.2 : t < 4 ? 1.2 + 0.05 * Math.sin(t * 20) : t < 5 ? 5 - t : 0);
    const counter = new RepCounter();
    run(counter, curve, 6);
    expect(counter.count).toBe(1);
  });
});
