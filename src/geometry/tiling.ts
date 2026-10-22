import { CELL, CELL_H, CELL_W } from './type13';
import {
  Affine, Rect, Vec, applyAffine, bounds, determinant, invert, multiply, polygonCentroid,
  rectsOverlap, rotation, scaling, translation, DEG,
} from './vec';

export interface TileInstance {
  key: string;
  i: number;
  j: number;
  role: number;
  mirrored: boolean;
  verts: Vec[]; // wall coordinates (inches), label order A..E
  center: Vec;
  /** Direction of side d (C→D) in wall space, radians. Used as the tile's grain reference. */
  axis: number;
}

/** Pattern space → wall space: scale by tile size, rotate, then move to origin. */
export function patternTransform(origin: Vec, rotationDeg: number, size: number): Affine {
  return multiply(translation(origin.x, origin.y), multiply(rotation(rotationDeg * DEG), scaling(size)));
}

const CELL_BOUNDS = bounds(CELL.flatMap(t => t.verts));

/** Every tile of the lattice (under transform m) whose bounding box touches rect. */
export function tilesInRect(rect: Rect, m: Affine): TileInstance[] {
  const inv = invert(m);
  const corners = [
    { x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h }, { x: rect.x + rect.w, y: rect.y + rect.h },
  ].map(p => applyAffine(inv, p));
  const pb = bounds(corners);
  const i0 = Math.floor((pb.x - (CELL_BOUNDS.x + CELL_BOUNDS.w)) / CELL_W);
  const i1 = Math.ceil((pb.x + pb.w - CELL_BOUNDS.x) / CELL_W);
  const j0 = Math.floor((pb.y - (CELL_BOUNDS.y + CELL_BOUNDS.h)) / CELL_H);
  const j1 = Math.ceil((pb.y + pb.h - CELL_BOUNDS.y) / CELL_H);
  const flip = determinant(m) < 0;

  const out: TileInstance[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      for (const t of CELL) {
        const verts = t.verts.map(p => applyAffine(m, { x: p.x + i * CELL_W, y: p.y + j * CELL_H }));
        if (!rectsOverlap(bounds(verts), rect)) continue;
        out.push(makeTile(verts, i, j, t.role, t.mirrored !== flip));
      }
    }
  }
  return out;
}

function makeTile(verts: Vec[], i: number, j: number, role: number, mirrored: boolean): TileInstance {
  const [, , C, D] = verts;
  return {
    key: `${i},${j},${role}`,
    i, j, role, mirrored, verts,
    center: polygonCentroid(verts),
    axis: Math.atan2(D.y - C.y, D.x - C.x),
  };
}

/** Apply an extra transform to an existing tile (used for book-matching). */
export function transformTile(t: TileInstance, m: Affine): TileInstance {
  const verts = t.verts.map(p => applyAffine(m, p));
  return makeTile(verts, t.i, t.j, t.role, t.mirrored !== (determinant(m) < 0));
}
