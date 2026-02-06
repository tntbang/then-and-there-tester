# Pinboard Algorithm Tester - Checkpoint v0.0

## Project Overview

A local web application for testing and developing pinboard/mood board layout algorithms. The tool allows uploading photos, selecting color palettes derived from those photos, and rendering them in various arrangements on a canvas that can be exported.

**Target Use Case**: Generating mood board images for iPhone lock screens (portrait, 2.17:1 aspect ratio).

---

## Current State

### ✅ Completed (Phase 1-7 of Initial Plan)

The foundational application is fully implemented and ready for testing/iteration.

---

## Architecture

### Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (ES modules), HTML5 Canvas
- **Dependencies**: express, multer, uuid, sharp

### Project Structure

```
pinboard/
├── package.json
├── .gitignore
├── server/
│   ├── index.js                    # Express server (port 3000)
│   └── routes/photos.js            # Photo CRUD API
└── client/
    ├── index.html                  # Three-panel UI layout
    ├── styles/main.css             # Dark theme styling
    └── js/
        ├── app.js                  # Entry point, initialization
        ├── state.js                # Central state management
        ├── api.js                  # Server communication
        ├── panels/
        │   ├── photoPanel.js       # Upload, reorder, focal point UI
        │   ├── parameterPanel.js   # Parameter controls UI
        │   └── paletteModal.js     # Palette selection modal
        ├── canvas/
        │   ├── renderer.js         # Main render orchestrator
        │   ├── layers.js           # Layer management system
        │   ├── textures.js         # Procedural texture generators
        │   └── photoUtils.js       # Photo cropping & frame drawing
        ├── arrangements/
        │   ├── registry.js         # Arrangement plugin system
        │   └── grid.js             # Grid arrangement implementation
        ├── color/
        │   ├── extraction.js       # K-means color extraction
        │   ├── palettes.js         # Harmony & variant generators
        │   └── utils.js            # Color math (HSL, RGB, etc.)
        └── utils/
            ├── random.js           # Seeded PRNG (mulberry32)
            └── math.js             # Geometry utilities
```

---

## Implemented Features

### 1. Photo Management
- **Upload**: Drag-drop or click to upload multiple images
- **Thumbnails**: Auto-generated 300px thumbnails via Sharp
- **Reorder**: Drag-drop reordering in the photo list
- **Delete**: Individual or bulk delete
- **Focal Point**: Click-to-set focal point per photo (affects cropping)
- **Persistence**: Photos stored in `server/uploads/`, manifest in JSON

### 2. Color System
- **K-means Extraction**: Samples pixels from thumbnails, clusters to find dominant colors
- **Harmony Palettes**:
  - Complementary
  - Analogous
  - Triadic
  - Split-complementary
  - Monochromatic
- **Variant Palettes**:
  - Extracted (raw colors)
  - Muted (reduced saturation)
  - Vintage (warm shadows, cool highlights)
  - Value Stratified (1 light, 2 mid, 1 dark, 1 accent)
- **Utility Colors**: Auto-generated white, black, neutral per palette
- **Auto-refresh**: Palettes regenerate when photos change

### 3. Canvas Rendering
- **Layer System**: Background → Photos → Overlay (extensible)
- **DPI-aware**: Renders at device pixel ratio for sharp display
- **Responsive**: Canvas sizes to fit container while maintaining aspect ratio
- **Background Styles**:
  - Solid color (from palette)
  - Polkadots (procedural)
  - Stripes (diagonal)
  - Cork texture (procedural noise)
  - White / Black presets

### 4. Grid Arrangement
- **Parameters**:
  - Columns (1-10)
  - Rows (1-10)
  - Photo Size % (5-50%)
  - Linked Spacing toggle
- **Frame Styles** (weighted random assignment):
  - Borderless
  - Bordered (uniform border)
  - Polaroid (larger bottom border)
  - Rounded corners
  - Circle
- **Frame Options**:
  - Border size %
  - Polaroid bottom multiplier
  - Corner radius %
  - Border color (palette reference)

### 5. Parameter System
- **Schema-driven**: Arrangements define parameter schema, UI auto-generates
- **Parameter Types**: number (slider), boolean (toggle), weight (0-10), palette-color (dropdown), select
- **Conditional Visibility**: Parameters can depend on other parameter values
- **Collapsible Groups**: For organizing related parameters

### 6. Global Controls
- **Orientation**: Portrait / Landscape toggle
- **Aspect Ratio**: Fixed at 2.17:1 (iPhone)
- **Seed**: Increment/decrement/randomize for reproducible layouts
- **Background Style**: Dropdown selector

### 7. Export
- **Format**: PNG at 2x resolution
- **Filename**: `pinboard-{arrangement}-{seed}.png`
- **Method**: Canvas toBlob → download link

### 8. Keyboard Shortcuts
- `R` - Randomize seed
- `E` - Export
- `Shift+Delete` - Delete all photos

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/photos` | List all photos with order |
| POST | `/api/photos` | Upload photos (multipart) |
| DELETE | `/api/photos/:id` | Delete single photo |
| DELETE | `/api/photos` | Delete all photos |
| PUT | `/api/photos/order` | Update photo order |
| PUT | `/api/photos/:id/focal` | Update focal point |

---

## State Structure

```javascript
{
  photos: [
    {
      id: "uuid",
      filename: "original.jpg",
      originalPath: "originals/uuid.jpg",
      thumbnailPath: "thumbnails/uuid.jpg",
      width: 1920,
      height: 1080,
      aspectRatio: 1.78,
      focalPoint: { x: 0.5, y: 0.5 },
      dominantColors: [],
      uploadedAt: "ISO date"
    }
  ],
  photoOrder: ["uuid1", "uuid2", ...],
  globalParams: {
    orientation: "portrait",
    aspectRatio: 2.17,
    seed: 12345,
    pinboardStyle: "solid",
    backgroundColor: 0,
    dotColor: 1,
    stripeColor1: 0,
    stripeColor2: 1
  },
  arrangementId: "grid",
  arrangementParams: { /* from schema defaults */ },
  palette: { name, type, colors: [], utilities: {} },
  availablePalettes: []
}
```

---

## Arrangement Schema Format

```javascript
{
  id: "grid",
  name: "Grid",
  photoCount: { type: "computed", compute: (params) => params.cols * params.rows },
  params: [
    {
      id: "cols",
      name: "Columns",
      type: "number",
      default: 3,
      min: 1,
      max: 10,
      step: 1
    },
    {
      id: "frameStyles",
      name: "Frame Styles",
      type: "group",
      params: [
        { id: "borderlessWeight", name: "Borderless", type: "weight", default: 1 },
        // ...
      ]
    },
    {
      id: "borderPct",
      name: "Border Size %",
      type: "number",
      condition: { anyOf: ["borderedWeight", "polaroidWeight"] }
    }
  ]
}
```

---

## Known Limitations / Not Yet Implemented

1. **Arrangements**: Only Grid is implemented. Plan includes Scatter, Collage, Masonry, Polaroid Stack.
2. **Photo Decorations**: No tape, pins, shadows, or rotation yet.
3. **Overlays**: Layer exists but no overlay effects implemented.
4. **Presets**: No preset save/load system yet.
5. **Undo/Redo**: Not implemented.
6. **Mobile UI**: Desktop-focused layout only.

---

## To Run

```bash
cd pinboard
npm install
npm start
# Open http://localhost:3000
```

---

## Next Steps (Suggested)

1. **Test current implementation** - Upload photos, verify grid renders correctly
2. **Add more arrangements** - Scatter (random placement with collision) would be a good next target
3. **Photo decorations** - Tape strips, push pins, drop shadows
4. **Rotation** - Per-photo or random rotation within arrangements
5. **Overlay effects** - Vignette, grain, light leaks
6. **Preset system** - Save/load parameter configurations

---

## Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `server/routes/photos.js` | ~180 | All photo API logic |
| `client/js/canvas/renderer.js` | ~230 | Canvas orchestration |
| `client/js/arrangements/grid.js` | ~320 | Grid arrangement + frame rendering |
| `client/js/color/palettes.js` | ~250 | All palette generators |
| `client/js/color/extraction.js` | ~200 | K-means implementation |
| `client/js/panels/photoPanel.js` | ~280 | Photo management UI |
| `client/js/panels/parameterPanel.js` | ~350 | Parameter UI generation |
| `client/styles/main.css` | ~500 | Complete styling |

---

## Original Planning Document

See `pinboard-tester-plan.md` for the full original implementation plan with all phases detailed.
