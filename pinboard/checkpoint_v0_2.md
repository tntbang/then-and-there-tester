# Pinboard Photo Collage — Checkpoint v0.2

**Date:** 2026-02-09
**Status:** All v0.2 features implemented and stable. No known bugs. Not yet user-tested end-to-end in browser.

---

## What This App Does

A browser-based photo collage tool. Users upload photos, choose a background, configure arrangement parameters, and export the collage as a high-resolution PNG. Three-panel layout: Photos (left), Canvas preview (center), Parameters (right).

**Dev server:** `npm start` → serves on `http://localhost:3000`
**Stack:** Vanilla JS (ES modules, no build step), Express static server, Canvas 2D API.

---

## Project Structure

```
pinboard/
├── server/
│   ├── index.js                  # Express server
│   └── routes/photos.js          # Photo upload API
├── client/
│   ├── index.html                # Main HTML (3-panel layout)
│   ├── styles/
│   │   ├── main.css              # Core styles + collapsible sections
│   │   └── background-panel.css  # Background gallery styles
│   └── js/
│       ├── app.js                # Entry point, init, shadow controls, collapsible sections
│       ├── state.js              # Central state management (getState/setState/subscribe)
│       ├── api.js                # Server API calls
│       ├── utils/
│       │   ├── random.js         # Seeded RNG (createRNG)
│       │   └── math.js           # Math utilities
│       ├── color/
│       │   ├── utils.js          # Color manipulation
│       │   ├── extraction.js     # Palette extraction from photos
│       │   └── palettes.js       # Palette generation
│       ├── canvas/
│       │   ├── renderer.js       # Render orchestrator, export, background param scaling
│       │   ├── layers.js         # Layer registry (background, photos)
│       │   ├── photoUtils.js     # Photo image loading
│       │   └── textures.js       # DEPRECATED — replaced by backgrounds/ modules
│       ├── panels/
│       │   ├── photoPanel.js     # Photo upload/ordering UI
│       │   ├── parameterPanel.js # Global + arrangement param controls
│       │   ├── paletteModal.js   # Palette selection modal
│       │   └── backgroundPanel.js # Background gallery picker + per-bg params
│       ├── arrangements/
│       │   ├── registry.js       # Arrangement plugin registry
│       │   └── grid.js           # Grid arrangement (only arrangement so far)
│       └── backgrounds/
│           ├── registry.js       # Background plugin registry
│           ├── bgUtils.js        # Shared utils (resolveColor, simplexNoise2D, etc.)
│           ├── index.js          # Barrel file (imports all bg modules, re-exports registry)
│           └── [22 background modules — see below]
```

---

## Background System v0.2 — Architecture

### Plugin pattern
Each background module self-registers via side-effect import:
```js
// Example: solid.js
import { registerBackground } from './registry.js';
registerBackground({
  id: 'solid',
  name: 'Solid',
  category: 'basics',
  schema: [
    { id: 'bgColor', name: 'Color', type: 'palette-color', default: 0 }
  ],
  render(ctx, w, h, params, palette, rng, scale) { ... }
});
```

All modules are imported in `backgrounds/index.js` (barrel file), which is imported in `app.js`.

### 22 Background modules by category
| Category    | Modules                                                    |
|-------------|-------------------------------------------------------------|
| basics      | solid, whiteBlack                                           |
| dots        | polkadots, confetti, halftone, bubbles                      |
| stripes     | stripes, pinstripe, candyStripe, chevron                    |
| textures    | cork, linen, paper                                          |
| geometric   | graphPaper, checkerboard, gingham, diamond, hexagonal       |
| decorative  | scatteredShapes, washiTape, tornPaper, splatter             |

### Resolution scaling system
Backgrounds use a schema-annotated auto-scaling approach:
- **`REFERENCE_SHORT_SIDE = 400`** in `renderer.js` — the baseline resolution
- Schema entries with `unit: 'px'` are automatically scaled by `shortSide / 400`
- `scaleBackgroundParams(bg, params, scale)` in renderer.js handles this
- 6 texture modules (cork, paper, linen, tornPaper, washiTape, diamond) also accept `scale` as a 7th render arg for hardcoded pixel values (noise frequencies, line widths, dash patterns)
- Thumbnail rendering at 48px uses raw defaults without scaling — this is intentional

### Background param persistence
When switching between backgrounds, customized params are preserved:
- `state.backgroundParamsCache` (keyed by backgroundId) stores params per background
- `setBackgroundParam()` writes through to both `backgroundParams` and the cache
- `backgroundPanel.js` thumbnail click handler saves current params to cache before switching, restores from cache on return

---

## State Shape (`state.js`)

```js
{
  photos: [],             // Array of photo objects {id, filename, ...}
  photoOrder: [],          // Array of photo IDs in display order
  globalParams: {
    orientation: 'portrait',
    aspectRatio: 2.17,
    seed: 12345,
    shadowEnabled: true,
    shadowBlur: 8,
    shadowOffsetX: 3,
    shadowOffsetY: 4,
    shadowOpacity: 35,
    shadowColor: 'dark'
  },
  arrangementId: 'grid',
  arrangementParams: {},   // Params for current arrangement
  backgroundId: 'solid',
  backgroundParams: { bgColor: 0 },
  backgroundParamsCache: {},  // {bgId: params} write-through cache
  palette: null,           // Current color palette
  availablePalettes: [],
  presets: []
}
```

---

## Grid Arrangement — Frame Styles & Shadows

`grid.js` supports 6 frame styles: `borderless`, `bordered`, `polaroid`, `rounded`, `roundedBorderless`, `circle`.

Drop shadow handling in `drawFramedPhoto()`:
- For **non-clipped** styles (bordered, polaroid): shadow applied directly, drawn with the frame
- For **clipped** styles (rounded, roundedBorderless, circle, borderless): shadow-casting shape drawn BEFORE `clip()`, then shadow cleared, then clip applied and content drawn. This prevents canvas shadows from being clipped.

Shadow params are in `globalParams` (not arrangement params) and controlled by the Drop Shadow section in the parameter panel.

---

## UI — Parameter Panel Sections

The right panel has 5 collapsible sections, each with a `▼` caret icon:

1. **Color Palette** — swatch preview + "Change" button → opens palette modal
2. **Background** — thumbnail gallery picker + per-background param controls (mounted by `backgroundPanel.js`)
3. **Drop Shadow** — enable toggle + blur/offsetX/offsetY/opacity sliders (injected by `app.js`)
4. **Global Settings** — orientation toggle, aspect ratio, seed, arrangement selector
5. **Arrangement Parameters** — dynamic controls from arrangement schema (rendered by `parameterPanel.js`)

### Collapsible section markup pattern
```html
<div class="params-section">
  <h3 class="params-section-header">Section Name<span class="params-section-toggle">▼</span></h3>
  <div class="params-section-content">
    <!-- section content -->
  </div>
</div>
```

Toggle logic in `initCollapsibleSections()` in `app.js`. CSS classes: `.params-section-toggle.collapsed` rotates caret -90deg, `.params-section-content.collapsed` sets `display: none`.

---

## Render Pipeline

1. `app.js init()` → `initRenderer(canvas, container)` registers two layers: `background` and `photos`
2. State changes trigger `scheduleRender()` → `requestAnimationFrame` → `render()`
3. `render()` calls `renderLayers(ctx, options)` which iterates registered layers
4. **Background layer**: looks up bg plugin → merges defaults with stored params → scales px params → calls `bg.render(ctx, w, h, params, palette, rng, scale)`
5. **Photos layer**: calls `arrangement.render(ctx, options)` which draws photos in the grid layout

### Export
`renderForExport(resolution)` creates an offscreen canvas at the target resolution and runs the same pipeline. Resolution presets: preview=400, hd=1290, 2k=2000, 4k=3000 (short side in pixels).

---

## Key Implementation Details

### `backgrounds/bgUtils.js` — shared utilities
- `resolveColor(ref, palette)` — resolves palette index/name to hex color
- `simplexNoise2D(x, y)` — 2D simplex noise for textures
- `hexToRgb(hex)` / `rgbToHex(r,g,b)` — color conversion
- `blendColors(c1, c2, t)` — linear color interpolation

### `backgrounds/registry.js` — plugin registry
- `registerBackground(config)` — registers a background module
- `getBackground(id)` — lookup by id
- `listBackgrounds()` — all registered backgrounds
- `getBackgroundsByCategory(category)` — filter by category
- `getBackgroundDefaults(id)` — extract default params from schema
- `getBackgroundCategories()` — ordered list of categories

### `arrangements/registry.js` — arrangement plugin registry
- `registerArrangement(config)` — registers an arrangement
- `getArrangement(id)` / `listArrangements()`
- `getDefaultParams(schema)` — extract defaults from schema
- `getPhotoCount(schema, params)` — compute required photo count

---

## What Was Completed in This Session (v0.2)

### 1. Grid shadow support (grid.js)
Rewrote `drawFramedPhoto()` to properly handle drop shadows for all 6 frame styles. Clipped frames draw shadow-casting shapes before clip regions.

### 2. Cleanup
- Removed `clearTextureCache` references from `paletteModal.js`
- Removed no-op `clearTextureCache` export from `renderer.js`
- Added deprecation comment to `textures.js`

### 3. Export resolution scaling
- Added `REFERENCE_SHORT_SIDE = 400` and `scaleBackgroundParams()` to `renderer.js`
- Added `unit: 'px'` to 28 schema entries across 18 background modules
- Fixed 6 modules with hardcoded pixel values (cork, paper, linen, tornPaper, washiTape, diamond)

### 4. Background param persistence
- Added `backgroundParamsCache: {}` to state
- `setBackgroundParam()` writes through to cache
- `backgroundPanel.js` saves/restores from cache on background switch

### 5. Collapsible parameter sections
- All 5 sections wrapped in `.params-section-content` divs with caret-toggle headers
- CSS for collapse animation (caret rotation + content hide)
- JS toggle logic in `initCollapsibleSections()` in `app.js`
- Updated shadow and background panel mounting to target `.params-section-content` wrappers

---

## Known Issues / Not Yet Done

- **No automated tests** — all verification has been static code review
- **Browser testing** — Chrome extension was not reliably connecting during this session; collapsible sections have not been visually tested
- **textures.js** is deprecated but still in the codebase (no active imports reference it)
- **Only one arrangement** (grid) exists — the arrangement selector dropdown only has "Grid"
- **Aspect ratio** is hardcoded to 2.17 (iPhone) — the UI shows it but it's not editable
- **No undo/redo** system
- **No preset save/load** — state.presets exists but is unused

---

## Files Modified This Session (for git reference)

| File | Changes |
|------|---------|
| `client/js/arrangements/grid.js` | Shadow handling in drawFramedPhoto |
| `client/js/panels/paletteModal.js` | Removed clearTextureCache import + calls |
| `client/js/canvas/renderer.js` | Removed clearTextureCache export, added scaling system |
| `client/js/canvas/textures.js` | Added deprecation comment |
| `client/js/state.js` | Added backgroundParamsCache, updated setBackgroundParam |
| `client/js/panels/backgroundPanel.js` | Cache-aware thumbnail click handler |
| `client/js/app.js` | Shadow/bg mounting fixes, collapsible sections |
| `client/index.html` | Collapsible section markup |
| `client/styles/main.css` | Collapsible section CSS |
| 18 background modules | `unit: 'px'` schema annotations |
| cork, paper, linen, tornPaper, washiTape, diamond | Scale param in render functions |
