import { Params, PATTERNS, defaultParams } from './patterns';
import { WoodSpec } from './wood';

export interface State {
  tile: {
    size: number; // short side a (= e) in inches; d = 2a
    rotation: number; // degrees
    offsetX: number;
    offsetY: number;
    anchor: 'wall' | 'front';
    bookMatch: boolean; // right leaf of each double door mirrors the left
    lowerParquetry: boolean; // off: lower doors and drawers are plain vertical-grain walnut
    margin: number; // plain walnut kept clear around each front's edge
    wholeOnly: boolean; // only place tiles that fit entirely inside the margin
    seamWidth: number;
    seamTone: number; // -1 dark glue line … 0 invisible … +1 light maple stringing
  };
  pattern: {
    id: string;
    params: Record<string, Params>; // per pattern id, so switching back keeps settings
  };
  wood: {
    field: WoodSpec; // the plain walnut face of each front
    tile: WoodSpec;
    tileTone: number; // -1..1 lighten/darken all tiles
    roleVariation: number; // tone difference between the 8 tile positions
    tileJitter: number; // random tone per tile
    grainMode: 'follow' | 'fixed';
    grainOffset: number; // degrees; added to the tile's own direction, or absolute when fixed
    doorGrain: 'vertical' | 'horizontal';
    drawerGrain: 'vertical' | 'horizontal';
  };
  light: {
    angle: number; // degrees; grain running perpendicular to this catches the light
    sheen: number;
  };
  scene: {
    wallColor: string;
    frameColor: string;
    floorColor: string;
    debug: boolean;
  };
}

export function defaultState(): State {
  return {
    tile: {
      size: 3.25, rotation: 0, offsetX: 0, offsetY: 0, anchor: 'wall', bookMatch: false, lowerParquetry: true,
      margin: 1.5, wholeOnly: false, seamWidth: 0.02, seamTone: -0.55,
    },
    pattern: {
      id: 'full',
      params: Object.fromEntries(PATTERNS.map(p => [p.id, defaultParams(p)])),
    },
    wood: {
      field: { figure: 'cathedral', color: '#5c3b27', contrast: 0.6, ringsPerInch: 2.5, warp: 0.5, streaks: 0.45, seed: 1 },
      tile: { figure: 'straight', color: '#5c3b27', contrast: 0.55, ringsPerInch: 4, warp: 0.3, streaks: 0.35, seed: 2 },
      tileTone: 0,
      roleVariation: 0.06,
      tileJitter: 0.05,
      grainMode: 'follow',
      grainOffset: 0,
      doorGrain: 'vertical',
      drawerGrain: 'vertical',
    },
    light: { angle: 35, sheen: 0.6 },
    scene: { wallColor: '#d8d1c4', frameColor: '#4a3326', floorColor: '#6b4f3a', debug: false },
  };
}

/** Deep-merge saved values onto defaults so older presets keep working as fields are added. */
export function mergeState(base: unknown, saved: unknown): any {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return saved === undefined || typeof saved !== typeof base ? base : saved;
  }
  const out: Record<string, unknown> = { ...(base as object) };
  if (typeof saved === 'object' && saved !== null) {
    for (const [k, v] of Object.entries(saved)) {
      out[k] = k in out ? mergeState(out[k], v) : v;
    }
  }
  return out;
}

const STORAGE_KEY = 'cabinetsim.state';

/** Settings encoded in a share link (#s=...). */
export function encodeShare(s: State): string {
  return '#s=' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

function decodeShare(hash: string): unknown {
  const m = hash.match(/^#s=(.+)$/);
  return m ? JSON.parse(decodeURIComponent(escape(atob(m[1])))) : undefined;
}

export function loadState(): State {
  try {
    const shared = decodeShare(location.hash);
    if (shared) return mergeState(defaultState(), shared);
  } catch {
    // fall through to saved state
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeState(defaultState(), JSON.parse(raw));
  } catch {
    // ignore unreadable storage
  }
  return defaultState();
}

export function saveState(s: State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage may be unavailable (private window)
  }
}
