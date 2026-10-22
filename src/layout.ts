// Cabinet elevation, in inches. Wall coordinates have their origin at the
// top-left corner of the cabinet run, with y increasing downward.
//
// Measured: overall height 82" (incl. 5.5" bottom molding, 1.5" top molding),
// upper doors 44.5" high, widths and drawer heights below.
// Assumed: the 0.5" left over in the lower section (75 − 44.5 − 30) is a rail
// between the upper and lower fronts; lower doors are 30" like the drawer stacks;
// cabinets butt together with no gap; fronts are separated by a 1/8" reveal.

import { Rect } from './geometry/vec';

export type LowerSection =
  | { kind: 'doors' }
  | { kind: 'drawers'; heights: number[] }; // top to bottom

export interface CabinetSpec {
  name: string;
  width: number;
  lower: LowerSection;
}

export interface LayoutSpec {
  height: number;
  topMolding: number;
  bottomMolding: number;
  upperHeight: number;
  midRail: number;
  lowerHeight: number;
  cabinetGap: number;
  reveal: number;
  cabinets: CabinetSpec[];
}

export const LAYOUT: LayoutSpec = {
  height: 82,
  topMolding: 1.5,
  bottomMolding: 5.5,
  upperHeight: 44.5,
  midRail: 0.5,
  lowerHeight: 30,
  cabinetGap: 0,
  reveal: 0.125,
  cabinets: [
    { name: 'A', width: 25, lower: { kind: 'doors' } },
    { name: 'B', width: 24, lower: { kind: 'drawers', heights: [4.5, 4.5, 8, 13] } },
    { name: 'C', width: 23, lower: { kind: 'drawers', heights: [9, 8, 13] } },
    { name: 'D', width: 24.5, lower: { kind: 'doors' } },
  ],
};

export interface Front {
  id: string;
  cabinet: string;
  kind: 'door' | 'drawer';
  section: 'upper' | 'lower';
  rect: Rect; // visible face, after the reveal
  /** For double doors: which leaf this is and the line between the pair. */
  pair?: { id: string; side: 'L' | 'R'; centerX: number };
}

export interface Cabinet {
  name: string;
  rect: Rect;
  upper: Rect; // opening for the upper fronts
  lower: Rect;
}

export interface Elevation {
  width: number;
  height: number;
  cabinets: Cabinet[];
  fronts: Front[];
}

export function buildElevation(spec: LayoutSpec = LAYOUT): Elevation {
  const cabinets: Cabinet[] = [];
  const fronts: Front[] = [];
  const half = spec.reveal / 2;
  const shrink = (r: Rect): Rect => ({ x: r.x + half, y: r.y + half, w: r.w - spec.reveal, h: r.h - spec.reveal });
  const upperY = spec.topMolding;
  const lowerY = upperY + spec.upperHeight + spec.midRail;

  let x = 0;
  for (const cab of spec.cabinets) {
    const w = cab.width;
    const upper = { x, y: upperY, w, h: spec.upperHeight };
    const lower = { x, y: lowerY, w, h: spec.lowerHeight };
    cabinets.push({ name: cab.name, rect: { x, y: 0, w, h: spec.height }, upper, lower });

    const doorPair = (section: Rect, tag: 'upper' | 'lower') => {
      const id = `${cab.name}-${tag}`;
      const centerX = section.x + section.w / 2;
      for (const side of ['L', 'R'] as const) {
        const leaf = { x: side === 'L' ? section.x : centerX, y: section.y, w: section.w / 2, h: section.h };
        fronts.push({ id: `${id}-${side}`, cabinet: cab.name, kind: 'door', section: tag, rect: shrink(leaf), pair: { id, side, centerX } });
      }
    };

    doorPair(upper, 'upper');
    if (cab.lower.kind === 'doors') {
      doorPair(lower, 'lower');
    } else {
      let y = lower.y;
      cab.lower.heights.forEach((h, k) => {
        fronts.push({ id: `${cab.name}-drawer${k + 1}`, cabinet: cab.name, kind: 'drawer', section: 'lower', rect: shrink({ x, y, w, h }) });
        y += h;
      });
    }
    x += w + spec.cabinetGap;
  }
  return { width: x - spec.cabinetGap, height: spec.height, cabinets, fronts };
}
