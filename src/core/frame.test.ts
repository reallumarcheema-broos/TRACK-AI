import { describe, expect, it } from 'vitest';
import { simulate } from '../sim/simulator';
import { PoseFrame, ViewTracker } from './frame';

function settle(yaw: number, exercise: 'squat' | 'pushup' = 'squat'): PoseFrame {
  const frames = simulate({ exercise, yaw, reps: 0, leadInSeconds: 1.5, tailSeconds: 0, noise: 0.003 });
  const tracker = new ViewTracker();
  let last: PoseFrame | null = null;
  for (const fr of frames) {
    if (!fr.pose) continue;
    last = new PoseFrame(fr.pose, fr.t, fr.aspect);
    tracker.update(last);
  }
  return last!;
}

describe('ViewTracker', () => {
  it.each([
    [0, 'front'],
    [20, 'front'],
    [-25, 'front'],
    [45, 'diagonal'],
    [-50, 'diagonal'],
    [80, 'side'],
    [90, 'side'],
    [-90, 'side'],
  ] as const)('yaw %i° reads as %s', (yaw, view) => {
    expect(settle(yaw).view).toBe(view);
  });

  it('knows which way the athlete faces and which side is nearer the camera', () => {
    const right = settle(90);
    expect(right.facing).toBe(1);
    expect(right.near).toBe('right');
    const left = settle(-90);
    expect(left.facing).toBe(-1);
    expect(left.near).toBe('left');
  });

  it('classifies a side-on push-up (horizontal body) as a side view', () => {
    const f = settle(90, 'pushup');
    expect(f.view).toBe('side');
    expect(f.facing).toBe(1);
  });
});

describe('PoseFrame', () => {
  it('computes aspect-corrected image angles close to the 3D angle when side-on', () => {
    const f = settle(90);
    const img = f.kneeAngle('right', 'image');
    const world = f.kneeAngle('right', 'world');
    expect(Math.abs(img - world)).toBeLessThan(6);
    expect(img).toBeGreaterThan(165);
  });
});
