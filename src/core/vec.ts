/** Small, allocation-light 3D vector helpers. 2D maths just uses z = 0. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const RAD2DEG = 180 / Math.PI;
export const DEG2RAD = Math.PI / 180;

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const norm = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));
export const mid = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

export function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  return n > 1e-9 ? scale(a, 1 / n) : { x: 0, y: 0, z: 0 };
}

/** Unsigned angle between two vectors, in degrees (0..180). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const na = norm(a);
  const nb = norm(b);
  if (na < 1e-9 || nb < 1e-9) return NaN;
  const c = dot(a, b) / (na * nb);
  return Math.acos(Math.max(-1, Math.min(1, c))) * RAD2DEG;
}

/** Interior angle at vertex `b` formed by the segments b→a and b→c, in degrees. */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  return angleBetween(sub(a, b), sub(c, b));
}

/** Drop the z component (for image-plane geometry). */
export const flat = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: 0 });

/**
 * Signed perpendicular distance of point p from the infinite line a→b, measured in the
 * image plane (z ignored). Positive when p lies on the side the line's left-normal points to.
 */
export function signedDistanceToLine2D(p: Vec3, a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return 0;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/** Rotate `v` toward `toward` by `deg` degrees, within the plane the two vectors span. */
export function rotateToward(v: Vec3, toward: Vec3, deg: number): Vec3 {
  const u = normalize(v);
  let perp = sub(toward, scale(u, dot(toward, u)));
  if (norm(perp) < 1e-9) {
    // `toward` is parallel to v; pick any perpendicular direction.
    perp = Math.abs(u.x) < 0.9 ? cross(u, vec(1, 0, 0)) : cross(u, vec(0, 1, 0));
  }
  perp = normalize(perp);
  const r = deg * DEG2RAD;
  return add(scale(u, Math.cos(r) * norm(v)), scale(perp, Math.sin(r) * norm(v)));
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function median(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return NaN;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}
