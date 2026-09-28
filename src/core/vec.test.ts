import { describe, expect, it } from 'vitest';
import { angleAt, angleBetween, median, rotateToward, signedDistanceToLine2D, vec } from './vec';

describe('vector maths', () => {
  it('measures joint angles', () => {
    expect(angleAt(vec(0, 1), vec(0, 0), vec(1, 0))).toBeCloseTo(90);
    expect(angleAt(vec(-1, 0), vec(0, 0), vec(1, 0))).toBeCloseTo(180);
    expect(angleAt(vec(1, 1), vec(0, 0), vec(1, 0))).toBeCloseTo(45);
    expect(angleAt(vec(0, 0, 1), vec(0, 0, 0), vec(0, 1, 0))).toBeCloseTo(90);
  });

  it('returns NaN for degenerate vectors', () => {
    expect(angleBetween(vec(0, 0), vec(1, 0))).toBeNaN();
  });

  it('computes signed distance to a line', () => {
    const a = vec(0, 0);
    const b = vec(10, 0);
    expect(Math.abs(signedDistanceToLine2D(vec(5, 2), a, b))).toBeCloseTo(2);
    expect(Math.sign(signedDistanceToLine2D(vec(5, 2), a, b))).toBe(-Math.sign(signedDistanceToLine2D(vec(5, -2), a, b)));
  });

  it('rotates a vector toward another', () => {
    const r = rotateToward(vec(0, 1, 0), vec(1, 0, 0), 90);
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(0);
    const half = rotateToward(vec(0, 2, 0), vec(1, 0, 0), 45);
    expect(Math.hypot(half.x, half.y)).toBeCloseTo(2);
    expect(angleBetween(half, vec(0, 1, 0))).toBeCloseTo(45);
  });

  it('takes medians ignoring NaN', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([NaN, 5])).toBe(5);
    expect(median([])).toBeNaN();
  });
});
