import { describe, expect, it } from 'vitest';
import { CELL, CELL_H, CELL_W, TILE_AREA, prototile, sideLengths } from '../src/geometry/type13';
import { Vec, polygonArea } from '../src/geometry/vec';

const EPS = 1e-7;

/** Separating-axis test for convex polygons; touching edges do not count as overlap. */
function overlaps(P: Vec[], Q: Vec[]): boolean {
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const n = { x: -(q.y - p.y), y: q.x - p.x };
      const l = Math.hypot(n.x, n.y);
      const proj = (pts: Vec[]) => pts.map(v => (v.x * n.x + v.y * n.y) / l);
      const a = proj(P), b = proj(Q);
      if (Math.max(...a) <= Math.min(...b) + EPS || Math.max(...b) <= Math.min(...a) + EPS) return false;
    }
  }
  return true;
}

function angleAt(pts: Vec[], i: number): number {
  const p = pts[i], a = pts[(i + 4) % 5], b = pts[(i + 1) % 5];
  const u = { x: a.x - p.x, y: a.y - p.y }, v = { x: b.x - p.x, y: b.y - p.y };
  return Math.acos((u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) * 180 / Math.PI;
}

describe('type 13 prototile', () => {
  it('satisfies the type 13 conditions with A = 120°', () => {
    const t = prototile();
    const [A, B, C, D, E] = [0, 1, 2, 3, 4].map(i => angleAt(t, i));
    expect(A).toBeCloseTo(120, 9);
    expect(B).toBeCloseTo(90, 9);
    expect(E).toBeCloseTo(90, 9);
    expect(2 * A + D).toBeCloseTo(360, 9);
    expect(A + B + C + D + E).toBeCloseTo(540, 9);
    const s = sideLengths();
    expect(s.d).toBeCloseTo(2 * s.a, 9);
    expect(s.d).toBeCloseTo(2 * s.e, 9);
  });
});

describe('type 13 tiling', () => {
  it('has 8 tiles per cell whose area equals the cell area', () => {
    expect(CELL.length).toBe(8);
    const total = CELL.reduce((s, t) => s + Math.abs(polygonArea(t.verts)), 0);
    expect(total).toBeCloseTo(8 * TILE_AREA, 9);
    expect(CELL_W * CELL_H).toBeCloseTo(8 * TILE_AREA, 9);
  });

  it('has no overlapping tiles across neighbouring cells', () => {
    // No overlaps + cell area equal to total tile area ⇒ the plane is covered exactly.
    const tiles: Vec[][] = [];
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++)
        for (const t of CELL) tiles.push(t.verts.map(p => ({ x: p.x + i * CELL_W, y: p.y + j * CELL_H })));
    const pairs: [number, number][] = [];
    for (let a = 0; a < tiles.length; a++)
      for (let b = a + 1; b < tiles.length; b++)
        if (overlaps(tiles[a], tiles[b])) pairs.push([a, b]);
    expect(pairs).toEqual([]);
  });

  it('mixes four direct and four mirrored tiles', () => {
    expect(CELL.filter(t => t.mirrored).length).toBe(4);
  });
});
