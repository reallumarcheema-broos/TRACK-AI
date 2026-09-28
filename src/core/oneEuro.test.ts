import { describe, expect, it } from 'vitest';
import { rng, gaussian } from '../sim/skeleton';
import { OneEuroFilter } from './oneEuro';

describe('OneEuroFilter', () => {
  it('passes the first sample through and converges on a constant', () => {
    const f = new OneEuroFilter(1, 0);
    expect(f.filter(5, 0)).toBe(5);
    let v = 0;
    for (let i = 1; i < 200; i++) v = f.filter(10, i * 33);
    expect(v).toBeCloseTo(10, 3);
  });

  it('reduces jitter on a noisy stationary signal', () => {
    const rand = rng(7);
    const f = new OneEuroFilter(1.5, 6);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 0.5 + gaussian(rand) * 0.01;
      raw.push(x);
      out.push(f.filter(x, i * 33));
    }
    const sd = (xs: number[]) => {
      const tail = xs.slice(50);
      const m = tail.reduce((a, b) => a + b, 0) / tail.length;
      return Math.sqrt(tail.reduce((a, b) => a + (b - m) ** 2, 0) / tail.length);
    };
    expect(sd(out)).toBeLessThan(sd(raw) * 0.6);
  });

  it('follows fast movements with little lag', () => {
    const f = new OneEuroFilter(1.5, 6);
    let v = 0;
    // A 0.4 unit move over ~300 ms (a brisk rep).
    for (let i = 0; i <= 30; i++) v = f.filter(Math.min(0.4, i * 0.04), i * 33);
    expect(v).toBeGreaterThan(0.37);
  });
});
