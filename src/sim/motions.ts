/**
 * Parametric poses for each exercise. Each builder maps a normalised depth `d` (0 = start
 * position, 1 = full range) plus optional form faults to a set of 3D joints.
 */
import type { ExerciseId } from '../core/exercise';
import { add, normalize, rotateToward, scale, sub, vec, type Vec3 } from '../core/vec';
import { BODY, lerp, sagittal, smoothstep, solveTwoBone, type CoreJoints } from './skeleton';

export interface Faults {
  /** Knee collapse toward the midline at the bottom, metres. */
  valgus?: number;
  /** Upper-back rounding 0..1. */
  round?: number;
  /** Extra forward torso lean at the bottom, degrees. */
  lean?: number;
  /** Heel lift at the bottom, degrees. */
  heelLift?: number;
  /** Hip sag (+) or pike (−) as a fraction of body length. */
  sag?: number;
  /** Head drop, degrees below the line of the torso. */
  headDrop?: number;
  /** Elbow drifting forward, degrees of shoulder flexion at the top of a curl. */
  elbowDrift?: number;
  /** Torso swing (lean back), degrees. */
  swing?: number;
  /** One arm lags behind the other (0..1). */
  uneven?: number;
  /** Soft elbows at the top of a press, degrees of remaining elbow flexion. */
  softLockout?: number;
  /** Knees bending too much in a hinge (0..1 → squat-like). */
  kneesBent?: number;
  /** Hips stay over the ankles in a hinge (0..1). */
  hipsStay?: number;
  /** Feet don't jump out (0..1). */
  narrowFeet?: number;
  /** Lateral hip shift at the bottom, metres. */
  shift?: number;
}

export interface PoseParams {
  /** 0 = start position, 1 = full range of motion. */
  d: number;
  faults: Faults;
  /** Which leg leads (lunges) / which arm moves (alternating curls). */
  side?: 'left' | 'right';
  /** Lunge step progress 0..1. */
  step?: number;
  /** Per-arm depth for alternating curls. */
  dLeft?: number;
  dRight?: number;
  /** Slow drift for "breathing" in holds. */
  t?: number;
}

const X = vec(1, 0, 0);
const Y = vec(0, 1, 0);
const Z = vec(0, 0, 1);

interface Torso {
  lShoulder: Vec3;
  rShoulder: Vec3;
  head: Vec3;
  headForward: Vec3;
  headUp: Vec3;
  /** Unit torso axis (hips → shoulders). */
  axis: Vec3;
}

/** Torso from the hip midpoint: lean (deg, +forward), rounding 0..1, extra neck flexion. */
function buildTorso(hipMid: Vec3, lean: number, round = 0, neck = 0, lateral = 0): Torso {
  const axis = sagittal(lean + 12 * round, lateral);
  const shMid = add(hipMid, scale(axis, BODY.torso * (1 - 0.12 * round)));
  const neckDir = sagittal(lean + 12 + neck + 45 * round, lateral);
  const head = add(shMid, scale(neckDir, BODY.neck));
  const headForward = sagittal(lean + 12 + neck + 45 * round + 90);
  return {
    lShoulder: add(shMid, scale(X, BODY.shoulderHalf)),
    rShoulder: add(shMid, scale(X, -BODY.shoulderHalf)),
    head,
    headForward,
    headUp: neckDir,
    axis,
  };
}

interface Arm {
  elbow: Vec3;
  wrist: Vec3;
}

/** Arm from shoulder: upper-arm direction + elbow flexion toward `bendToward`. */
function armFK(shoulder: Vec3, upperDir: Vec3, flexDeg: number, bendToward: Vec3): Arm {
  const u = normalize(upperDir);
  const elbow = add(shoulder, scale(u, BODY.upperArm));
  const fore = rotateToward(u, bendToward, flexDeg);
  return { elbow, wrist: add(elbow, scale(normalize(fore), BODY.forearm)) };
}

/** Hands held together at the chest (goblet position). */
function gobletArms(t: Torso): { l: Arm; r: Arm } {
  const shMid = scale(add(t.lShoulder, t.rShoulder), 0.5);
  const chest = add(add(shMid, scale(t.axis, -0.18)), scale(Z, 0.22));
  const mk = (sh: Vec3, s: number): Arm => {
    const wrist = add(chest, scale(X, 0.04 * s));
    const pole = add(scale(t.axis, -1), scale(X, 0.6 * s));
    const elbow = solveTwoBone(sh, wrist, BODY.upperArm, BODY.forearm, pole);
    return { elbow, wrist };
  };
  return { l: mk(t.lShoulder, 1), r: mk(t.rShoulder, -1) };
}

/** Hands resting on the hips. */
function handsOnHips(t: Torso, lHip: Vec3, rHip: Vec3): { l: Arm; r: Arm } {
  const mk = (sh: Vec3, hip: Vec3, s: number): Arm => {
    const wrist = add(hip, vec(0.04 * s, 0.05, -0.02));
    const elbow = solveTwoBone(sh, wrist, BODY.upperArm, BODY.forearm, vec(s, 0, -0.4));
    return { elbow, wrist };
  };
  return { l: mk(t.lShoulder, lHip, 1), r: mk(t.rShoulder, rHip, -1) };
}

/** Arms hanging straight down (holding weights) regardless of torso angle. */
function hangingArms(t: Torso, forward = 0): { l: Arm; r: Arm } {
  const down = normalize(vec(0, -1, forward));
  const mk = (sh: Vec3, s: number): Arm => {
    const dir = normalize(add(down, scale(X, 0.04 * s)));
    const elbow = add(sh, scale(dir, BODY.upperArm));
    return { elbow, wrist: add(elbow, scale(dir, BODY.forearm)) };
  };
  return { l: mk(t.lShoulder, 1), r: mk(t.rShoulder, -1) };
}

interface Legs {
  lHip: Vec3;
  rHip: Vec3;
  lKnee: Vec3;
  rKnee: Vec3;
  lAnkle: Vec3;
  rAnkle: Vec3;
  lFoot: Vec3;
  rFoot: Vec3;
}

/** Symmetric legs built from the floor up: shin tilt, thigh angle, stance, knee collapse. */
function legsFromFloor(stanceHalf: number, shin: number, thigh: number, valgus = 0, shift = 0, toeOut = 12): Legs {
  const out: Partial<Legs> = {};
  for (const s of [1, -1] as const) {
    const ankle = vec(s * stanceHalf, BODY.ankleHeight, 0);
    const knee = add(ankle, scale(sagittal(shin), BODY.shin));
    const r = (thigh * Math.PI) / 180;
    const hip = add(knee, scale(vec(0, Math.cos(r), -Math.sin(r)), BODY.thigh));
    hip.x = s * BODY.hipHalf + shift;
    // Laterally the knee sits on the hip→ankle line, tracks out over the toes as it travels
    // forward, and valgus pulls it toward the midline.
    const onLine = ankle.x + (hip.x - ankle.x) * (BODY.shin / (BODY.shin + BODY.thigh));
    knee.x = onLine + s * (0.35 * Math.max(0, knee.z) - valgus);
    const t = (toeOut * Math.PI) / 180;
    const foot = vec(s * Math.sin(t), 0, Math.cos(t));
    if (s === 1) Object.assign(out, { lAnkle: ankle, lKnee: knee, lHip: hip, lFoot: foot });
    else Object.assign(out, { rAnkle: ankle, rKnee: knee, rHip: hip, rFoot: foot });
  }
  const legs = out as Legs;
  // Keep both hips at the same height/depth (rigid pelvis).
  const y = (legs.lHip.y + legs.rHip.y) / 2;
  const z = (legs.lHip.z + legs.rHip.z) / 2;
  legs.lHip.y = legs.rHip.y = y;
  legs.lHip.z = legs.rHip.z = z;
  return legs;
}

const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);

function assemble(legs: Legs, torso: Torso, arms: { l: Arm; r: Arm }, heelLift = 0): CoreJoints {
  return {
    lShoulder: torso.lShoulder,
    rShoulder: torso.rShoulder,
    lElbow: arms.l.elbow,
    rElbow: arms.r.elbow,
    lWrist: arms.l.wrist,
    rWrist: arms.r.wrist,
    lHip: legs.lHip,
    rHip: legs.rHip,
    lKnee: legs.lKnee,
    rKnee: legs.rKnee,
    lAnkle: legs.lAnkle,
    rAnkle: legs.rAnkle,
    head: torso.head,
    headForward: torso.headForward,
    headUp: torso.headUp,
    lFoot: legs.lFoot,
    rFoot: legs.rFoot,
    lHeelLift: heelLift,
    rHeelLift: heelLift,
  };
}

// ---- exercises ---------------------------------------------------------------------------

export function squatPose({ d, faults: f }: PoseParams): CoreJoints {
  const e = smoothstep(d);
  const heel = (f.heelLift ?? 0) * e;
  const shin = lerp(3, 32, d) + heel * 0.3;
  const thigh = lerp(2, 98, d);
  const legs = legsFromFloor(0.16, shin, thigh, (f.valgus ?? 0) * e, (f.shift ?? 0) * e);
  const hipMid = mid(legs.lHip, legs.rHip);
  const torso = buildTorso(hipMid, lerp(4, 36, d) + (f.lean ?? 0) * e, (f.round ?? 0) * e);
  return assemble(legs, torso, gobletArms(torso), heel);
}

export function rdlPose({ d, faults: f }: PoseParams): CoreJoints {
  const e = smoothstep(d);
  const bent = f.kneesBent ?? 0;
  const stay = f.hipsStay ?? 0;
  const shin = lerp(3, lerp(12, 34, bent), d) * (1 - stay);
  const thigh = lerp(0, lerp(22, 62, bent), d) * (1 - stay);
  const legs = legsFromFloor(0.13, shin, thigh, 0, 0, 8);
  const hipMid = mid(legs.lHip, legs.rHip);
  const lean = lerp(3, lerp(68, 50, bent), d);
  const torso = buildTorso(hipMid, lean, (f.round ?? 0) * e);
  return assemble(legs, torso, hangingArms(torso, 0.08));
}

export function lungePose({ d, faults: f, side = 'left', step = 1 }: PoseParams): CoreJoints {
  const e = smoothstep(d);
  const lead = side === 'left' ? 1 : -1;
  const pelvisZ = lerp(0, 0.33, step);
  const hipY = lerp(0.925, 0.83, step) - 0.33 * d;
  const pelvis = vec(0, hipY, pelvisZ);
  const lHip = add(pelvis, vec(BODY.hipHalf, 0, 0));
  const rHip = add(pelvis, vec(-BODY.hipHalf, 0, 0));
  const frontAnkle = (s: number) => vec(s * 0.12, BODY.ankleHeight, lerp(0, 0.7, step));
  const backAnkle = (s: number) => vec(s * 0.12, BODY.ankleHeight + 0.05 * step, 0);
  const lAnkle = lead === 1 ? frontAnkle(1) : backAnkle(1);
  const rAnkle = lead === -1 ? frontAnkle(-1) : backAnkle(-1);
  const pole = (s: number, front: boolean) => {
    const inward = front ? -(f.valgus ?? 0) * 6 * e * s : 0;
    return normalize(vec(inward, 0, 1));
  };
  const lKnee = solveTwoBone(lHip, lAnkle, BODY.thigh, BODY.shin, pole(1, lead === 1));
  const rKnee = solveTwoBone(rHip, rAnkle, BODY.thigh, BODY.shin, pole(-1, lead === -1));
  const legs: Legs = {
    lHip,
    rHip,
    lKnee,
    rKnee,
    lAnkle,
    rAnkle,
    lFoot: vec(0.1, 0, 1),
    rFoot: vec(-0.1, 0, 1),
  };
  const torso = buildTorso(pelvis, lerp(3, 8, d) + (f.lean ?? 0) * e);
  return assemble(legs, torso, handsOnHips(torso, lHip, rHip));
}

export function curlPose({ d, faults: f, dLeft, dRight }: PoseParams): CoreJoints {
  const legs = legsFromFloor(0.14, 2, 1, 0, 0, 10);
  const hipMid = mid(legs.lHip, legs.rHip);
  const dl = dLeft ?? d;
  const dr = dRight ?? d;
  const swing = -(f.swing ?? 0) * smoothstep(Math.max(dl, dr));
  const torso = buildTorso(hipMid, 2 + swing);
  const arm = (sh: Vec3, s: number, dd: number): Arm => {
    const drift = (f.elbowDrift ?? 0) * smoothstep(dd);
    const upper = rotateToward(normalize(add(scale(torso.axis, -1), scale(X, 0.1 * s))), Z, drift);
    const flex = lerp(12, 130, dd);
    return armFK(sh, upper, flex, add(Z, scale(Y, 0.2)));
  };
  return assemble(legs, torso, { l: arm(torso.lShoulder, 1, dl), r: arm(torso.rShoulder, -1, dr) });
}

export function pressPose({ d, faults: f }: PoseParams): CoreJoints {
  const legs = legsFromFloor(0.15, 2, 1, 0, 0, 10);
  const hipMid = mid(legs.lHip, legs.rHip);
  const torso = buildTorso(hipMid, 2 - (f.swing ?? 0) * smoothstep(d));
  const top = 1 - (f.softLockout ?? 0) / 100;
  const arm = (sh: Vec3, s: number, dd: number): Arm => {
    const abd = lerp(78, 170 * top + 120 * (1 - top), dd);
    const r = (abd * Math.PI) / 180;
    const upper = normalize(vec(s * Math.sin(r), -Math.cos(r), lerp(0.25, 0.05, dd)));
    const flex = lerp(98, f.softLockout ?? 4, dd);
    return armFK(sh, upper, flex, Y);
  };
  const lag = 1 - (f.uneven ?? 0) * Math.sin(Math.PI * Math.min(1, d));
  return assemble(legs, torso, { l: arm(torso.lShoulder, 1, d * lag), r: arm(torso.rShoulder, -1, d) });
}

export function jumpingJackPose({ d, faults: f }: PoseParams): CoreJoints {
  const e = smoothstep(d);
  const wide = lerp(0.42, 0.14, f.narrowFeet ?? 0);
  const legs = legsFromFloor(lerp(0.1, wide, e), 4, 3, 0, 0, 14);
  const hop = 0.05 * Math.sin(Math.PI * d);
  for (const k of ['lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle'] as const) legs[k] = add(legs[k], vec(0, hop, 0));
  // Straighten the legs outward: hips stay together, ankles spread.
  const hipMid = mid(legs.lHip, legs.rHip);
  const torso = buildTorso(hipMid, 2);
  const arm = (sh: Vec3, s: number): Arm => {
    const abd = lerp(12, 165, e);
    const r = (abd * Math.PI) / 180;
    const upper = normalize(vec(s * Math.sin(r), -Math.cos(r), 0.02));
    return armFK(sh, upper, 5, Y);
  };
  return assemble(legs, torso, { l: arm(torso.lShoulder, 1), r: arm(torso.rShoulder, -1) });
}

/** Floor exercises are built in the sagittal plane with the head toward +Z. */
function floorBody(shMid: Vec3, ankleMid: Vec3, f: Faults, kneeBend = 0): { legs: Legs; torso: Torso } {
  const body = sub(shMid, ankleMid);
  const len = Math.hypot(body.y, body.z);
  const along = normalize(body);
  // Normal pointing toward the floor.
  let n = vec(0, -along.z, along.y);
  if (n.y > 0) n = scale(n, -1);
  const hipOnLine = add(ankleMid, scale(body, (BODY.shin + BODY.thigh) / (BODY.shin + BODY.thigh + BODY.torso)));
  const hipMid = add(hipOnLine, scale(n, (f.sag ?? 0) * len));
  const kneeMid = add(mid(hipMid, ankleMid), scale(n, -kneeBend));
  const legs: Legs = {
    lHip: add(hipMid, vec(BODY.hipHalf, 0, 0)),
    rHip: add(hipMid, vec(-BODY.hipHalf, 0, 0)),
    lKnee: add(kneeMid, vec(0.11, 0, 0)),
    rKnee: add(kneeMid, vec(-0.11, 0, 0)),
    lAnkle: add(ankleMid, vec(0.1, 0, 0)),
    rAnkle: add(ankleMid, vec(-0.1, 0, 0)),
    // Toes point down into the floor.
    lFoot: vec(0, 0, -1),
    rFoot: vec(0, 0, -1),
  };
  const axis = normalize(sub(shMid, hipMid));
  const neckDir = normalize(rotateToward(axis, vec(0, -1, 0), 10 + (f.headDrop ?? 0)));
  const head = add(shMid, scale(neckDir, BODY.neck));
  const headForward = normalize(rotateToward(neckDir, vec(0, -1, 0), 90));
  const torso: Torso = {
    lShoulder: add(shMid, vec(BODY.shoulderHalf, 0, 0)),
    rShoulder: add(shMid, vec(-BODY.shoulderHalf, 0, 0)),
    head,
    headForward,
    headUp: neckDir,
    axis,
  };
  return { legs, torso };
}

export function pushupPose({ d, faults: f }: PoseParams): CoreJoints {
  const handZ = 0.6;
  const elbowAngle = lerp(166, 72, d);
  const foreTilt = lerp(0, -18, d);
  const upperTilt = foreTilt + (180 - elbowAngle);
  const wristY = 0.04;
  const arm = (s: number) => {
    const wrist = vec(s * 0.21, wristY, handZ);
    const elbow = add(wrist, scale(sagittal(foreTilt, s * 0.12 * d), BODY.forearm));
    const shoulder = add(elbow, scale(sagittal(upperTilt, -s * 0.05 * d), BODY.upperArm));
    return { wrist, elbow, shoulder };
  };
  const L = arm(1);
  const R = arm(-1);
  const shMid = vec(0, (L.shoulder.y + R.shoulder.y) / 2, (L.shoulder.z + R.shoulder.z) / 2);
  const ankleMid = vec(0, 0.1, handZ - 1.32);
  const { legs, torso } = floorBody(shMid, ankleMid, f);
  torso.lShoulder = vec(BODY.shoulderHalf, shMid.y, shMid.z);
  torso.rShoulder = vec(-BODY.shoulderHalf, shMid.y, shMid.z);
  return assemble(legs, torso, { l: { elbow: L.elbow, wrist: L.wrist }, r: { elbow: R.elbow, wrist: R.wrist } });
}

export function plankPose({ faults: f, t = 0 }: PoseParams): CoreJoints {
  const breathe = 0.006 * Math.sin(t * 1.3);
  const elbowZ = 0.55;
  const shMid = vec(0, 0.04 + BODY.upperArm + breathe, elbowZ);
  const ankleMid = vec(0, 0.1, elbowZ - 1.32);
  const { legs, torso } = floorBody(shMid, ankleMid, f);
  const arm = (s: number): Arm => {
    const elbow = vec(s * 0.17, 0.04, elbowZ);
    return { elbow, wrist: add(elbow, vec(-s * 0.05, 0, 0.25)) };
  };
  return assemble(legs, torso, { l: arm(1), r: arm(-1) });
}

export const POSE_BUILDERS: Record<ExerciseId, (p: PoseParams) => CoreJoints> = {
  squat: squatPose,
  pushup: pushupPose,
  lunge: lungePose,
  rdl: rdlPose,
  curl: curlPose,
  press: pressPose,
  jumping_jack: jumpingJackPose,
  plank: plankPose,
};
