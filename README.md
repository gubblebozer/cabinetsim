# Cabinet Parquetry Simulator

Front view of the four dining-room cabinets with walnut fronts and type 13
pentagon parquetry (Marjorie Rice, 1977). Every setting is adjustable live.

```bash
npm install
npm run dev      # opens on http://localhost:5173
npm test         # checks the tiling has no gaps or overlaps
```

Scroll to zoom, drag to pan, double-click to fit. Settings are saved in the
browser automatically; **Copy share link** puts the full design in a URL, and
**Save settings to file** writes a JSON you can load later.

## The tile

Type 13 conditions: B = E = 90°, 2A + D = 360°, d = 2a = 2e. Angle A is fixed
at 120°, which makes A = C = D = 120°. Measured in units of the short side a:

| side | length |
|------|--------|
| a, e | 1 |
| b | (3√3 − 1)/2 ≈ 2.098 |
| c | (√3 − 1)/2 ≈ 0.366 |
| d | 2 |

The **short side a** slider sets the real size in inches; the info box shows
every side length at the current size.

The tiling groups tiles in fours around their B corners (a tile, its two mirror
images, and its 180° rotation). Two such groups at 90° to each other make the
8-tile repeat, which tiles a √6 × 3√6 rectangle (in units of a). Half the
tiles are mirror images, which in wood means cutting a mirrored piece or
flipping the board. Turn on **Room → show tile positions** to see the 8
positions (`m` = mirrored).

## Where things live

| file | what |
|------|------|
| `src/layout.ts` | cabinet dimensions and assumptions; edit here when measurements change |
| `src/patterns.ts` | coverage patterns (full, panel/border, waves, bands, circles, gradient, islands) |
| `src/presets.ts` | built-in presets |
| `src/wood.ts` | procedural walnut textures and finish colors |
| `src/render.ts` | drawing, grain sheen, seams |
| `src/scene.ts` | which tiles land on which front |
| `src/geometry/type13.ts` | the tile and the tiling |

### Adding a coverage pattern

Add an entry to `PATTERNS` in `src/patterns.ts`. `density()` gets the tile's
center in wall inches (`wall`) and front inches (`local`) and returns 0–1. Its
`params` show up in the panel automatically.

## Layout assumptions (check these)

- The 0.5″ left over in the lower section (75 − 44.5 − 30) is drawn as a rail
  between the upper and lower fronts, and lower doors are 30″ high.
- Cabinets butt together with no gap between them.
- Fronts have a 1/8″ reveal (gap) between them.
- The double doors split each cabinet's width evenly.
