export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec, s: number): Vec => vec(a.x * s, a.y * s);
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const dir = (rad: number): Vec => vec(Math.cos(rad), Math.sin(rad));
export const DEG = Math.PI / 180;

export function rotateAbout(p: Vec, c: Vec, rad: number): Vec {
  const cs = Math.cos(rad), sn = Math.sin(rad);
  const x = p.x - c.x, y = p.y - c.y;
  return vec(c.x + cs * x - sn * y, c.y + sn * x + cs * y);
}

/** Reflect p across the line through a and b. */
export function reflectAcross(p: Vec, a: Vec, b: Vec): Vec {
  const d = sub(b, a);
  const t = dot(sub(p, a), d) / dot(d, d);
  const foot = add(a, scale(d, t));
  return sub(scale(foot, 2), p);
}

/** Signed area (positive when counter-clockwise in a y-up frame). */
export function polygonArea(pts: Vec[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function polygonCentroid(pts: Vec[]): Vec {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cr = p.x * q.y - q.x * p.y;
    a += cr;
    cx += (p.x + q.x) * cr;
    cy += (p.y + q.y) * cr;
  }
  return vec(cx / (3 * a), cy / (3 * a));
}

export function bounds(pts: Vec[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Clip a polygon to a rectangle (Sutherland–Hodgman). */
export function clipToRect(pts: Vec[], r: Rect): Vec[] {
  const edges: [(p: Vec) => number][] = [
    [p => p.x - r.x], [p => r.x + r.w - p.x], [p => p.y - r.y], [p => r.y + r.h - p.y],
  ];
  let out = pts;
  for (const [inside] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const p = input[i], q = input[(i + 1) % input.length];
      const dp = inside(p), dq = inside(q);
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        out.push(vec(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t));
      }
    }
    if (out.length === 0) break;
  }
  return out;
}

export const insetRect =(r: Rect, d: number): Rect =>
  ({ x: r.x + d, y: r.y + d, w: Math.max(0, r.w - 2 * d), h: Math.max(0, r.h - 2 * d) });

export const rectContains = (r: Rect, p: Vec, eps = 1e-9): boolean =>
  p.x >= r.x - eps && p.x <= r.x + r.w + eps && p.y >= r.y - eps && p.y <= r.y + r.h + eps;

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 2D affine transform in canvas order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export interface Affine {
  a: number; b: number; c: number; d: number; e: number; f: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const applyAffine = (m: Affine, p: Vec): Vec =>
  vec(m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f);

/** m ∘ n: apply n first, then m. */
export function multiply(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

export const determinant = (m: Affine): number => m.a * m.d - m.b * m.c;
export const translation = (tx: number, ty: number): Affine => ({ ...IDENTITY, e: tx, f: ty });
export const scaling = (sx: number, sy = sx): Affine => ({ ...IDENTITY, a: sx, d: sy });
export function rotation(rad: number): Affine {
  const cs = Math.cos(rad), sn = Math.sin(rad);
  return { a: cs, b: sn, c: -sn, d: cs, e: 0, f: 0 };
}
/** Mirror across the vertical line x = x0. */
export const mirrorX = (x0: number): Affine => ({ a: -1, b: 0, c: 0, d: 1, e: 2 * x0, f: 0 });

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
