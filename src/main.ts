import './style.css';
import { buildElevation } from './layout';
import { PRESETS } from './presets';
import { Boards, draw } from './render';
import { Scene, buildScene } from './scene';
import { State, defaultState, encodeShare, loadState, mergeState, saveState } from './state';
import { buildUI } from './ui';
import { download, sceneToSvg } from './export';
import { getBoard } from './wood';
import { sideLengths, TILE_AREA } from './geometry/type13';
import { Affine, clipToRect, multiply, polygonArea, scaling, translation } from './geometry/vec';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const ctx = canvas.getContext('2d')!;
const info = document.querySelector<HTMLElement>('#info')!;

const elevation = buildElevation();
const state: State = loadState();

// ---- wood textures: regenerated shortly after the last change, so dragging
// a wood slider doesn't stall on every step.
let boards: Boards = { field: getBoard(state.wood.field), tile: getBoard(state.wood.tile) };
let woodKey = JSON.stringify([state.wood.field, state.wood.tile]);
let woodTimer = 0;
function syncBoards() {
  const key = JSON.stringify([state.wood.field, state.wood.tile]);
  if (key === woodKey) return;
  woodKey = key;
  clearTimeout(woodTimer);
  woodTimer = window.setTimeout(() => {
    boards = { field: getBoard(state.wood.field), tile: getBoard(state.wood.tile) };
    requestRender();
  }, 120);
}

// ---- view: CSS pixels per inch and pan offset.
const view = { scale: 1, x: 0, y: 0, fitted: false };
function fit() {
  // ?view=x,y,width zooms to a region of the wall (inches); handy for screenshots.
  const zoom = new URLSearchParams(location.search).get('view')?.split(',').map(Number);
  if (zoom?.length === 3 && zoom.every(Number.isFinite)) {
    view.scale = canvas.clientWidth / zoom[2];
    view.x = -zoom[0] * view.scale;
    view.y = -zoom[1] * view.scale;
    view.fitted = true;
    return;
  }
  const pad = 32;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  view.scale = Math.min((w - 2 * pad) / elevation.width, (h - 2 * pad) / (elevation.height + 4));
  view.x = (w - elevation.width * view.scale) / 2;
  view.y = (h - (elevation.height + 4) * view.scale) / 2;
  view.fitted = true;
}
function viewMatrix(): Affine {
  const dpr = window.devicePixelRatio || 1;
  return multiply(scaling(dpr), multiply(translation(view.x, view.y), scaling(view.scale)));
}

// ---- rendering
let scene: Scene | null = null;
let pending = false;
function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
  });
}
function render() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  if (!view.fitted) fit();
  scene = buildScene(state, elevation);
  draw(ctx, scene, state, boards, viewMatrix());
  updateInfo(scene);
}

function updateInfo(s: Scene) {
  const a = state.tile.size;
  const sides = sideLengths();
  let total = 0, mirrored = 0, trimmed = 0, area = 0;
  const perCab = new Map<string, number>();
  const full = TILE_AREA * a * a;
  for (const f of s.elevation.fronts) {
    const ts = s.tiles.get(f.id) ?? [];
    const r = s.tileArea.get(f.id)!;
    for (const t of ts) {
      const part = Math.abs(polygonArea(clipToRect(t.verts, r)));
      if (part < 1e-6) continue; // only grazes the border
      total++;
      if (t.mirrored) mirrored++;
      if (part < full - 1e-6) trimmed++;
      area += part;
      perCab.set(f.cabinet, (perCab.get(f.cabinet) ?? 0) + 1);
    }
  }
  const inch = (x: number) => `${(x * a).toFixed(2)}″`;
  info.innerHTML = `
    <div><b>${total.toLocaleString()}</b> tiles (${(total - trimmed).toLocaleString()} whole, ${trimmed.toLocaleString()} trimmed; ${mirrored.toLocaleString()} mirrored) · ${(area / 144).toFixed(1)} sq ft</div>
    <div>${[...perCab].map(([c, n]) => `Cab ${c}: ${n}`).join(' · ')}</div>
    <div>Tile sides: a = e = ${inch(sides.a)}, b = ${inch(sides.b)}, c = ${inch(sides.c)}, d = ${inch(sides.d)}</div>`;
}

// ---- state changes
function changed() {
  saveState(state);
  // Once edited, the page no longer matches a share link it was opened with.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  syncBoards();
  requestRender();
}

/** Copy values into the existing state object so UI bindings stay attached. */
function assignDeep(target: any, source: any) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') assignDeep(target[k], v);
    else target[k] = v;
  }
}

function replaceState(next: State) {
  assignDeep(state, next);
  ui.refresh();
  changed();
}

const ui = buildUI(document.querySelector('#panel')!, state, {
  onChange: changed,
  applyPreset: name => replaceState(mergeState(state, PRESETS[name])),
  reset: () => replaceState(defaultState()),
  savePresetFile: () => download('parquetry-settings.json', JSON.stringify(state, null, 2), 'application/json'),
  loadPresetFile: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        replaceState(mergeState(defaultState(), JSON.parse(await file.text())));
      } catch (e) {
        alert(`Could not read settings: ${e}`);
      }
    };
    input.click();
  },
  copyShareLink: async () => {
    const url = location.origin + location.pathname + encodeShare(state);
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied. Anyone opening it (on this dev server) sees these settings.');
    } catch {
      prompt('Copy this link:', url);
    }
  },
  exportSvg: () => scene && download('parquetry-template.svg', sceneToSvg(scene), 'image/svg+xml'),
  exportPng: () => {
    if (!scene) return;
    const ppi = 24, pad = 3;
    const off = document.createElement('canvas');
    off.width = Math.round((elevation.width + 2 * pad) * ppi);
    off.height = Math.round((elevation.height + 2 * pad) * ppi);
    draw(off.getContext('2d')!, scene, state, boards, multiply(scaling(ppi), translation(pad, pad)));
    off.toBlob(b => b && download('parquetry.png', b, 'image/png'));
  },
});

// ---- pan & zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.exp(-e.deltaY * 0.0015);
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  view.x = mx - (mx - view.x) * k;
  view.y = my - (my - view.y) * k;
  view.scale *= k;
  requestRender();
}, { passive: false });

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  view.x += e.clientX - drag.x;
  view.y += e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  requestRender();
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('dblclick', () => {
  fit();
  requestRender();
});
new ResizeObserver(() => {
  fit();
  requestRender();
}).observe(canvas);

requestRender();
