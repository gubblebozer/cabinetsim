// Built-in starting points. Each is merged onto the current settings, so wood
// and scene choices carry over unless a preset sets them.

export const PRESETS: Record<string, object> = {
  'Full field': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.5 },
    pattern: { id: 'full' },
  },
  'Rolling wave': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.25 },
    pattern: {
      id: 'wave',
      params: { wave: { space: 'wall', center: 0.55, amplitude: 14, wavelength: 96, phase: 0, thickness: 14, count: 1, angle: 0, soft: 2 } },
    },
  },
  'Double wave': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.25 },
    pattern: {
      id: 'wave',
      params: { wave: { space: 'wall', center: 0.45, amplitude: 6, wavelength: 55, phase: 0, thickness: 5, count: 2, spacing: 22, angle: 0, soft: 2 } },
    },
  },
  'Diagonal bands': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.5 },
    pattern: { id: 'stripes', params: { stripes: { space: 'wall', angle: 35, width: 7, period: 26, offset: 0, soft: 0 } } },
  },
  'Book-matched chevrons': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: true, margin: 1.5 },
    pattern: { id: 'stripes', params: { stripes: { space: 'wall', angle: 30, width: 6, period: 24, offset: 0, soft: 0 } } },
  },
  'Framed panels': {
    tile: { rotation: 0, anchor: 'front', bookMatch: true, margin: 1.25 },
    pattern: { id: 'panel', params: { panel: { mode: 'panel', inset: 2.5, soft: 0 } } },
  },
  'Dissolving upward': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.25 },
    pattern: { id: 'gradient', params: { gradient: { space: 'wall', angle: -90, start: 0.15, end: 0.7 } } },
  },
  'Organic islands': {
    tile: { rotation: 0, anchor: 'wall', bookMatch: false, margin: 1.25 },
    pattern: { id: 'blobs', params: { blobs: { space: 'wall', scale: 16, amount: 0.4, soft: 0.02, seed: 7 } } },
  },
};
