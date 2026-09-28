/**
 * A synthetic athlete: builds MediaPipe-format pose landmarks (normalised image + metric
 * world coordinates) from a handful of 3D joint positions. Used for unit tests and for the
 * camera-free demo mode.
 *
 * Ground frame: X = athlete's left, Y = up (floor at 0), Z = the athlete's forward.
 */
import { LANDMARK_COUNT, LM, type Landmark, type PoseInput } from '../core/landmarks';
import { add, cross, dist, dot, normalize, scale, sub, vec, type Vec3 } from '../core/vec';

export const BODY = {
  ankleHeight: 0.08,
  shin: 0.42,
  thigh: 0.43,
  hipHalf: 0.13,
  torso: 0.5,
  shoulderHalf: 0.19,
  neck: 0.17,
  upperArm: 0.29,
  forearm: 0.26,
} as const;

export interface CoreJoints {
  lShoulder: Vec3;
  rShoulder: Vec3;
  lElbow: Vec3;
  rElbow: Vec3;
  lWrist: Vec3;
  rWrist: Vec3;
  lHip: Vec3;
  rHip: Vec3;
  lKnee: Vec3;
  rKnee: Vec3;
  lAnkle: Vec3;
  rAnkle: Vec3;
  /** Midpoint between the ears. */
  head: Vec3;
  /** Direction the face points. */
  headForward: Vec3;
  /** Direction from chin to crown. */
  headUp: Vec3;
  /** Heel → toe direction for each foot (horizontal). */
  lFoot: Vec3;
  rFoot: Vec3;
  /** Heel lift in degrees for each foot. */
  lHeelLift?: number;
  rHeelLift?: number;
}

export interface CameraSetup {
  /** Frame size in pixels. */
  width: number;
  height: number;
  /** Vertical field of view, degrees. */
  fovY: number;
  /** Camera height above the floor, metres. */
  height_m: number;
  /** Distance from the camera to the athlete's ground origin, metres. */
  distance: number;
  /** Camera pitch (positive = tilted up), degrees. */
  pitch?: number;
  /** Horizontal offset of the athlete's ground origin, metres (camera x axis). */
  offsetX?: number;
}

export const PORTRAIT_CAMERA: CameraSetup = { width: 720, height: 1280, fovY: 68, height_m: 1.0, distance: 3.0 };
export const LANDSCAPE_FLOOR_CAMERA: CameraSetup = { width: 1280, height: 720, fovY: 42, height_m: 0.35, distance: 2.6 };

const UP: Vec3 = vec(0, 1, 0);

/** Fill in face, hand and foot landmarks around the core joints (ground frame). */
export function completeSkeleton(c: CoreJoints): Vec3[] {
  const p: Vec3[] = new Array(LANDMARK_COUNT);
  const F = normalize(c.headForward);
  const U = normalize(c.headUp);
  const L = normalize(cross(U, F)); // athlete's left
  const H = c.head;
  const at = (f: number, u: number, l: number) => add(H, add(scale(F, f), add(scale(U, u), scale(L, l))));

  p[LM.NOSE] = at(0.1, -0.01, 0);
  p[LM.LEFT_EYE_INNER] = at(0.085, 0.035, 0.015);
  p[LM.LEFT_EYE] = at(0.08, 0.035, 0.032);
  p[LM.LEFT_EYE_OUTER] = at(0.07, 0.035, 0.048);
  p[LM.RIGHT_EYE_INNER] = at(0.085, 0.035, -0.015);
  p[LM.RIGHT_EYE] = at(0.08, 0.035, -0.032);
  p[LM.RIGHT_EYE_OUTER] = at(0.07, 0.035, -0.048);
  p[LM.LEFT_EAR] = at(0, 0, 0.075);
  p[LM.RIGHT_EAR] = at(0, 0, -0.075);
  p[LM.MOUTH_LEFT] = at(0.085, -0.055, 0.024);
  p[LM.MOUTH_RIGHT] = at(0.085, -0.055, -0.024);

  p[LM.LEFT_SHOULDER] = c.lShoulder;
  p[LM.RIGHT_SHOULDER] = c.rShoulder;
  p[LM.LEFT_ELBOW] = c.lElbow;
  p[LM.RIGHT_ELBOW] = c.rElbow;
  p[LM.LEFT_WRIST] = c.lWrist;
  p[LM.RIGHT_WRIST] = c.rWrist;
  p[LM.LEFT_HIP] = c.lHip;
  p[LM.RIGHT_HIP] = c.rHip;
  p[LM.LEFT_KNEE] = c.lKnee;
  p[LM.RIGHT_KNEE] = c.rKnee;
  p[LM.LEFT_ANKLE] = c.lAnkle;
  p[LM.RIGHT_ANKLE] = c.rAnkle;

  const hand = (elbow: Vec3, wrist: Vec3, lateral: Vec3, iPinky: number, iIndex: number, iThumb: number) => {
    const d = normalize(sub(wrist, elbow));
    let side = sub(lateral, scale(d, dot(lateral, d)));
    side = normalize(side);
    p[iIndex] = add(wrist, scale(d, 0.09));
    p[iPinky] = add(wrist, add(scale(d, 0.075), scale(side, -0.025)));
    p[iThumb] = add(wrist, add(scale(d, 0.05), scale(side, 0.03)));
  };
  hand(c.lElbow, c.lWrist, L, LM.LEFT_PINKY, LM.LEFT_INDEX, LM.LEFT_THUMB);
  hand(c.rElbow, c.rWrist, scale(L, -1), LM.RIGHT_PINKY, LM.RIGHT_INDEX, LM.RIGHT_THUMB);

  const foot = (ankle: Vec3, dir: Vec3, lift: number, iHeel: number, iToe: number) => {
    const d = normalize({ x: dir.x, y: 0, z: dir.z });
    const toe = add(ankle, add(scale(d, 0.17), scale(UP, -0.06)));
    // Pivot around the ball of the foot: the heel rises with heel lift.
    const r = (lift * Math.PI) / 180;
    const heel = add(toe, add(scale(d, -0.23 * Math.cos(r)), scale(UP, 0.23 * Math.sin(r) + 0.01)));
    p[iToe] = toe;
    p[iHeel] = heel;
  };
  foot(c.lAnkle, c.lFoot, c.lHeelLift ?? 0, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX);
  foot(c.rAnkle, c.rFoot, c.rHeelLift ?? 0, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX);
  return p;
}

/** Deterministic PRNG (mulberry32) so tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface ProjectOptions {
  camera: CameraSetup;
  /** Athlete yaw: 0 = facing the camera, 90 = facing the frame's +x (right) side. */
  yaw: number;
  /** Pixel-ish noise: std-dev in normalised image units. */
  imageNoise?: number;
  /** World noise std-dev in metres. */
  worldNoise?: number;
  /**
   * Systematic per-landmark depth error added to world z (metres). MediaPipe's 3D landmarks
   * are least reliable in depth; a fixed bias per joint mimics that.
   */
  depthBias?: number[];
  rand?: () => number;
}

const LEFT_SIDE = new Set<number>([
  LM.LEFT_EYE_INNER, LM.LEFT_EYE, LM.LEFT_EYE_OUTER, LM.LEFT_EAR, LM.MOUTH_LEFT, LM.LEFT_SHOULDER, LM.LEFT_ELBOW,
  LM.LEFT_WRIST, LM.LEFT_PINKY, LM.LEFT_INDEX, LM.LEFT_THUMB, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HEEL,
  LM.LEFT_FOOT_INDEX,
]);
const RIGHT_SIDE = new Set<number>([
  LM.RIGHT_EYE_INNER, LM.RIGHT_EYE, LM.RIGHT_EYE_OUTER, LM.RIGHT_EAR, LM.MOUTH_RIGHT, LM.RIGHT_SHOULDER,
  LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_PINKY, LM.RIGHT_INDEX, LM.RIGHT_THUMB, LM.RIGHT_HIP, LM.RIGHT_KNEE,
  LM.RIGHT_ANKLE, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX,
]);

/**
 * Projects a ground-frame skeleton through a pinhole camera into MediaPipe's two
 * coordinate systems.
 */
export function project(points: Vec3[], opts: ProjectOptions): PoseInput {
  const { camera, yaw } = opts;
  const psi = (yaw * Math.PI) / 180;
  // Ground axes expressed in camera axes (x right, y down, z away from the camera).
  const fwd = vec(Math.sin(psi), 0, -Math.cos(psi));
  const left = vec(Math.cos(psi), 0, Math.sin(psi));
  const up = vec(0, -1, 0);
  const pitch = ((camera.pitch ?? 0) * Math.PI) / 180;
  const origin = vec(camera.offsetX ?? 0, camera.height_m, camera.distance);

  const toCam = (g: Vec3): Vec3 => {
    const rel = add(add(scale(left, g.x), scale(up, g.y)), scale(fwd, g.z));
    let p = add(rel, origin);
    if (pitch) {
      // Tilting the camera up rotates the scene down in camera coordinates.
      const c = Math.cos(pitch);
      const s = Math.sin(pitch);
      p = vec(p.x, c * p.y + s * p.z, -s * p.y + c * p.z);
    }
    return p;
  };

  const cam = points.map(toCam);
  const hipMid = scale(add(cam[LM.LEFT_HIP], cam[LM.RIGHT_HIP]), 0.5);
  const f = camera.height / 2 / Math.tan((camera.fovY * Math.PI) / 360);
  const rand = opts.rand ?? Math.random;
  const iNoise = opts.imageNoise ?? 0;
  const wNoise = opts.worldNoise ?? 0;

  // How much each side faces away from the camera (0 = toward, 1 = fully away).
  const leftAway = Math.max(0, Math.sin(psi));
  const rightAway = Math.max(0, -Math.sin(psi));
  const faceAway = Math.max(0, -Math.cos(psi));

  const image: Landmark[] = [];
  const world: Landmark[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = cam[i];
    const u = (f * p.x) / p.z + camera.width / 2;
    const v = (f * p.y) / p.z + camera.height / 2;
    const x = u / camera.width + gaussian(rand) * iNoise;
    const y = v / camera.height + gaussian(rand) * iNoise;
    const z = ((p.z - hipMid.z) * f) / (hipMid.z * camera.width);
    let visibility = 0.98;
    if (LEFT_SIDE.has(i)) visibility -= 0.38 * leftAway;
    if (RIGHT_SIDE.has(i)) visibility -= 0.38 * rightAway;
    if (i <= LM.MOUTH_RIGHT) visibility -= 0.3 * faceAway;
    if (x < 0 || x > 1 || y < 0 || y > 1) visibility = 0.05;
    image.push({ x, y, z, visibility });
    const w = sub(p, hipMid);
    world.push({
      x: w.x + gaussian(rand) * wNoise,
      y: w.y + gaussian(rand) * wNoise,
      z: w.z + gaussian(rand) * wNoise + (opts.depthBias?.[i] ?? 0),
      visibility,
    });
  }
  return { image, world };
}

// ---- kinematics helpers ----------------------------------------------------------------

/** Unit vector in the sagittal (Y-Z) plane at `deg` from vertical, tilted toward +Z. */
export function sagittal(deg: number, lateral = 0): Vec3 {
  const r = (deg * Math.PI) / 180;
  return normalize(vec(lateral, Math.cos(r), Math.sin(r)));
}

/**
 * Two-bone IK: finds the middle joint (knee/elbow) given both ends, the bone lengths and a
 * "pole" direction the joint should bend toward.
 */
export function solveTwoBone(root: Vec3, end: Vec3, l1: number, l2: number, pole: Vec3): Vec3 {
  const d0 = dist(root, end);
  const d = Math.min(Math.max(d0, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const u = normalize(sub(end, root));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let perp = sub(pole, scale(u, dot(pole, u)));
  if (Math.hypot(perp.x, perp.y, perp.z) < 1e-6) perp = vec(0, 0, 1);
  perp = normalize(perp);
  return add(add(root, scale(u, a)), scale(perp, h));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
