// Type 13 convex pentagon (Marjorie Rice, 1977) and its 2-isohedral tiling.
//
// Conditions: B = E = 90°, 2A + D = 360°, d = 2a = 2e.
// Side a joins E–A, b joins A–B, c joins B–C, d joins C–D, e joins D–E
// (so each angle is opposite the side two letters later: A↔d, B↔e, ...).
//
// With angle A fixed at 120° every angle except the right angles is 120° and,
// in units of the short side a = e = 1:
//   b = (3√3 − 1)/2 ≈ 2.098,  c = (√3 − 1)/2 ≈ 0.366,  d = 2.
//
// Tiling structure: every B corner is shared by four tiles — a tile, its two
// mirror images across the lines AB and BC, and its 180° rotation — forming a
// "B-quad". Quads come in two orientations 90° apart; one of each makes the
// 8-tile primitive cell, which repeats on a rectangular √6 × 3√6 lattice.
// Tiles meet non-edge-to-edge only where a d side is covered by a + e from two
// neighbours whose E corners meet at its midpoint.
//
// The lattice constants below were found by a brute-force tiling search and
// are checked by tests/tiling.test.ts (no overlaps, cell area = 8 tiles).
// They are specific to A = 120°.

import {
  DEG, Vec, add, dir, dot, polygonArea, reflectAcross, rotateAbout, scale, sub, vec,
} from './vec';

export const ANGLE_A_DEG = 120;
export const LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Prototile with a = e = 1 (so d = 2). Vertices in label order A..E. */
export function prototile(angleA = ANGLE_A_DEG): Vec[] {
  const E = vec(0, 0), A = vec(1, 0), D = vec(0, 1);
  const angleD = 360 - 2 * angleA;
  const C = add(D, scale(dir((270 + angleD) * DEG), 2));
  const u = dir((180 - angleA) * DEG);
  const B = add(A, scale(u, dot(sub(C, A), u)));
  return [A, B, C, D, E];
}

export interface CellTile {
  verts: Vec[]; // label order A..E
  role: number; // 0..7, position within the primitive cell
  mirrored: boolean;
}

const S3 = Math.sqrt(3), S6 = Math.sqrt(6);

export const CELL_W = S6;
export const CELL_H = 3 * S6;

function buildCell(): CellTile[] {
  const X = prototile();
  const [A, B, C] = X;
  const quad: [Vec[], boolean][] = [
    [X, false],
    [X.map(p => reflectAcross(p, A, B)), true],
    [X.map(p => reflectAcross(p, B, C)), true],
    [X.map(p => rotateAbout(p, B, Math.PI)), false],
  ];
  // Second quad: first quad turned 90° about B, then shifted.
  const offset = vec(S3 - 1.5, 3 + S3 / 2);
  const quad2: [Vec[], boolean][] = quad.map(([vs, m]) =>
    [vs.map(p => add(rotateAbout(p, B, Math.PI / 2), offset)), m]);

  // Lattice vectors in the prototile frame are √6·(cos15°, sin15°) and
  // 3√6·(−sin15°, cos15°). Rotate by −15° so they align with the x and y axes.
  const align = -15 * DEG;
  const origin = vec(0, 0);
  return [...quad, ...quad2].map(([vs, mirrored], role) => ({
    verts: vs.map(p => rotateAbout(p, origin, align)),
    role,
    mirrored,
  }));
}

/** The 8 tiles of one primitive cell, in a frame where the lattice is axis-aligned. */
export const CELL: readonly CellTile[] = buildCell();

/** Lattice translation vectors (in units of a). */
export const T1: Vec = vec(CELL_W, 0);
export const T2: Vec = vec(0, CELL_H);

export const TILE_AREA = Math.abs(polygonArea(prototile()));

/** Side lengths in units of a, keyed by side name. */
export function sideLengths(): Record<'a' | 'b' | 'c' | 'd' | 'e', number> {
  const [A, B, C, D, E] = prototile();
  const len = (p: Vec, q: Vec) => Math.hypot(q.x - p.x, q.y - p.y);
  return { a: len(E, A), b: len(A, B), c: len(B, C), d: len(C, D), e: len(D, E) };
}
