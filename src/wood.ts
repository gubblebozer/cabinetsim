// Procedural walnut board textures. A board is rendered with its grain running
// along +x; callers rotate it into place. Textures are cached by spec.

import { fbm, valueNoise } from './noise';
import { smoothstep } from './geometry/vec';

export type Figure = 'cathedral' | 'straight' | 'curly' | 'plain';

export interface WoodSpec {
  figure: Figure;
  color: string; // base tone, '#rrggbb'
  contrast: number; // 0..1, strength of growth rings
  ringsPerInch: number;
  warp: number; // 0..1, waviness of the grain
  streaks: number; // 0..1, dark mineral/heartwood streaks typical of walnut
  seed: number;
}

export const FINISHES: Record<string, string> = {
  'Natural oil': '#5c3b27',
  'Clear satin (lighter)': '#73503a',
  'Dark walnut stain': '#3a261b',
  'Amber shellac': '#6e4422',
  'Bleached / blonde': '#9c7f63',
  'Driftwood gray': '#6e6358',
  'Ebonized': '#231a16',
};

export const PX_PER_IN = 32;
export const BOARD_W_IN = 48; // along the grain
export const BOARD_H_IN = 20; // across the grain; wide enough for a single 6" tile

export interface Board {
  canvas: HTMLCanvasElement;
  ppi: number;
  widthIn: number;
  heightIn: number;
}

const cache = new Map<string, Board>();

export function getBoard(spec: WoodSpec): Board {
  const key = JSON.stringify(spec);
  let b = cache.get(key);
  if (!b) {
    if (cache.size > 6) cache.clear();
    b = renderBoard(spec);
    cache.set(key, b);
  }
  return b;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function renderBoard(spec: WoodSpec): Board {
  const ppi = PX_PER_IN;
  const W = BOARD_W_IN * ppi, H = BOARD_H_IN * ppi;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const [r0, g0, b0] = hexToRgb(spec.color);
  const seed = spec.seed * 101;
  const rpi = spec.ringsPerInch;
  const contrast = spec.contrast;
  // Darker, cooler colour used for walnut's characteristic streaks.
  const sr = r0 * 0.55, sg = g0 * 0.5, sb = b0 * 0.55 + 6;

  for (let py = 0; py < H; py++) {
    const v = py / ppi;
    for (let px = 0; px < W; px++) {
      const u = px / ppi;
      const warp = spec.warp * (fbm(u * 0.06, v * 0.3, seed, 3) - 0.5) * 2;
      let ring: number;
      if (spec.figure === 'cathedral') {
        // A board sliced tangentially from a tapered log: rings become nested arches.
        const centre = BOARD_H_IN / 2 + 2.5 * (fbm(u * 0.025, 3.7, seed + 9, 2) - 0.5);
        const yy = v - centre;
        const depth = 1.2 + 0.11 * u;
        ring = Math.sqrt(yy * yy + depth * depth) * rpi + warp * 1.5;
      } else {
        ring = v * rpi + warp * 2;
      }
      const f = ring - Math.floor(ring);
      // Latewood band: a soft dark line once per ring.
      const late = spec.figure === 'plain' ? 0 : Math.exp(-((f - 0.5) * (f - 0.5)) / 0.02);
      // Open pores show as short dark flecks stretched along the grain.
      const pore = smoothstep(0.72, 0.92, valueNoise(u * 1.2, v * 22, seed + 3));
      const tone = fbm(u * 0.05, v * 0.25, seed + 5, 2) - 0.5;
      let shade = 1 - contrast * 0.42 * late - 0.18 * pore + 0.22 * tone;
      if (spec.figure === 'curly') {
        // Ripple figure: bands across the grain.
        const rip = Math.sin(2 * Math.PI * (u * 1.6 + 0.8 * fbm(u * 0.3, v * 0.08, seed + 7, 2)));
        shade *= 1 + 0.12 * rip;
      }
      const streak = spec.streaks * smoothstep(0.5, 0.75, fbm(u * 0.02, v * 0.18, seed + 11, 3));
      const i = (py * W + px) * 4;
      data[i] = (r0 + (sr - r0) * streak) * shade;
      data[i + 1] = (g0 + (sg - g0) * streak) * shade;
      data[i + 2] = (b0 + (sb - b0) * streak) * shade;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, ppi, widthIn: BOARD_W_IN, heightIn: BOARD_H_IN };
}
