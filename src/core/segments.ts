/**
 * Depth-free limb angles. A limb's vertical extent in the image, divided by its true length,
 * gives its tilt from vertical without any depth information. True lengths are measured while
 * the athlete stands tall at calibration (limbs vertical, so no foreshortening), then rescaled
 * by body width in case the athlete moves closer or further away.
 *
 * This matters because MediaPipe's 3D landmarks can be off by 10–20 cm in depth, which turns a
 * straight leg into a "158° knee" when the camera faces the athlete.
 */
import type { Calibration } from './exercise';
import type { PoseFrame } from './frame';
import { LM } from './landmarks';
import { RAD2DEG, dist, dot, sub, type Vec3 } from './vec';

export const SEGMENTS = {
  thigh_left: [LM.LEFT_HIP, LM.LEFT_KNEE],
  thigh_right: [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  shin_left: [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  shin_right: [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  upperArm_left: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  upperArm_right: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  forearm_left: [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  forearm_right: [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
} as const;

export type SegmentName = keyof typeof SEGMENTS;

const WIDTH_KEY = 'seg:width';
const key = (name: SegmentName) => `seg:${name}`;

/** Shoulder width + hip width in the image; constant while the athlete keeps facing one way. */
export function bodyWidth2D(f: PoseFrame): number | null {
  const need = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  if (!f.allVisible(need, 0.4)) return null;
  const w =
    Math.abs(f.img[LM.LEFT_SHOULDER].x - f.img[LM.RIGHT_SHOULDER].x) + Math.abs(f.img[LM.LEFT_HIP].x - f.img[LM.RIGHT_HIP].x);
  return w > 0.02 ? w : null;
}

/** 2D segment lengths (and body width) of one frame, keyed for Calibration.base. */
export function measureSegments(f: PoseFrame): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, [a, b]] of Object.entries(SEGMENTS) as [SegmentName, readonly [number, number]][]) {
    if (f.visible(a, 0.4) && f.visible(b, 0.4)) out[key(name)] = dist({ ...f.img[a], z: 0 }, { ...f.img[b], z: 0 });
  }
  const w = bodyWidth2D(f);
  if (w !== null) out[WIDTH_KEY] = w;
  return out;
}

/**
 * True length of a segment in the current frame's image units: the calibrated length, rescaled
 * by body width. Before calibration, the segment's live 2D length (fine for a standing athlete).
 */
export function segmentRef(f: PoseFrame, cal: Calibration, name: SegmentName): number | null {
  const [a, b] = SEGMENTS[name];
  const base = cal.base[key(name)];
  if (!cal.done || !Number.isFinite(base)) {
    if (!f.visible(a, 0.4) || !f.visible(b, 0.4)) return null;
    return dist({ ...f.img[a], z: 0 }, { ...f.img[b], z: 0 });
  }
  const w0 = cal.base[WIDTH_KEY];
  const w = bodyWidth2D(f);
  const scale = Number.isFinite(w0) && w !== null ? Math.min(1.5, Math.max(0.67, w / w0)) : 1;
  return base * scale;
}

/**
 * Angle (degrees) between segment from→to and direction `dir`, from the segment's extent
 * along `dir` only: acos(extent / trueLength). 0 = pointing along `dir`, 90 = perpendicular
 * (e.g. toward the camera), 180 = opposite.
 */
export function projectedAngle(f: PoseFrame, from: number, to: number, dir: Vec3, trueLength: number): number | null {
  if (!f.visible(from, 0.4) || !f.visible(to, 0.4) || trueLength <= 1e-6) return null;
  const v = sub(f.img[to], f.img[from]);
  const along = dot({ ...v, z: 0 }, { ...dir, z: 0 }) / trueLength;
  return Math.acos(Math.max(-1, Math.min(1, along))) * RAD2DEG;
}
