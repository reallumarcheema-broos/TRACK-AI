import type { PoseFrame } from '../core/frame';
import { DRAWN_JOINTS, LM, POSE_CONNECTIONS, SIDE } from '../core/landmarks';

export interface SkeletonStyle {
  /** Landmarks to paint as faulty (red). */
  faultJoints: ReadonlySet<number>;
  /** Stylised avatar (thicker limbs, head) for the camera-free demo. */
  avatar?: boolean;
  /** Pulse phase 0..1 for fault highlights. */
  pulse?: number;
}

const COLORS = {
  bone: 'rgba(255,255,255,0.9)',
  boneFar: 'rgba(255,255,255,0.35)',
  joint: '#e9b574',
  fault: '#ff5a45',
  avatar: '#c9d4e8',
  avatarFar: 'rgba(201,212,232,0.35)',
};

/** Draws the tracked skeleton onto a canvas whose pixels map 1:1 to the video frame. */
export function drawSkeleton(ctx: CanvasRenderingContext2D, f: PoseFrame, style: SkeletonStyle): void {
  const { width: w, height: h } = ctx.canvas;
  const px = (i: number) => ({ x: f.norm[i].x * w, y: f.norm[i].y * h });
  const scale = Math.min(w, h);
  const line = Math.max(3, scale * (style.avatar ? 0.022 : 0.009));
  const far = f.view === 'side' ? (f.near === 'left' ? SIDE.right : SIDE.left) : null;
  const farSet = new Set<number>(far ? Object.values(far) : []);
  const ok = (i: number) => f.vis[i] >= 0.35;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Far-side limbs first so the near side draws on top.
  const edges = [...POSE_CONNECTIONS].sort((a, b) => Number(farSet.has(b[0])) - Number(farSet.has(a[0])));
  for (const [a, b] of edges) {
    if (!ok(a) || !ok(b)) continue;
    if (a <= LM.MOUTH_RIGHT && b <= LM.MOUTH_RIGHT && style.avatar) continue; // face detail
    const pa = px(a);
    const pb = px(b);
    const isFar = farSet.has(a) || farSet.has(b);
    const faulty = style.faultJoints.has(a) || style.faultJoints.has(b);
    ctx.strokeStyle = faulty ? COLORS.fault : style.avatar ? (isFar ? COLORS.avatarFar : COLORS.avatar) : isFar ? COLORS.boneFar : COLORS.bone;
    ctx.lineWidth = faulty ? line * 1.25 : line;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  if (style.avatar && ok(LM.LEFT_EAR) && ok(LM.RIGHT_EAR) && ok(LM.NOSE)) {
    const le = px(LM.LEFT_EAR);
    const re = px(LM.RIGHT_EAR);
    const nose = px(LM.NOSE);
    const cx = (le.x + re.x + nose.x * 2) / 4;
    const cy = (le.y + re.y + nose.y * 2) / 4;
    ctx.fillStyle = COLORS.avatar;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }

  const pulse = 0.5 + 0.5 * Math.sin((style.pulse ?? 0) * Math.PI * 2);
  for (const i of DRAWN_JOINTS) {
    if (!ok(i) || (style.avatar && i === LM.NOSE)) continue;
    const p = px(i);
    const faulty = style.faultJoints.has(i);
    const r = line * (faulty ? 0.95 : 0.7);
    if (faulty) {
      ctx.fillStyle = `rgba(255,90,69,${0.25 + 0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (2.2 + pulse), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = faulty ? COLORS.fault : farSet.has(i) ? 'rgba(233,181,116,0.45)' : COLORS.joint;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Backdrop for the camera-free demo: a dark studio with a floor line under the athlete. */
export function drawDemoBackdrop(ctx: CanvasRenderingContext2D, f: PoseFrame | null): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#111827');
  g.addColorStop(1, '#0b0f17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!f) return;
  const feet = [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, LM.LEFT_WRIST, LM.RIGHT_WRIST];
  const floorY = Math.max(...feet.map((i) => f.norm[i].y)) * h + Math.min(w, h) * 0.01;
  ctx.strokeStyle = 'rgba(122,167,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(w, floorY);
  ctx.stroke();
  const shadow = ctx.createRadialGradient(w / 2, floorY, 0, w / 2, floorY, w * 0.35);
  shadow.addColorStop(0, 'rgba(62,240,138,0.08)');
  shadow.addColorStop(1, 'rgba(62,240,138,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, floorY - h * 0.1, w, h * 0.2);
}
