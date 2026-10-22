// Canvas drawing. All drawing happens in wall inches; `view` maps inches to
// device pixels.

import { Front } from './layout';
import { hash01 } from './noise';
import { Scene, hasParquetry } from './scene';
import { State } from './state';
import { Board } from './wood';
import { TileInstance } from './geometry/tiling';
import { Affine, DEG, Rect } from './geometry/vec';

const ROLE_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45'];
// Fixed per-role tone offsets in [-1, 1], scaled by state.wood.roleVariation.
const ROLE_TONE = [0.9, -0.6, 0.3, -1, 0.6, -0.2, 1, -0.8];

export interface Boards {
  field: Board;
  tile: Board;
}

export function draw(ctx: CanvasRenderingContext2D, scene: Scene, state: State, boards: Boards, view: Affine): void {
  const { elevation } = scene;
  const { width: W, height: H } = ctx.canvas;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = state.scene.wallColor;
  ctx.fillRect(0, 0, W, H);

  ctx.setTransform(view.a, view.b, view.c, view.d, view.e, view.f);
  // Floor from the bottom of the cabinets down to well past the screen edge.
  ctx.fillStyle = state.scene.floorColor;
  ctx.fillRect(-1000, elevation.height, 2000 + elevation.width, 1000);

  for (const cab of elevation.cabinets) drawCarcass(ctx, cab.rect, cab.upper, cab.lower, state);

  const { field, tile: tileBoard } = boards;
  const fieldPattern = ctx.createPattern(field.canvas, 'repeat')!;
  const tilePattern = ctx.createPattern(tileBoard.canvas, 'repeat')!;

  elevation.fronts.forEach((front, k) => {
    drawField(ctx, front, k, fieldPattern, field.ppi, field.widthIn, field.heightIn, state);
    const tiles = scene.tiles.get(front.id) ?? [];
    const area = scene.tileArea.get(front.id)!;
    ctx.save();
    if (!state.tile.wholeOnly) clipRect(ctx, area);
    for (const t of tiles) drawTile(ctx, t, tilePattern, tileBoard.ppi, tileBoard.widthIn, tileBoard.heightIn, state);
    if (state.scene.debug) for (const t of tiles) drawDebugTile(ctx, t, view);
    ctx.restore();
    drawFrontEdge(ctx, front.rect);
  });
}

function drawCarcass(ctx: CanvasRenderingContext2D, r: Rect, upper: Rect, lower: Rect, state: State) {
  ctx.fillStyle = state.scene.frameColor;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Openings read as dark shadow through the reveals between fronts.
  ctx.fillStyle = '#140d09';
  for (const o of [upper, lower]) ctx.fillRect(o.x, o.y, o.w, o.h);
  // Molding profiles: a couple of shadow lines at the top and the base.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.08;
  const line = (y: number) => { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); };
  line(upper.y - 0.6);
  line(lower.y + lower.h + 0.8);
  line(lower.y + lower.h + 1.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function grainIsVertical(front: Front, state: State) {
  if (!hasParquetry(front, state)) return true;
  return (front.kind === 'door' ? state.wood.doorGrain : state.wood.drawerGrain) === 'vertical';
}

function drawField(
  ctx: CanvasRenderingContext2D, front: Front, k: number, pattern: CanvasPattern,
  ppi: number, boardW: number, boardH: number, state: State,
) {
  const r = front.rect;
  const vertical = grainIsVertical(front, state);
  const along = vertical ? r.h : r.w, across = vertical ? r.w : r.h;
  // Each front gets its own stretch of board.
  const ou = hash01(k, 1) * Math.max(0, boardW - along);
  const ov = hash01(k, 2) * Math.max(0, boardH - across);
  const m = vertical
    ? new DOMMatrix().translateSelf(r.x + r.w + ov, r.y - ou).rotateSelf(90).scaleSelf(1 / ppi)
    : new DOMMatrix().translateSelf(r.x - ou, r.y - ov).scaleSelf(1 / ppi);
  pattern.setTransform(m);
  ctx.fillStyle = pattern;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const tone = sheen(vertical ? Math.PI / 2 : 0, state);
  if (tone !== 0) {
    ctx.fillStyle = overlay(tone);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

/** Brightness change from light raking across the grain direction `axis`. */
function sheen(axis: number, state: State): number {
  return 0.22 * state.light.sheen * Math.cos(2 * (axis - state.light.angle * DEG));
}

function overlay(amount: number): string {
  return amount > 0 ? `rgba(255,236,214,${Math.min(amount, 1)})` : `rgba(0,0,0,${Math.min(-amount, 1)})`;
}

function tracePolygon(ctx: CanvasRenderingContext2D, verts: TileInstance['verts']) {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D, t: TileInstance, pattern: CanvasPattern,
  ppi: number, boardW: number, boardH: number, state: State,
) {
  const w = state.wood;
  const grain = (w.grainMode === 'follow' ? t.axis : 0) + w.grainOffset * DEG;
  // Cut each tile from a different spot on the board, keeping the whole tile
  // (about 1.6a from its center) on the board so it doesn't wrap.
  const reach = 1.6 * state.tile.size;
  const spot = (len: number, salt: number) => {
    const m = Math.min(reach, len / 2);
    return m + hash01(t.i, t.j, t.role, salt) * (len - 2 * m);
  };
  const ox = spot(boardW, 3);
  const oy = spot(boardH, 4);
  pattern.setTransform(
    new DOMMatrix().translateSelf(t.center.x, t.center.y).rotateSelf(grain / DEG).translateSelf(-ox, -oy).scaleSelf(1 / ppi),
  );
  tracePolygon(ctx, t.verts);
  ctx.fillStyle = pattern;
  ctx.fill();

  const tone = 0.3 * w.tileTone
    + 0.3 * w.roleVariation * ROLE_TONE[t.role]
    + 0.3 * w.tileJitter * (hash01(t.i, t.j, t.role, 5) * 2 - 1)
    + sheen(grain, state);
  if (Math.abs(tone) > 0.002) {
    ctx.fillStyle = overlay(tone);
    ctx.fill();
  }
  const seam = state.tile.seamTone;
  if (state.tile.seamWidth > 0 && seam !== 0) {
    // Dark glue line, or pale maple stringing.
    ctx.strokeStyle = seam < 0 ? `rgba(22,13,8,${-seam})` : `rgba(239,227,200,${seam})`;
    ctx.lineWidth = state.tile.seamWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function drawDebugTile(ctx: CanvasRenderingContext2D, t: TileInstance, view: Affine) {
  tracePolygon(ctx, t.verts);
  ctx.fillStyle = ROLE_COLORS[t.role] + '88';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.03;
  ctx.stroke();
  const pxPerIn = Math.hypot(view.a, view.b);
  if (pxPerIn * Math.hypot(t.verts[3].x - t.verts[2].x, t.verts[3].y - t.verts[2].y) > 40) {
    ctx.fillStyle = '#000';
    ctx.font = '0.35px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Text drawn in inches would be tiny; scale the label to a fixed fraction of the tile.
    const s = Math.hypot(t.verts[3].x - t.verts[2].x, t.verts[3].y - t.verts[2].y) / 2;
    ctx.save();
    ctx.translate(t.center.x, t.center.y);
    ctx.scale(s, s);
    ctx.fillText(`${t.role}${t.mirrored ? 'm' : ''}`, 0, 0);
    ctx.restore();
  }
}

function clipRect(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

function drawFrontEdge(ctx: CanvasRenderingContext2D, r: Rect) {
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(255,235,210,0.12)';
  ctx.beginPath();
  ctx.moveTo(r.x + 0.06, r.y + r.h - 0.06);
  ctx.lineTo(r.x + 0.06, r.y + 0.06);
  ctx.lineTo(r.x + r.w - 0.06, r.y + 0.06);
  ctx.stroke();
}
