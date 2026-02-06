# Pinboard Algorithm Tester — Checkpoint v0.1

## Project Location

```
/Users/troytsui/Documents/Projects/then-and-there-tester/pinboard
```

## What This Project Is

A local web app for testing photo collage/pinboard layout algorithms. Three-panel UI: photo management (left), canvas preview (center), parameter controls (right). Designed for generating iPhone wallpaper-style photo grids.

**Stack:** Node.js + Express backend, vanilla ES6 modules frontend, Canvas API rendering, sharp for image processing.

**Run:** `npm run dev` (port 3000)

---

## Architecture Overview

```
pinboard/
├── server/
│   ├── index.js                     Express setup, port 3000
│   └── routes/photos.js             REST API: upload, delete, reorder, focal point
├── client/
│   ├── index.html                   3-panel layout + modals
│   ├── styles/main.css              Dark theme, all component styles
│   └── js/
│       ├── app.js                   Entry point, export, keyboard shortcuts
│       ├── state.js                 Centralized pub-sub state management
│       ├── api.js                   Fetch wrapper for server endpoints
│       ├── arrangements/
│       │   ├── registry.js          Plugin system for layout types
│       │   └── grid.js              Grid arrangement (only one so far)
│       ├── canvas/
│       │   ├── renderer.js          Render orchestrator, resize, export
│       │   ├── layers.js            Layer compositing (background → photos)
│       │   ├── photoUtils.js        Image loading, crop, draw helpers
│       │   └── textures.js          Procedural backgrounds (polkadots, stripes, cork)
│       ├── color/
│       │   ├── utils.js             Color math (hex/rgb/hsl, blend, contrast)
│       │   ├── extraction.js        K-means color extraction from photos
│       │   └── palettes.js          Harmony generation (complementary, analogous, etc.)
│       ├── utils/
│       │   ├── random.js            Seeded RNG (Mulberry32)
│       │   └── math.js              Geometry helpers (clamp, lerp, fitRect)
│       └── panels/
│           ├── photoPanel.js        Photo upload, grid display, drag reorder, focal point
│           ├── parameterPanel.js    Dynamic UI from schema, orientation toggle
│           └── paletteModal.js      Palette selection modal, auto-extraction
└── package.json                     express, multer, uuid, sharp
```

### Key Patterns

- **State:** Single `state.js` module with `getState()`, `setState(partial)`, `subscribe(listener)`. All UI and renderer subscribe to changes.
- **Arrangements:** Plugin registry. Each arrangement exports a schema (params with types/defaults/conditions) and a render function. Currently only `grid`.
- **Rendering:** `renderer.js` manages canvas sizing, DPR scaling, and calls `renderLayers()` which invokes registered layer renderers (background, photos) in order.
- **Textures:** Generated as small canvas tiles, used with `ctx.createPattern(tile, 'repeat')`.
- **Parameters:** Schema-driven UI generation in `parameterPanel.js`. Supports number (slider), boolean (toggle), weight (0-10 slider), palette-color (picker), select (dropdown), and groups (collapsible).
- **Export:** Renders to an offscreen canvas at the selected resolution preset, converts to PNG blob, triggers download.

### State Shape

```javascript
{
  photos: [],                    // Photo objects with id, filename, paths, dimensions, focalPoint
  photoOrder: [],                // IDs in display order
  globalParams: {
    orientation: 'portrait',     // 'portrait' | 'landscape'
    aspectRatio: 2.17,           // iPhone standard
    seed: 12345,                 // Deterministic randomness
    pinboardStyle: 'solid',      // solid | polkadots | stripes | cork | white | black
    backgroundColor: 0,          // Palette color index or 'white'/'black'/'neutral'
    dotColor: 1,
    stripeColor1: 0,
    stripeColor2: 1
  },
  arrangementId: 'grid',
  arrangementParams: {},         // Dynamic, populated from arrangement schema defaults
  palette: null,                 // { name, colors: [...hex], utilities: {white, black, neutral} }
  availablePalettes: [],
  presets: []
}
```

---

## What Changed in v0.1 (from v0.0)

All changes are **uncommitted**. Base commit: `091e611 pinboardv0`.

### 1. Photo Panel Grid Layout
**Files:** `photoPanel.js`, `main.css`

- Changed photo list from variable-height vertical stack to **3-column square grid** (`.photo-grid` / `.photo-grid-item`)
- Thumbnails use `aspect-ratio: 1` + `object-fit: cover`
- Overlay buttons shortened ("Del" instead of "Delete")
- Focal indicator changed from text badge ("F") to small blue dot
- Drag handlers updated to find items within `.photo-grid` container

### 2. Landscape Orientation Bug Fix
**File:** `renderer.js`

- Added `lastOrientation` tracking variable
- `render()` now detects orientation changes and calls `handleResize()` to recalculate canvas dimensions
- Previously, toggling orientation updated state but canvas size never changed

### 3. Export Resolution Selector
**Files:** `index.html`, `main.css`, `renderer.js`, `app.js`

- Added `<select id="exportResolution">` with presets: Preview (400px), HD (1290px), 2K (2000px, default), 4K (3000px)
- `renderForExport()` now takes a resolution key string instead of a numeric scale factor
- `EXPORT_RESOLUTIONS` map defines short-side pixel counts; long side calculated from aspect ratio
- Export filename now includes resolution (e.g., `pinboard-grid-12345-2k.png`)

### 4. Texture Tiling Seam Fix
**Files:** `textures.js`, `renderer.js`

- `generatePolkadots()` and `generateStripes()` now calculate tile size dynamically from pattern parameters (`dotSize + spacing` or `stripeWidth * 2`) to ensure seamless tiling
- The old fixed 256px tile caused misalignment at tile boundaries
- Renderer calls updated to pass explicit texture parameters instead of just size

### 5. Rounded Borderless Frame Style
**File:** `grid.js`

- Added `'roundedBorderless'` to `FRAME_STYLES` array
- Added `roundedBorderlessWeight` parameter to schema's frame styles group
- Added `roundedBorderlessWeight` to the weights array in `assignFrameStyles()`
- Added rendering case: rounded clip path, no border fill, photo fills full area
- `cornerRadius` condition updated to show when either rounded style has weight > 0

### 6. Default Parameter Updates
**File:** `grid.js`

| Parameter | Old | New |
|-----------|-----|-----|
| `rows` | 3 | **7** |
| `photoSizePct` | 20 | **22** |
| `polaroidMult` | 3 | **3.5** |
| `cornerRadius` | 10 | **35** |

### 7. Photo Rotation
**File:** `grid.js`

- Added `rotationMax` parameter: slider 0–45°, default 0. Each photo is randomly rotated within `[-R, R]` degrees using a uniform distribution from the seeded RNG.
- Added `rotationPivot` parameter: select dropdown with "Pin Point" (default) and "Center" options. Only visible when `rotationMax > 0` (uses existing `condition` system).
  - **Center:** rotates around the center of the photo
  - **Pin Point:** rotates around a simulated pin position — horizontally uniform 40–60% of photo width, vertically uniform 3–10% of photo height (near top-center, like a pushpin)
- Per-photo rotation angles and pin-point positions are generated after frame style assignment in `renderGrid()`, consuming RNG calls deterministically (seed-stable).
- Rotation is applied in `drawFramedPhoto()` via `ctx.translate → ctx.rotate → ctx.translate` before any frame/photo drawing. The existing `ctx.restore()` undoes the transform.

### 8. Auto-swap Cols/Rows on Orientation Change
**File:** `parameterPanel.js`

- When toggling portrait/landscape, `cols` and `rows` values are swapped automatically (only for grid arrangement)
- Guard prevents no-op swaps when clicking already-active orientation
- `loadArrangementParams()` is called to re-render the slider UI with swapped values

---

## Current Grid Schema (after v0.1 changes)

```
Defaults: 3 cols x 7 rows, 22% photo size, linked spacing
Rotation: 0° range (off by default), pivot: pin point
Frame styles: borderless(1), bordered(0), polaroid(0), rounded(0), roundedBorderless(0), circle(0)
Border size: 5%, Polaroid multiplier: 3.5, Corner radius: 35%
Border color: white (palette utility)
```

Photo count = cols * rows (computed). Switching portrait/landscape swaps cols and rows.

---

## Data Flow Quick Reference

1. **User changes parameter** -> `setArrangementParam()` -> `setState()` -> `notifyListeners()` -> `renderer.scheduleRender()` -> `requestAnimationFrame` -> `render()` -> `arrangement.render()`
2. **Photo upload** -> `api.uploadPhotos()` -> `setState({photos, photoOrder})` -> listeners fire -> canvas re-renders + `paletteModal` auto-extracts colors
3. **Export** -> `renderForExport(resolution)` -> creates offscreen canvas at resolution -> `renderLayers()` -> `canvas.toBlob()` -> download

---

## Known Limitations / Future Work

- Only one arrangement type (grid). Registry supports plugins — add more (e.g., scatter, masonry, radial).
- Export uses preview-loaded thumbnail images, not originals (the iteration plan spec'd loading originals for export but that wasn't implemented — `renderForExport` uses cached `photoImages` from preview).
- No presets/save/load functionality (state shape has `presets: []` placeholder).
- Cork texture still uses fixed 256px tile (not dynamically sized like polkadots/stripes).
- No undo/redo.
- Aspect ratio is hardcoded to 2.17 (iPhone). Could be made configurable.

---

## How to Pick Up

1. `cd /Users/troytsui/Documents/Projects/then-and-there-tester/pinboard`
2. `npm run dev` to start (port 3000)
3. All v0.1 changes are uncommitted — run `git diff` to see exactly what changed
4. The iteration plan that drove these changes is in `pinboard-iteration-v0.1.md`
5. Key files to read first: `state.js` (30 lines, state shape), `grid.js` (arrangement schema + render), `renderer.js` (canvas orchestration)
