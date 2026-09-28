import { LM, SIDE, type BodySide, type PoseInput, type SideJoints } from './landmarks';
import { angleAt, angleBetween, dist, mid, normalize, sub, type Vec3 } from './vec';

export type View = 'front' | 'side' | 'diagonal';
export type Space = 'image' | 'world';

export const VIS_THRESHOLD = 0.5;

/**
 * One analysed video frame. Image coordinates are aspect-corrected (x is scaled by
 * width/height) so that 2D angles and distances are geometrically meaningful; the unit is
 * "image heights". World coordinates are MediaPipe's metric 3D landmarks (y down).
 */
export class PoseFrame {
  readonly img: Vec3[];
  readonly world: Vec3[];
  readonly vis: number[];
  /** Raw normalised image coordinates (for in-frame checks and drawing). */
  readonly norm: Vec3[];

  view: View = 'front';
  /** +1 when the athlete's front (or head, when horizontal) points toward +x of the raw frame. */
  facing: 1 | -1 = 1;
  /** The body side closer to the camera — the reliable one in a side view. */
  near: BodySide = 'left';

  constructor(
    pose: PoseInput,
    readonly t: number,
    readonly aspect: number,
  ) {
    this.norm = pose.image.map((l) => ({ x: l.x, y: l.y, z: l.z }));
    this.img = pose.image.map((l) => ({ x: l.x * aspect, y: l.y, z: l.z * aspect }));
    this.world = pose.world.map((l) => ({ x: l.x, y: l.y, z: l.z }));
    this.vis = pose.image.map((l) => l.visibility);
  }

  p(i: number, space: Space): Vec3 {
    return space === 'image' ? this.img[i] : this.world[i];
  }

  /** Landmark is confidently detected and inside the frame. */
  visible(i: number, threshold = VIS_THRESHOLD): boolean {
    const n = this.norm[i];
    return this.vis[i] >= threshold && n.x >= -0.02 && n.x <= 1.02 && n.y >= -0.02 && n.y <= 1.02;
  }

  allVisible(indices: readonly number[], threshold = VIS_THRESHOLD): boolean {
    return indices.every((i) => this.visible(i, threshold));
  }

  visibleFraction(indices: readonly number[], threshold = VIS_THRESHOLD): number {
    if (indices.length === 0) return 1;
    return indices.filter((i) => this.visible(i, threshold)).length / indices.length;
  }

  mid(a: number, b: number, space: Space): Vec3 {
    return mid(this.p(a, space), this.p(b, space));
  }

  /** Space used for joint angles: the image plane is most precise side-on, 3D otherwise. */
  get angleSpace(): Space {
    return this.view === 'side' ? 'image' : 'world';
  }

  angle(a: number, b: number, c: number, space: Space = this.angleSpace): number {
    const s = space === 'image' ? this.img : this.world;
    if (space === 'image') {
      // Pure 2D angle in the image plane.
      return angleAt({ ...s[a], z: 0 }, { ...s[b], z: 0 }, { ...s[c], z: 0 });
    }
    return angleAt(s[a], s[b], s[c]);
  }

  j(side: BodySide): SideJoints {
    return SIDE[side];
  }

  sideVisible(side: BodySide, parts: (keyof SideJoints)[], threshold = VIS_THRESHOLD): boolean {
    const j = SIDE[side];
    return parts.every((p) => this.visible(j[p], threshold));
  }

  /**
   * Evaluates `fn` for the side(s) that can be trusted: the near side in a side view,
   * both sides averaged otherwise. Returns null when nothing can be measured.
   */
  bySide(fn: (side: BodySide) => number | null, parts: (keyof SideJoints)[]): number | null {
    if (this.view === 'side') {
      if (this.sideVisible(this.near, parts, 0.35)) return fn(this.near);
      return null;
    }
    const values: number[] = [];
    for (const side of ['left', 'right'] as const) {
      if (!this.sideVisible(side, parts)) continue;
      const v = fn(side);
      if (v !== null && Number.isFinite(v)) values.push(v);
    }
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /** Like bySide, but returns the extreme value across visible sides (e.g. the deeper knee). */
  extremeSide(
    fn: (side: BodySide) => number | null,
    parts: (keyof SideJoints)[],
    pick: 'min' | 'max',
  ): number | null {
    if (this.view === 'side') return this.bySide(fn, parts);
    const values: number[] = [];
    for (const side of ['left', 'right'] as const) {
      if (!this.sideVisible(side, parts)) continue;
      const v = fn(side);
      if (v !== null && Number.isFinite(v)) values.push(v);
    }
    if (values.length === 0) return null;
    return pick === 'min' ? Math.min(...values) : Math.max(...values);
  }

  // ---- common joint angles -------------------------------------------------------------

  kneeAngle(side: BodySide, space: Space = this.angleSpace): number {
    const j = SIDE[side];
    return this.angle(j.hip, j.knee, j.ankle, space);
  }

  hipAngle(side: BodySide, space: Space = this.angleSpace): number {
    const j = SIDE[side];
    return this.angle(j.shoulder, j.hip, j.knee, space);
  }

  elbowAngle(side: BodySide, space: Space = this.angleSpace): number {
    const j = SIDE[side];
    return this.angle(j.shoulder, j.elbow, j.wrist, space);
  }

  /** Angle between the upper arm and the torso (0 = arm hanging along the body). */
  shoulderAngle(side: BodySide, space: Space = this.angleSpace): number {
    const j = SIDE[side];
    return this.angle(j.hip, j.shoulder, j.elbow, space);
  }

  /** Upper-arm vs torso measured to the wrist — used for arm raises such as jumping jacks. */
  armRaiseAngle(side: BodySide, space: Space = this.angleSpace): number {
    const j = SIDE[side];
    return this.angle(j.hip, j.shoulder, j.wrist, space);
  }

  /** Angle of the segment a→b relative to an "up" direction (degrees, 0 = pointing up). */
  segmentAngleFromUp(a: number, b: number, up: Vec3, space: Space): number {
    const s = space === 'image' ? this.img : this.world;
    const v = sub(s[b], s[a]);
    return angleBetween(space === 'image' ? { ...v, z: 0 } : v, up);
  }

  /** Torso (hip midpoint → shoulder midpoint) angle from vertical. */
  torsoLean(up: Vec3, space: Space): number {
    const hip = this.mid(LM.LEFT_HIP, LM.RIGHT_HIP, space);
    const sh = this.mid(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, space);
    const v = sub(sh, hip);
    return angleBetween(space === 'image' ? { ...v, z: 0 } : v, up);
  }

  /** Height of the pose's bounding box in normalised image units (0..1). */
  get bodyHeight(): number {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < this.norm.length; i++) {
      if (this.vis[i] < 0.3) continue;
      lo = Math.min(lo, this.norm[i].y);
      hi = Math.max(hi, this.norm[i].y);
    }
    return hi > lo ? hi - lo : 0;
  }

  /** Length of the shoulder→hip segment in the image (aspect-corrected units). */
  get torsoLength2D(): number {
    return dist(this.mid(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, 'image'), this.mid(LM.LEFT_HIP, LM.RIGHT_HIP, 'image'));
  }
}

export const IMAGE_UP: Vec3 = { x: 0, y: -1, z: 0 };
export const WORLD_UP: Vec3 = { x: 0, y: -1, z: 0 };

/**
 * Tracks camera view (front / side / diagonal), facing direction and near side across
 * frames with smoothing + hysteresis, so rules don't flicker between modes.
 */
export class ViewTracker {
  private frontness: number | null = null;
  private facingScore = 0;
  private nearScore = 0;
  private view: View = 'front';
  private facing: 1 | -1 = 1;
  private near: BodySide = 'left';

  reset(): void {
    this.frontness = null;
    this.facingScore = 0;
    this.nearScore = 0;
  }

  /** Annotates the frame in place with view / facing / near side. */
  update(f: PoseFrame): void {
    const measured = ViewTracker.measureFrontness(f);
    if (measured !== null) {
      this.frontness = this.frontness === null ? measured : this.frontness + 0.2 * (measured - this.frontness);
      const s = this.frontness;
      if (this.view === 'front') {
        if (s < 0.3) this.view = 'side';
        else if (s < 0.52) this.view = 'diagonal';
      } else if (this.view === 'side') {
        if (s > 0.62) this.view = 'front';
        else if (s > 0.4) this.view = 'diagonal';
      } else {
        if (s > 0.62) this.view = 'front';
        else if (s < 0.3) this.view = 'side';
      }
    }

    const facing = ViewTracker.measureFacing(f);
    if (facing !== null) {
      this.facingScore += 0.25 * (facing - this.facingScore);
      if (this.facingScore > 0.15) this.facing = 1;
      else if (this.facingScore < -0.15) this.facing = -1;
    }

    const near = ViewTracker.measureNear(f);
    this.nearScore += 0.25 * (near - this.nearScore);
    if (this.nearScore > 0.05) this.near = 'left';
    else if (this.nearScore < -0.05) this.near = 'right';

    f.view = this.view;
    f.facing = this.facing;
    f.near = this.near;
  }

  /** ~1 when the shoulders/hips face the camera, ~0 when side-on (≈ |cos(yaw)|). */
  static measureFrontness(f: PoseFrame): number | null {
    const need = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
    if (!f.allVisible(need, 0.3)) return null;
    const torso = f.torsoLength2D;
    if (torso < 1e-3) return null;
    const sw = Math.abs(f.img[LM.LEFT_SHOULDER].x - f.img[LM.RIGHT_SHOULDER].x);
    const hw = Math.abs(f.img[LM.LEFT_HIP].x - f.img[LM.RIGHT_HIP].x);
    // Use widths relative to torso length, and fall back to the metric 3D yaw when the
    // torso is foreshortened (e.g. leaning toward the camera).
    const ratio2d = 0.5 * (sw / torso / 0.78) + 0.5 * (hw / torso / 0.5);
    const ws = sub(f.world[LM.LEFT_SHOULDER], f.world[LM.RIGHT_SHOULDER]);
    const wh = sub(f.world[LM.LEFT_HIP], f.world[LM.RIGHT_HIP]);
    const yawCos =
      0.5 * (Math.abs(ws.x) / Math.max(1e-6, Math.hypot(ws.x, ws.z))) +
      0.5 * (Math.abs(wh.x) / Math.max(1e-6, Math.hypot(wh.x, wh.z)));
    return Math.min(1.2, 0.6 * Math.min(ratio2d, 1.2) + 0.4 * yawCos);
  }

  /** Signed cue for which way the athlete faces in the raw frame (+ = toward +x). */
  static measureFacing(f: PoseFrame): number | null {
    let score = 0;
    let weight = 0;
    // Feet: toes point forward relative to heels.
    for (const side of ['left', 'right'] as const) {
      const j = SIDE[side];
      if (f.visible(j.heel, 0.3) && f.visible(j.toe, 0.3)) {
        const len = dist(f.img[j.heel], f.img[j.toe]);
        if (len > 1e-3) {
          score += (f.img[j.toe].x - f.img[j.heel].x) / len;
          weight += 1;
        }
      }
    }
    // Head: the nose sits in front of the ears.
    const earMid = f.mid(LM.LEFT_EAR, LM.RIGHT_EAR, 'image');
    if (f.visible(LM.NOSE, 0.3) && (f.visible(LM.LEFT_EAR, 0.3) || f.visible(LM.RIGHT_EAR, 0.3))) {
      const d = f.img[LM.NOSE].x - earMid.x;
      const s = Math.max(1e-3, f.torsoLength2D * 0.25);
      score += Math.max(-1, Math.min(1, d / s));
      weight += 1;
    }
    if (weight === 0) return null;
    return score / weight;
  }

  /** Positive when the left side looks closer to the camera. */
  static measureNear(f: PoseFrame): number {
    const parts: (keyof SideJoints)[] = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
    let visDiff = 0;
    let zDiff = 0;
    for (const p of parts) {
      visDiff += f.vis[SIDE.left[p]] - f.vis[SIDE.right[p]];
      zDiff += f.world[SIDE.left[p]].z - f.world[SIDE.right[p]].z;
    }
    visDiff /= parts.length;
    zDiff /= parts.length;
    // Smaller z = closer to the camera.
    return visDiff - 1.5 * zDiff;
  }
}

/** Unit "up" vector from the hips toward the shoulders; used to calibrate for phone tilt. */
export function bodyUp(f: PoseFrame, space: Space): Vec3 {
  const hip = f.mid(LM.LEFT_HIP, LM.RIGHT_HIP, space);
  const sh = f.mid(LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, space);
  const v = sub(sh, hip);
  return normalize(space === 'image' ? { ...v, z: 0 } : v);
}
