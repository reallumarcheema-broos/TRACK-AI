import { useMemo } from 'react';
import type { ExerciseId } from '../core/exercise';
import { LM } from '../core/landmarks';
import type { Vec3 } from '../core/vec';
import { POSE_BUILDERS } from '../sim/motions';
import { completeSkeleton } from '../sim/skeleton';

/** Pose (depth) and viewpoint that best illustrate each exercise. */
const ICON_POSE: Record<ExerciseId, { d: number; front: boolean }> = {
  squat: { d: 0.8, front: false },
  pushup: { d: 0.55, front: false },
  lunge: { d: 0.85, front: false },
  rdl: { d: 0.9, front: false },
  curl: { d: 0.85, front: true },
  press: { d: 0.95, front: true },
  jumping_jack: { d: 1, front: true },
  plank: { d: 0, front: false },
};

const LIMBS: [number, number][] = [
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

/** A stick-figure illustration generated from the same body model the demo athlete uses. */
export function ExerciseFigure({ id, className }: { id: ExerciseId; className?: string }) {
  const svg = useMemo(() => {
    const { d, front } = ICON_POSE[id];
    const pts = completeSkeleton(POSE_BUILDERS[id]({ d, faults: {}, step: 1, side: 'left' }));
    // Orthographic projection: side view uses (Z, Y), front view uses (−X, Y).
    const proj = (p: Vec3) => ({ x: front ? -p.x : p.z, y: -p.y });
    const P = pts.map(proj);
    const shoulders = { x: (P[LM.LEFT_SHOULDER].x + P[LM.RIGHT_SHOULDER].x) / 2, y: (P[LM.LEFT_SHOULDER].y + P[LM.RIGHT_SHOULDER].y) / 2 };
    const hips = { x: (P[LM.LEFT_HIP].x + P[LM.RIGHT_HIP].x) / 2, y: (P[LM.LEFT_HIP].y + P[LM.RIGHT_HIP].y) / 2 };
    const head = { x: (P[LM.LEFT_EAR].x + P[LM.RIGHT_EAR].x + 2 * P[LM.NOSE].x) / 4, y: (P[LM.LEFT_EAR].y + P[LM.RIGHT_EAR].y + 2 * P[LM.NOSE].y) / 4 };
    const used = [...LIMBS.flat().map((i) => P[i]), head, shoulders, hips];
    const xs = used.map((p) => p.x);
    const ys = used.map((p) => p.y);
    const pad = 0.16;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const size = Math.max(maxX - minX, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const vb = `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
    const stroke = size * 0.055;
    const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x.toFixed(3)} ${a.y.toFixed(3)}L${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
    const limbs = LIMBS.map(([a, b]) => seg(P[a], P[b])).join('');
    const spine = seg(hips, shoulders) + (front ? seg(P[LM.LEFT_SHOULDER], P[LM.RIGHT_SHOULDER]) + seg(P[LM.LEFT_HIP], P[LM.RIGHT_HIP]) : '');
    const floorY = Math.max(P[LM.LEFT_FOOT_INDEX].y, P[LM.RIGHT_FOOT_INDEX].y, P[LM.LEFT_ANKLE].y, P[LM.RIGHT_ANKLE].y) + stroke * 0.8;
    return { vb, stroke, limbs, spine, head, floorY, minX: cx - size / 2, size };
  }, [id]);

  return (
    <svg className={className} viewBox={svg.vb} role="img" aria-label="" aria-hidden="true">
      <line x1={svg.minX + svg.size * 0.08} x2={svg.minX + svg.size * 0.92} y1={svg.floorY} y2={svg.floorY} stroke="rgba(122,167,255,0.35)" strokeWidth={svg.stroke * 0.5} strokeLinecap="round" />
      <path d={svg.spine} stroke="#eef2f7" strokeWidth={svg.stroke * 1.15} strokeLinecap="round" fill="none" />
      <path d={svg.limbs} stroke="#3ef08a" strokeWidth={svg.stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx={svg.head.x} cy={svg.head.y} r={svg.stroke * 1.9} fill="#eef2f7" />
    </svg>
  );
}
