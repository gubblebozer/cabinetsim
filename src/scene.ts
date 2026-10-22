// Decides which tiles go on which front. Pure geometry; no drawing.

import { Elevation, Front } from './layout';
import { hash01 } from './noise';
import { MaskInput, patternById } from './patterns';
import { State } from './state';
import { TileInstance, patternTransform, tilesInRect, transformTile } from './geometry/tiling';
import { Rect, insetRect, mirrorX, rectContains } from './geometry/vec';

export interface Scene {
  elevation: Elevation;
  /** Tiles per front id. */
  tiles: Map<string, TileInstance[]>;
  /** Region of each front that tiles may occupy (front minus margin). */
  tileArea: Map<string, Rect>;
}

export function buildScene(state: State, elevation: Elevation): Scene {
  const { tile } = state;
  const pattern = patternById(state.pattern.id);
  const params = state.pattern.params[pattern.id] ?? {};
  const wallSize = { w: elevation.width, h: elevation.height };
  const tiles = new Map<string, TileInstance[]>();
  const tileArea = new Map<string, Rect>();

  for (const front of elevation.fronts) {
    const inner = insetRect(front.rect, tile.margin);
    tileArea.set(front.id, inner);

    if (!hasParquetry(front, state)) {
      tiles.set(front.id, []);
      continue;
    }

    if (tile.bookMatch && front.pair?.side === 'R') {
      const left = tiles.get(`${front.pair.id}-L`) ?? [];
      const m = mirrorX(front.pair.centerX);
      tiles.set(front.id, left.map(t => transformTile(t, m)));
      continue;
    }

    const m = patternTransform(origin(front, state), tile.rotation, tile.size);
    const placed = tilesInRect(inner, m).filter(t => {
      // Otherwise tiles crossing the border are trimmed when drawn.
      if (tile.wholeOnly && !t.verts.every(p => rectContains(inner, p))) return false;
      const input: MaskInput = {
        wall: t.center,
        local: { x: t.center.x - front.rect.x, y: t.center.y - front.rect.y },
        frontSize: { w: front.rect.w, h: front.rect.h },
        wallSize,
      };
      return hash01(t.i, t.j, t.role, 17) < pattern.density(input, params);
    });
    tiles.set(front.id, placed);
  }
  return { elevation, tiles, tileArea };
}

export function hasParquetry(front: Front, state: State): boolean {
  return front.section === 'upper' || state.tile.lowerParquetry;
}

function origin(front: Front, state: State) {
  const { offsetX, offsetY, anchor } = state.tile;
  return anchor === 'wall'
    ? { x: offsetX, y: offsetY }
    : { x: front.rect.x + front.rect.w / 2 + offsetX, y: front.rect.y + front.rect.h / 2 + offsetY };
}
