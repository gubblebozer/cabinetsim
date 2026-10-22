import { FolderApi, Pane } from 'tweakpane';
import { PATTERNS, patternById, defaultParams } from './patterns';
import { PRESETS } from './presets';
import { State } from './state';
import { FINISHES, WoodSpec } from './wood';

export interface UIHooks {
  onChange(): void;
  applyPreset(name: string): void;
  reset(): void;
  savePresetFile(): void;
  loadPresetFile(): void;
  copyShareLink(): void;
  exportSvg(): void;
  exportPng(): void;
}

export interface UI {
  /** Re-read all values from state (after a preset or reset). */
  refresh(): void;
}

export function buildUI(container: HTMLElement, state: State, hooks: UIHooks): UI {
  const pane = new Pane({ container, title: 'Parquetry' });
  pane.on('change', () => hooks.onChange());

  // Presets
  const presets = pane.addFolder({ title: 'Presets' });
  const presetPick = { name: Object.keys(PRESETS)[0] };
  presets.addBinding(presetPick, 'name', {
    label: 'preset',
    options: Object.fromEntries(Object.keys(PRESETS).map(k => [k, k])),
  });
  presets.addButton({ title: 'Apply preset' }).on('click', () => hooks.applyPreset(presetPick.name));
  presets.addButton({ title: 'Copy share link' }).on('click', hooks.copyShareLink);
  presets.addButton({ title: 'Save settings to file…' }).on('click', hooks.savePresetFile);
  presets.addButton({ title: 'Load settings from file…' }).on('click', hooks.loadPresetFile);
  presets.addButton({ title: 'Reset everything' }).on('click', hooks.reset);

  // Tiles
  const tiles = pane.addFolder({ title: 'Tiles' });
  const t = state.tile;
  tiles.addBinding(t, 'size', { label: 'short side a (in)', min: 0.3, max: 6, step: 0.05 });
  tiles.addBinding(t, 'rotation', { label: 'rotation (°)', min: -90, max: 90, step: 0.5 });
  tiles.addBinding(t, 'offsetX', { label: 'shift x (in)', min: -10, max: 10, step: 0.05 });
  tiles.addBinding(t, 'offsetY', { label: 'shift y (in)', min: -10, max: 10, step: 0.05 });
  tiles.addBinding(t, 'anchor', { label: 'lattice', options: { 'continuous across wall': 'wall', 'centered on each front': 'front' } });
  tiles.addBinding(t, 'bookMatch', { label: 'mirror door pairs' });
  tiles.addBinding(t, 'lowerParquetry', { label: 'parquetry on lower fronts' });
  tiles.addBinding(t, 'margin', { label: 'plain border (in)', min: 0, max: 8, step: 0.125 });
  tiles.addBinding(t, 'wholeOnly', { label: 'whole tiles only' });
  tiles.addBinding(t, 'seamWidth', { label: 'seam width (in)', min: 0, max: 0.25, step: 0.005 });
  tiles.addBinding(t, 'seamTone', { label: 'seam dark ↔ maple', min: -1, max: 1, step: 0.05 });

  // Coverage
  const coverage = pane.addFolder({ title: 'Coverage pattern' });
  coverage.addBinding(state.pattern, 'id', {
    label: 'pattern',
    options: Object.fromEntries(PATTERNS.map(p => [p.label, p.id])),
  }).on('change', () => rebuildPatternParams());
  const paramsFolder = coverage.addFolder({ title: 'Pattern settings' });
  function rebuildPatternParams() {
    for (const c of [...paramsFolder.children]) c.dispose();
    const def = patternById(state.pattern.id);
    const params = (state.pattern.params[def.id] = { ...defaultParams(def), ...state.pattern.params[def.id] });
    for (const [key, spec] of Object.entries(def.params)) {
      if (spec.kind === 'number') paramsFolder.addBinding(params, key, { label: spec.label, min: spec.min, max: spec.max, step: spec.step });
      else if (spec.kind === 'select') paramsFolder.addBinding(params, key, { label: spec.label, options: spec.options });
      else paramsFolder.addBinding(params, key, { label: spec.label });
    }
    paramsFolder.hidden = Object.keys(def.params).length === 0;
  }
  rebuildPatternParams();

  // Wood
  const w = state.wood;
  const face = pane.addFolder({ title: 'Walnut: plain face', expanded: false });
  woodControls(face, w.field);
  face.addBinding(w, 'doorGrain', { label: 'door grain', options: { vertical: 'vertical', horizontal: 'horizontal' } });
  face.addBinding(w, 'drawerGrain', { label: 'drawer grain', options: { vertical: 'vertical', horizontal: 'horizontal' } });

  const tw = pane.addFolder({ title: 'Walnut: tiles', expanded: false });
  woodControls(tw, w.tile);
  tw.addBinding(w, 'tileTone', { label: 'lighten / darken', min: -1, max: 1, step: 0.01 });
  tw.addBinding(w, 'roleVariation', { label: 'tone by position', min: 0, max: 1, step: 0.01 });
  tw.addBinding(w, 'tileJitter', { label: 'random tone', min: 0, max: 1, step: 0.01 });
  tw.addBinding(w, 'grainMode', { label: 'grain', options: { 'follows each tile': 'follow', 'same for all tiles': 'fixed' } });
  tw.addBinding(w, 'grainOffset', { label: 'grain angle (°)', min: -180, max: 180, step: 1 });

  function woodControls(folder: FolderApi, spec: WoodSpec) {
    const pick = { finish: '' };
    folder.addBinding(pick, 'finish', {
      label: 'finish preset',
      options: { '(choose)': '', ...Object.fromEntries(Object.keys(FINISHES).map(k => [k, k])) },
    }).on('change', ev => {
      if (!ev.value) return;
      spec.color = FINISHES[ev.value];
      pick.finish = '';
      pane.refresh();
    });
    folder.addBinding(spec, 'color', { label: 'base color' });
    folder.addBinding(spec, 'figure', {
      label: 'figure',
      options: { 'cathedral (flat sawn)': 'cathedral', 'straight (quarter sawn)': 'straight', 'curly': 'curly', 'plain': 'plain' },
    });
    folder.addBinding(spec, 'contrast', { label: 'grain contrast', min: 0, max: 1, step: 0.01 });
    folder.addBinding(spec, 'ringsPerInch', { label: 'rings per inch', min: 0.5, max: 10, step: 0.1 });
    folder.addBinding(spec, 'warp', { label: 'waviness', min: 0, max: 1, step: 0.01 });
    folder.addBinding(spec, 'streaks', { label: 'dark streaks', min: 0, max: 1, step: 0.01 });
    folder.addBinding(spec, 'seed', { label: 'board (seed)', min: 1, max: 50, step: 1 });
  }

  // Light
  const light = pane.addFolder({ title: 'Light' });
  light.addBinding(state.light, 'angle', { label: 'direction (°)', min: -90, max: 90, step: 1 });
  light.addBinding(state.light, 'sheen', { label: 'grain sheen', min: 0, max: 2, step: 0.01 });

  // Scene
  const scene = pane.addFolder({ title: 'Room', expanded: false });
  scene.addBinding(state.scene, 'wallColor', { label: 'wall' });
  scene.addBinding(state.scene, 'frameColor', { label: 'cabinet frame' });
  scene.addBinding(state.scene, 'floorColor', { label: 'floor' });
  scene.addBinding(state.scene, 'debug', { label: 'show tile positions' });

  // Export
  const exp = pane.addFolder({ title: 'Export' });
  exp.addButton({ title: 'Full-size SVG template' }).on('click', hooks.exportSvg);
  exp.addButton({ title: 'PNG image' }).on('click', hooks.exportPng);

  return {
    refresh() {
      rebuildPatternParams();
      pane.refresh();
    },
  };
}
