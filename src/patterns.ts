// Coverage patterns decide where parquetry tiles go. Each returns a density in
// [0, 1] for a tile; the tile is placed when its stable random value is below
// the density. Hard-edged patterns return 0 or 1; a "soft edge" gives a
// dithered, scattered transition.
//
// To add a pattern: append a PatternDef to PATTERNS. Its params appear in the
// UI automatically.

import { fbm } from './noise';
import { DEG, Vec, clamp, smoothstep } from './geometry/vec';

export type ParamSpec =
  | { kind: 'number'; label: string; min: number; max: number; step: number; default: number }
  | { kind: 'select'; label: string; options: Record<string, string>; default: string }
  | { kind: 'boolean'; label: string; default: boolean };

export type Params = Record<string, number | string | boolean>;

export interface MaskInput {
  wall: Vec; // tile center, inches from top-left of the cabinet run
  local: Vec; // tile center, inches from top-left of this front
  frontSize: { w: number; h: number };
  wallSize: { w: number; h: number };
}

export interface PatternDef {
  id: string;
  label: string;
  params: Record<string, ParamSpec>;
  density(input: MaskInput, p: Params): number;
}

const SPACE: ParamSpec = {
  kind: 'select', label: 'measured across', options: { 'whole wall': 'wall', 'each front': 'front' }, default: 'wall',
};
const SOFT: ParamSpec = { kind: 'number', label: 'soft edge (in)', min: 0, max: 12, step: 0.25, default: 0 };

/** Point and extent in the chosen measurement space. */
function space(input: MaskInput, which: unknown): { p: Vec; w: number; h: number } {
  return which === 'front'
    ? { p: input.local, w: input.frontSize.w, h: input.frontSize.h }
    : { p: input.wall, w: input.wallSize.w, h: input.wallSize.h };
}

/** 1 inside a band of the given half-width around s = 0, fading over `soft`. */
function band(s: number, halfWidth: number, soft: number): number {
  return 1 - smoothstep(halfWidth - soft / 2, halfWidth + soft / 2, Math.abs(s));
}

function rotated(p: Vec, c: Vec, deg: number): Vec {
  const r = -deg * DEG, cs = Math.cos(r), sn = Math.sin(r);
  const x = p.x - c.x, y = p.y - c.y;
  return { x: cs * x - sn * y, y: sn * x + cs * y };
}

const n = (p: Params, k: string) => p[k] as number;

export const PATTERNS: PatternDef[] = [
  {
    id: 'full',
    label: 'Full coverage',
    params: {},
    density: () => 1,
  },
  {
    id: 'panel',
    label: 'Panel / border',
    params: {
      mode: { kind: 'select', label: 'mode', options: { 'center panel': 'panel', 'border band': 'border' }, default: 'panel' },
      inset: { kind: 'number', label: 'width (in)', min: 0, max: 10, step: 0.25, default: 2.5 },
      soft: SOFT,
    },
    density(input, p) {
      const { x, y } = input.local, { w, h } = input.frontSize;
      const edge = Math.min(x, y, w - x, h - y);
      const inside = smoothstep(n(p, 'inset') - n(p, 'soft') / 2, n(p, 'inset') + n(p, 'soft') / 2, edge);
      return p.mode === 'panel' ? inside : 1 - inside;
    },
  },
  {
    id: 'wave',
    label: 'Wave bands',
    params: {
      space: SPACE,
      center: { kind: 'number', label: 'center (0–1)', min: 0, max: 1, step: 0.01, default: 0.5 },
      amplitude: { kind: 'number', label: 'amplitude (in)', min: 0, max: 30, step: 0.25, default: 8 },
      wavelength: { kind: 'number', label: 'wavelength (in)', min: 4, max: 200, step: 1, default: 60 },
      phase: { kind: 'number', label: 'phase (°)', min: 0, max: 360, step: 1, default: 0 },
      thickness: { kind: 'number', label: 'thickness (in)', min: 1, max: 40, step: 0.25, default: 8 },
      count: { kind: 'number', label: 'bands', min: 1, max: 6, step: 1, default: 1 },
      spacing: { kind: 'number', label: 'band spacing (in)', min: 2, max: 60, step: 0.5, default: 18 },
      angle: { kind: 'number', label: 'angle (°)', min: -90, max: 90, step: 1, default: 0 },
      soft: SOFT,
    },
    density(input, p) {
      const { p: pt, w, h } = space(input, p.space);
      const q = rotated(pt, { x: w / 2, y: h * n(p, 'center') }, n(p, 'angle'));
      const s = q.y - n(p, 'amplitude') * Math.sin((2 * Math.PI * q.x) / n(p, 'wavelength') + n(p, 'phase') * DEG);
      const count = n(p, 'count'), spacing = n(p, 'spacing');
      let best = Infinity;
      for (let k = 0; k < count; k++) best = Math.min(best, Math.abs(s - (k - (count - 1) / 2) * spacing));
      return band(best, n(p, 'thickness') / 2, n(p, 'soft'));
    },
  },
  {
    id: 'stripes',
    label: 'Straight bands',
    params: {
      space: SPACE,
      angle: { kind: 'number', label: 'angle (°)', min: -90, max: 90, step: 1, default: 35 },
      width: { kind: 'number', label: 'band width (in)', min: 0.5, max: 40, step: 0.25, default: 6 },
      period: { kind: 'number', label: 'repeat (in)', min: 1, max: 120, step: 0.5, default: 20 },
      offset: { kind: 'number', label: 'offset (in)', min: -60, max: 60, step: 0.25, default: 0 },
      soft: SOFT,
    },
    density(input, p) {
      const { p: pt, w, h } = space(input, p.space);
      const q = rotated(pt, { x: w / 2, y: h / 2 }, n(p, 'angle'));
      const period = n(p, 'period');
      const s = ((((q.y - n(p, 'offset')) % period) + 1.5 * period) % period) - period / 2;
      return band(s, n(p, 'width') / 2, n(p, 'soft'));
    },
  },
  {
    id: 'radial',
    label: 'Circle / rings',
    params: {
      space: SPACE,
      cx: { kind: 'number', label: 'center x (0–1)', min: -0.5, max: 1.5, step: 0.01, default: 0.5 },
      cy: { kind: 'number', label: 'center y (0–1)', min: -0.5, max: 1.5, step: 0.01, default: 0.3 },
      radius: { kind: 'number', label: 'radius (in)', min: 0, max: 120, step: 0.5, default: 30 },
      ring: { kind: 'number', label: 'ring width (0 = disc)', min: 0, max: 40, step: 0.25, default: 0 },
      soft: SOFT,
    },
    density(input, p) {
      const { p: pt, w, h } = space(input, p.space);
      const r = Math.hypot(pt.x - w * n(p, 'cx'), pt.y - h * n(p, 'cy'));
      const ring = n(p, 'ring');
      return ring > 0
        ? band(r - n(p, 'radius'), ring / 2, n(p, 'soft'))
        : 1 - smoothstep(n(p, 'radius') - n(p, 'soft') / 2, n(p, 'radius') + n(p, 'soft') / 2, r);
    },
  },
  {
    id: 'gradient',
    label: 'Dissolve gradient',
    params: {
      space: SPACE,
      angle: { kind: 'number', label: 'direction (°)', min: -180, max: 180, step: 1, default: 90 },
      start: { kind: 'number', label: 'solid until (0–1)', min: 0, max: 1, step: 0.01, default: 0.25 },
      end: { kind: 'number', label: 'empty from (0–1)', min: 0, max: 1, step: 0.01, default: 0.75 },
    },
    density(input, p) {
      const { p: pt, w, h } = space(input, p.space);
      const a = n(p, 'angle') * DEG, dx = Math.cos(a), dy = Math.sin(a);
      // Project onto the direction and normalise across the extent of the space.
      const ext = Math.abs(dx) * w + Math.abs(dy) * h;
      const t = ((pt.x - w / 2) * dx + (pt.y - h / 2) * dy) / ext + 0.5;
      const s = n(p, 'start'), e = Math.max(n(p, 'end'), s + 1e-6);
      return 1 - clamp((t - s) / (e - s), 0, 1);
    },
  },
  {
    id: 'blobs',
    label: 'Organic islands',
    params: {
      space: SPACE,
      scale: { kind: 'number', label: 'feature size (in)', min: 2, max: 80, step: 0.5, default: 18 },
      amount: { kind: 'number', label: 'amount', min: 0, max: 1, step: 0.01, default: 0.45 },
      soft: { kind: 'number', label: 'soft edge', min: 0, max: 0.3, step: 0.01, default: 0.03 },
      seed: { kind: 'number', label: 'seed', min: 0, max: 100, step: 1, default: 7 },
    },
    density(input, p) {
      const { p: pt } = space(input, p.space);
      const s = n(p, 'scale');
      const v = fbm(pt.x / s, pt.y / s, n(p, 'seed'), 4);
      // fbm mostly lands in [0.25, 0.75]; map "amount" onto that range.
      const threshold = 0.75 - 0.5 * n(p, 'amount');
      const soft = n(p, 'soft');
      return smoothstep(threshold - soft, threshold + soft, v);
    },
  },
];

export const patternById = (id: string): PatternDef => PATTERNS.find(p => p.id === id) ?? PATTERNS[0];

export function defaultParams(def: PatternDef): Params {
  return Object.fromEntries(Object.entries(def.params).map(([k, s]) => [k, s.default]));
}
