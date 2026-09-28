import type { Calibration } from '../core/exercise';
import { IMAGE_UP, type PoseFrame, type Space } from '../core/frame';
import { LM, SIDE, type BodySide, type SideJoints } from '../core/landmarks';
import { angleBetween, dist, dot, normalize, sub, type Vec3 } from '../core/vec';

type Part = keyof SideJoints;

const LEG: Part[] = ['hip', 'knee', 'ankle'];
const ARM: Part[] = ['shoulder', 'elbow', 'wrist'];

/** Landmarks needed to see a standing athlete head to toe. */
export function requiredFullBody(f: PoseFrame): number[] {
  if (f.view === 'side') {
    const j = SIDE[f.near];
    return [j.shoulder, j.hip, j.knee, j.ankle];
  }
  return [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];
}

/** Landmarks needed for upper-body exercises (curls, presses). */
export function requiredUpperBody(f: PoseFrame): number[] {
  if (f.view === 'side') {
    const j = SIDE[f.near];
    return [j.shoulder, j.elbow, j.wrist, j.hip];
  }
  return [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP];
}

/** Landmarks needed for floor exercises seen side-on (push-up, plank). */
export function requiredFloor(f: PoseFrame): number[] {
  const j = SIDE[f.near];
  return [j.shoulder, j.elbow, j.wrist, j.hip, j.ankle];
}

export const kneeAngle = (f: PoseFrame): number | null => f.bySide((s) => f.kneeAngle(s), LEG);
export const hipAngle = (f: PoseFrame): number | null => f.bySide((s) => f.hipAngle(s), ['shoulder', 'hip', 'knee']);
export const elbowAngle = (f: PoseFrame): number | null => f.bySide((s) => f.elbowAngle(s), ARM);

/** Smallest knee angle over both legs (lunges: both legs are visible even side-on). */
export function minKneeAngleBothLegs(f: PoseFrame): number | null {
  const values: number[] = [];
  for (const side of ['left', 'right'] as const) {
    if (!f.sideVisible(side, LEG, 0.3)) continue;
    values.push(f.kneeAngle(side));
  }
  return values.length ? Math.min(...values) : null;
}

export function upFor(cal: Calibration, space: Space): Vec3 {
  return space === 'image' ? cal.up.image : cal.up.world;
}

/** Torso angle from the calibrated vertical, in the frame's preferred space. */
export function torsoLean(f: PoseFrame, cal: Calibration, space: Space = f.angleSpace): number {
  return f.torsoLean(upFor(cal, space), space);
}

/** Thigh angle from vertical: 0 standing, 90 thigh parallel to the floor. */
export function thighAngle(f: PoseFrame, cal: Calibration): number | null {
  const space = f.angleSpace;
  const up = upFor(cal, space);
  return f.bySide((s) => {
    const j = SIDE[s];
    return f.segmentAngleFromUp(j.knee, j.hip, up, space);
  }, ['hip', 'knee']);
}

/** Shin angle from vertical (forward knee travel). */
export function shinAngle(f: PoseFrame, cal: Calibration): number | null {
  const space = f.angleSpace;
  const up = upFor(cal, space);
  return f.bySide((s) => {
    const j = SIDE[s];
    return f.segmentAngleFromUp(j.ankle, j.knee, up, space);
  }, ['knee', 'ankle']);
}

/**
 * How far the head/neck bends forward off the line of the torso, in degrees
 * (angle between hip→shoulder and shoulder→ear). A proxy for upper-back rounding.
 */
export function neckFlexion(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  if (!f.visible(j.ear, 0.4) || !f.visible(j.shoulder, 0.4) || !f.visible(j.hip, 0.4)) return null;
  const torso = sub(f.img[j.shoulder], f.img[j.hip]);
  const neck = sub(f.img[j.ear], f.img[j.shoulder]);
  return angleBetween({ ...torso, z: 0 }, { ...neck, z: 0 });
}

/** Shoulder–hip straight-line distance in the image (shrinks when the spine flexes, side-on). */
export function torsoChord(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  if (!f.visible(j.shoulder, 0.4) || !f.visible(j.hip, 0.4)) return null;
  return dist({ ...f.img[j.shoulder], z: 0 }, { ...f.img[j.hip], z: 0 });
}

/**
 * Signed foot pitch in degrees, positive when the heel is higher than the toes
 * (image space, side view).
 */
export function footPitch(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  if (!f.visible(j.heel, 0.4) || !f.visible(j.toe, 0.4)) return null;
  const h = f.img[j.heel];
  const t = f.img[j.toe];
  return (Math.atan2(t.y - h.y, Math.abs(t.x - h.x)) * 180) / Math.PI;
}

/** Knee separation / ankle separation along the body's lateral axis (front view). */
export function kneeAnkleRatio(f: PoseFrame): number | null {
  const need = [LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HIP, LM.RIGHT_HIP];
  if (!f.allVisible(need)) return null;
  const axis = normalize({ ...sub(f.img[LM.LEFT_HIP], f.img[LM.RIGHT_HIP]), z: 0 });
  const knee = dot(sub(f.img[LM.LEFT_KNEE], f.img[LM.RIGHT_KNEE]), axis);
  const ankle = dot(sub(f.img[LM.LEFT_ANKLE], f.img[LM.RIGHT_ANKLE]), axis);
  const hipW = dist(f.img[LM.LEFT_HIP], f.img[LM.RIGHT_HIP]);
  if (Math.abs(ankle) < 0.35 * hipW) return null; // feet too close together to judge
  return knee / ankle;
}

/**
 * Hip deviation from the straight shoulder→ankle (or knee) line, as a fraction of body length.
 * Positive = hips sagging toward the floor, negative = hips piked up. Side view, image space.
 */
export function bodyLineSag(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  if (!f.visible(j.shoulder, 0.4) || !f.visible(j.hip, 0.4)) return null;
  // Knee push-ups / kneeling: measure to the knee instead of the ankle.
  const kneeBent = f.visible(j.knee, 0.4) && f.visible(j.ankle, 0.4) && f.kneeAngle(side, 'image') < 130;
  const endIdx = kneeBent ? j.knee : j.ankle;
  if (!f.visible(endIdx, 0.4)) return null;
  const s = f.img[j.shoulder];
  const e = f.img[endIdx];
  const h = f.img[j.hip];
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  // Unit normal to the body line, oriented toward the floor (+y in image space).
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return ((h.x - s.x) * nx + (h.y - s.y) * ny) / len;
}

/** Angle of the shoulder→ankle line from horizontal (0 = lying flat, 90 = standing). */
export function bodyInclination(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  const end = f.visible(j.ankle, 0.35) ? j.ankle : f.visible(j.knee, 0.35) ? j.knee : null;
  if (end === null || !f.visible(j.shoulder, 0.35)) return null;
  const v = sub(f.img[end], f.img[j.shoulder]);
  return Math.abs(90 - angleBetween({ ...v, z: 0 }, IMAGE_UP));
}

/**
 * Head drop below the line of the torso, as a fraction of torso length (positive = the ear
 * hangs toward the floor). Used for push-ups and planks.
 */
export function headDrop(f: PoseFrame, side: BodySide = f.near): number | null {
  const j = SIDE[side];
  if (!f.visible(j.ear, 0.4) || !f.visible(j.shoulder, 0.4) || !f.visible(j.hip, 0.4)) return null;
  const hip = f.img[j.hip];
  const sh = f.img[j.shoulder];
  const ear = f.img[j.ear];
  const dx = sh.x - hip.x;
  const dy = sh.y - hip.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return ((ear.x - sh.x) * nx + (ear.y - sh.y) * ny) / len;
}

/** Height of the wrists above the shoulders along "up", in torso lengths (image space). */
export function pressHeight(f: PoseFrame, cal: Calibration, side: BodySide): number | null {
  const j = SIDE[side];
  if (!f.visible(j.shoulder) || !f.visible(j.wrist) || !f.visible(j.hip, 0.4)) return null;
  const torso = cal.base.torso2d || dist({ ...f.img[j.shoulder], z: 0 }, { ...f.img[j.hip], z: 0 });
  if (torso < 1e-6) return null;
  const rise = dot(sub(f.img[j.wrist], f.img[j.shoulder]), cal.up.image);
  return rise / torso;
}

/** Average press height over the visible arms (near arm only side-on). */
export function avgPressHeight(f: PoseFrame, cal: Calibration): number | null {
  if (f.view === 'side') return pressHeight(f, cal, f.near);
  const vals = (['left', 'right'] as const)
    .map((s) => pressHeight(f, cal, s))
    .filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Horizontal distance of the hips behind (−) or in front of (+) the ankles, in leg lengths. */
export function hipTravel(f: PoseFrame): number | null {
  const j = SIDE[f.near];
  if (!f.visible(j.hip, 0.4) || !f.visible(j.ankle, 0.4)) return null;
  const leg = dist(f.img[j.hip], f.img[j.knee]) + dist(f.img[j.knee], f.img[j.ankle]);
  if (leg < 1e-6) return null;
  return ((f.img[j.hip].x - f.img[j.ankle].x) * f.facing) / leg;
}

/** Ankle separation relative to hip width (front view). */
export function ankleSpread(f: PoseFrame): number | null {
  const need = [LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HIP, LM.RIGHT_HIP];
  if (!f.allVisible(need, 0.4)) return null;
  const hipW = Math.abs(f.img[LM.LEFT_HIP].x - f.img[LM.RIGHT_HIP].x);
  if (hipW < 1e-4) return null;
  return Math.abs(f.img[LM.LEFT_ANKLE].x - f.img[LM.RIGHT_ANKLE].x) / hipW;
}

/**
 * Knee collapse toward the midline relative to the hip→ankle line, in thigh lengths
 * (front view, image space). Positive = knee caving inward.
 */
export function kneeCollapse(f: PoseFrame, side: BodySide): number | null {
  const j = SIDE[side];
  if (!f.allVisible([j.hip, j.knee, j.ankle, LM.LEFT_HIP, LM.RIGHT_HIP])) return null;
  const hip = f.img[j.hip];
  const knee = f.img[j.knee];
  const ankle = f.img[j.ankle];
  const midX = (f.img[LM.LEFT_HIP].x + f.img[LM.RIGHT_HIP].x) / 2;
  const medial = Math.sign(midX - hip.x) || 1;
  const t = Math.abs(ankle.y - hip.y) > 1e-6 ? (knee.y - hip.y) / (ankle.y - hip.y) : 0.5;
  const lineX = hip.x + t * (ankle.x - hip.x);
  const thigh = dist(hip, knee);
  if (thigh < 1e-6) return null;
  return ((knee.x - lineX) * medial) / thigh;
}

export function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
