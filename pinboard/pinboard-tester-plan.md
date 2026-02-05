# Pinboard Algorithm Tester — Implementation Plan

## Project Overview

A local web application for testing and developing pinboard/mood board layout algorithms. The tool allows uploading photos, configuring parameters, and generating visual pinboard outputs using various arrangement algorithms.

### Core Concepts

- **Arrangement Style**: A pluggable algorithm that defines how photos are laid out on a pinboard. Each style declares its parameter schema and render function.
- **Color Palette**: A set of 5 colors extracted/generated from uploaded photos, plus 3 utility colors (white, black, derived neutral).
- **Focal Point**: Per-photo crop anchor point for intelligent cropping.

---

## Technical Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Vanilla JS + HTML Canvas | ES modules, no framework |
| Backend | Node.js + Express | Minimal server for file persistence |
| Storage | Filesystem + JSON | Photos in `/uploads`, metadata in `manifest.json` |
| Color Extraction | Canvas-based k-means | Custom implementation for control |

---

## Project Structure

```
pinboard-tester/
├── server/
│   ├── index.js                 # Express server entry point
│   ├── routes/
│   │   └── photos.js            # Photo CRUD endpoints
│   └── uploads/                 # Persisted photos (gitignored)
│       ├── manifest.json        # Photo order + metadata
│       ├── originals/           # Full-size uploaded photos
│       └── thumbnails/          # Generated thumbnails
├── client/
│   ├── index.html
│   ├── styles/
│   │   └── main.css
│   ├── js/
│   │   ├── app.js               # Main entry, initialization
│   │   ├── state.js             # Central state management
│   │   ├── api.js               # Server API wrappers
│   │   ├── panels/
│   │   │   ├── photoPanel.js    # Photo upload, reorder, display
│   │   │   ├── parameterPanel.js# Global + arrangement params
│   │   │   └── paletteModal.js  # Color palette selection
│   │   ├── canvas/
│   │   │   ├── renderer.js      # Main render orchestrator
│   │   │   ├── layers.js        # Layer management
│   │   │   ├── textures.js      # Procedural texture generators
│   │   │   └── photoUtils.js    # Cropping, frames, photo drawing
│   │   ├── arrangements/
│   │   │   ├── registry.js      # Arrangement plugin registry
│   │   │   └── grid.js          # Grid arrangement implementation
│   │   ├── color/
│   │   │   ├── extraction.js    # K-means color extraction
│   │   │   ├── palettes.js      # Harmony/variant generators
│   │   │   └── utils.js         # Color math utilities
│   │   └── utils/
│   │       ├── random.js        # Seeded PRNG
│   │       └── math.js          # Geometry helpers
│   └── assets/
└── package.json
```

---

## Data Structures

### Photo Manifest (`manifest.json`)

```json
{
  "photos": [
    {
      "id": "uuid-string",
      "filename": "original-name.jpg",
      "originalPath": "originals/uuid.jpg",
      "thumbnailPath": "thumbnails/uuid.jpg",
      "width": 1920,
      "height": 1080,
      "aspectRatio": 1.778,
      "focalPoint": { "x": 0.5, "y": 0.5 },
      "dominantColors": ["#a1b2c3", "#d4e5f6"],
      "uploadedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "order": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### Color Palette

```javascript
{
  name: "Analogous Warm",
  type: "analogous", // extraction | complementary | analogous | triadic | split-complementary | monochromatic | muted | vintage
  colors: ["#e85d4c", "#e8944c", "#e8c84c", "#b8e84c", "#4ce885"],
  utilities: {
    white: "#ffffff",
    black: "#000000",
    neutral: "#8a8580" // Derived from palette temperature
  }
}
```

### Arrangement Schema Format

```javascript
{
  name: "Grid",
  id: "grid",
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
      id: "rows",
      name: "Rows",
      type: "number",
      default: 3,
      min: 1,
      max: 10,
      step: 1
    },
    {
      id: "photoSizePct",
      name: "Photo Size %",
      type: "number",
      default: 20,
      min: 5,
      max: 50,
      step: 1,
      suffix: "%"
    },
    {
      id: "linkedSpacing",
      name: "Link Spacing",
      type: "boolean",
      default: true,
      description: "Use same margin for horizontal and vertical"
    },
    {
      id: "frameStyles",
      name: "Frame Styles",
      type: "group",
      params: [
        {
          id: "borderlessWeight",
          name: "Borderless",
          type: "weight",
          default: 1
        },
        {
          id: "borderedWeight",
          name: "Bordered",
          type: "weight",
          default: 0
        },
        {
          id: "polaroidWeight",
          name: "Polaroid",
          type: "weight",
          default: 0
        },
        {
          id: "roundedWeight",
          name: "Rounded",
          type: "weight",
          default: 0
        },
        {
          id: "circleWeight",
          name: "Circle",
          type: "weight",
          default: 0
        }
      ]
    },
    {
      id: "borderPct",
      name: "Border Size %",
      type: "number",
      default: 5,
      min: 1,
      max: 20,
      step: 1,
      condition: { anyOf: ["borderedWeight", "polaroidWeight", "roundedWeight"] }
    },
    {
      id: "polaroidMult",
      name: "Polaroid Bottom Multiplier",
      type: "number",
      default: 3,
      min: 2,
      max: 5,
      step: 0.5,
      condition: "polaroidWeight"
    },
    {
      id: "cornerRadius",
      name: "Corner Radius %",
      type: "number",
      default: 10,
      min: 5,
      max: 50,
      step: 5,
      condition: "roundedWeight"
    },
    {
      id: "borderColor",
      name: "Border Color",
      type: "palette-color",
      default: "white"
    }
  ]
}
```

### Global Parameters

```javascript
{
  orientation: "portrait", // "portrait" | "landscape"
  aspectRatio: 2.17,       // iPhone standard
  seed: 12345,
  pinboardStyle: "cork",   // "solid" | "polkadots" | "stripes" | "cork" | "white" | "black"
  backgroundColor: 0,      // Palette index or "white" | "black" | "neutral"
  dotColor: 1,             // For polkadots
  stripeColor1: 0,         // For stripes
  stripeColor2: 1
}
```

### Application State

```javascript
{
  photos: [],              // From manifest
  photoOrder: [],          // ID array
  globalParams: {},        // Global parameters
  arrangementId: "grid",   // Current arrangement
  arrangementParams: {},   // Current arrangement's parameters
  palette: null,           // Selected palette object
  availablePalettes: [],   // Generated palette options
  presets: []              // Saved parameter snapshots
}
```

---

## API Endpoints

### Photos

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/photos` | List all photos | - | `{ photos: [...], order: [...] }` |
| POST | `/api/photos` | Upload photo(s) | `multipart/form-data` | `{ photos: [newPhoto, ...] }` |
| DELETE | `/api/photos/:id` | Delete single photo | - | `{ success: true }` |
| DELETE | `/api/photos` | Delete all photos | - | `{ success: true }` |
| PUT | `/api/photos/order` | Reorder photos | `{ order: [id, ...] }` | `{ success: true }` |
| PUT | `/api/photos/:id/focal` | Update focal point | `{ x: 0.5, y: 0.3 }` | `{ success: true }` |

### Presets

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/presets` | List presets | - | `{ presets: [...] }` |
| POST | `/api/presets` | Save preset | `{ name, state }` | `{ preset: {...} }` |
| DELETE | `/api/presets/:id` | Delete preset | - | `{ success: true }` |

---

## Phase 1: Foundation

### Task 1.1: Project Scaffolding

Create the basic project structure with npm initialization.

**Files to create:**
- `package.json` with dependencies: `express`, `multer`, `uuid`, `sharp`
- `server/index.js` — Express server on port 3000, serves `client/` statically
- `client/index.html` — Basic HTML shell with three-panel layout
- `client/styles/main.css` — Layout styles for three panels
- `.gitignore` — Include `node_modules/`, `server/uploads/`

**Acceptance criteria:**
- `npm install && npm start` runs server
- Visiting `localhost:3000` shows three-panel layout

### Task 1.2: Photo Upload Endpoint

Implement `POST /api/photos` for uploading photos.

**Details:**
- Use `multer` for multipart handling
- Generate UUID for each photo
- Save original to `uploads/originals/{uuid}.{ext}`
- Use `sharp` to generate thumbnail (300px max dimension) to `uploads/thumbnails/{uuid}.jpg`
- Extract dimensions and aspect ratio
- Add to `manifest.json` (create if doesn't exist)
- Return new photo object(s)

**Acceptance criteria:**
- Can POST image file and receive photo metadata
- Original and thumbnail saved to correct paths
- Manifest updated with new entry

### Task 1.3: Photo List Endpoint

Implement `GET /api/photos`.

**Details:**
- Read `manifest.json`
- Return photos array and order array
- If manifest doesn't exist, return empty arrays

**Acceptance criteria:**
- Returns correct photo data
- Returns empty state gracefully

### Task 1.4: Photo Delete Endpoints

Implement `DELETE /api/photos/:id` and `DELETE /api/photos`.

**Details:**
- Single delete: Remove from manifest, delete original + thumbnail files
- Delete all: Clear manifest, remove all files in originals/ and thumbnails/

**Acceptance criteria:**
- Single photo deletion works
- Delete all clears everything
- Handles non-existent IDs gracefully

### Task 1.5: Photo Reorder Endpoint

Implement `PUT /api/photos/order`.

**Details:**
- Accept `{ order: [id1, id2, ...] }`
- Validate all IDs exist in manifest
- Update manifest order array

**Acceptance criteria:**
- Order persists after reorder
- Invalid IDs rejected with 400

### Task 1.6: Basic HTML Layout

Create the three-panel UI structure.

**Layout:**
```
+------------------+------------------------+------------------+
|                  |                        |                  |
|   Photo Panel    |    Canvas Preview      |  Parameter Panel |
|   (250px)        |    (flexible)          |  (300px)         |
|                  |                        |                  |
+------------------+------------------------+------------------+
```

**Details:**
- Flexbox layout, full viewport height
- Photo panel: scrollable, fixed width 250px
- Canvas panel: flexible width, centered canvas element
- Parameter panel: scrollable, fixed width 300px

**Acceptance criteria:**
- Three panels visible and correctly sized
- Responsive to window height
- Panels scroll independently

### Task 1.7: Photo Panel UI

Implement the photo management interface.

**Features:**
- Display thumbnails in a vertical list
- Drag-and-drop zone at top for uploading (or click to browse)
- Drag-to-reorder thumbnails (use HTML5 drag/drop or a simple implementation)
- "Delete All" button at bottom
- Visual feedback during drag operations

**Files:**
- `client/js/panels/photoPanel.js`
- `client/js/api.js` — fetch wrappers

**Acceptance criteria:**
- Can upload photos via drag-drop or file picker
- Photos display as thumbnails
- Can reorder by dragging
- Delete all removes all photos
- Changes persist on page refresh

### Task 1.8: Photo Count Warning

Show photo count status based on arrangement requirements.

**Details:**
- Display "X / Y photos" where Y is arrangement's required count
- If X < Y: Show warning with red/orange styling
- If X >= Y: Show success state with green styling
- For now, hardcode Y = 9 (3x3 grid default)

**Acceptance criteria:**
- Count updates when photos added/removed
- Warning state visually distinct
- Correct messaging ("Need 4 more photos")

---

## Phase 2: State & Parameter Infrastructure

### Task 2.1: State Module

Create central state management.

**File:** `client/js/state.js`

**Features:**
- Single state object holding all application state
- `subscribe(listener)` for change notifications
- `setState(partial)` for updates (shallow merge)
- `getState()` for reading

**Acceptance criteria:**
- Components can subscribe to state changes
- State updates trigger re-renders
- State is accessible globally

### Task 2.2: Seeded RNG Utility

Implement deterministic random number generator.

**File:** `client/js/utils/random.js`

**Implementation:** Use mulberry32 or similar simple PRNG.

```javascript
function createRNG(seed) {
  // Returns object with:
  // - random(): number 0-1
  // - randomInt(min, max): integer in range
  // - randomChoice(array): random element
  // - randomWeighted(weights): index based on weights
}
```

**Acceptance criteria:**
- Same seed produces same sequence
- Different seeds produce different sequences
- All random methods work correctly

### Task 2.3: Arrangement Registry

Create plugin system for arrangements.

**File:** `client/js/arrangements/registry.js`

```javascript
const arrangements = {};

function registerArrangement(config) {
  // config: { id, name, schema, render }
  arrangements[config.id] = config;
}

function getArrangement(id) { ... }
function listArrangements() { ... }
```

**Acceptance criteria:**
- Can register new arrangements
- Can retrieve by ID
- Can list all registered arrangements

### Task 2.4: Grid Arrangement Schema

Define the grid arrangement configuration.

**File:** `client/js/arrangements/grid.js`

**Details:**
- Export schema object matching format defined above
- Export placeholder render function (implement in Phase 6)
- Register with registry on module load

**Acceptance criteria:**
- Grid schema complete with all parameters
- Schema follows defined format
- Registered in registry

### Task 2.5: Global Parameters UI

Implement global parameter controls.

**Details:**
- Orientation toggle: Portrait / Landscape
- Aspect ratio: Display only (2.17:1), maybe editable later
- Seed: Number input + up/down buttons + randomize (dice) button
- Arrangement selector: Dropdown populated from registry

**Acceptance criteria:**
- All global controls functional
- Seed increment/decrement by 1
- Randomize generates new random seed
- Arrangement dropdown shows registered arrangements

### Task 2.6: Parameter Panel Renderer

Auto-generate UI from arrangement schema.

**File:** `client/js/panels/parameterPanel.js`

**Supported param types:**
- `number`: Slider + number input, respects min/max/step
- `boolean`: Toggle switch or checkbox
- `weight`: Slider 0-10 for style weights
- `palette-color`: Dropdown with palette colors + utilities
- `group`: Collapsible section containing child params
- `select`: Dropdown with options array

**Conditional rendering:**
- `condition` field shows/hides param based on other param values
- `condition: "paramId"` — show if paramId > 0
- `condition: { anyOf: [...] }` — show if any listed param > 0

**Acceptance criteria:**
- Schema renders to appropriate controls
- Values bind to state
- Conditional params show/hide correctly
- Weights displayed with normalized preview

### Task 2.7: Arrangement Switching

Handle switching between arrangements.

**Details:**
- On arrangement change, load that arrangement's schema
- Reset arrangement params to defaults
- Rebuild parameter panel UI
- Update photo count requirement

**Acceptance criteria:**
- Switching arrangements updates param panel
- Defaults applied correctly
- Photo count updates

---

## Phase 3: Color System

### Task 3.1: Color Extraction

Implement k-means color extraction from photos.

**File:** `client/js/color/extraction.js`

**Algorithm:**
1. Load all photo thumbnails to canvas
2. Sample ~1000 pixels per photo
3. Run k-means with k=10 clusters
4. Return sorted by cluster size (most dominant first)

**Acceptance criteria:**
- Extracts 10 colors from photo set
- Results reasonably represent photo colors
- Handles single photo and many photos

### Task 3.2: Color Categorization

Separate dominant, accent, and neutral colors.

**Details:**
- Dominant: Top 2-3 by pixel count
- Accent: High saturation, lower count
- Neutral: Saturation < 15%, any lightness

**Acceptance criteria:**
- Colors correctly categorized
- Available for palette generation

### Task 3.3: Color Utilities

Implement color math helpers.

**File:** `client/js/color/utils.js`

**Functions:**
- `hexToHSL(hex)` / `hslToHex(h, s, l)`
- `hexToRGB(hex)` / `rgbToHex(r, g, b)`
- `adjustSaturation(hex, amount)`
- `adjustLightness(hex, amount)`
- `shiftHue(hex, degrees)`
- `getContrastColor(hex)` — returns black or white
- `blendColors(hex1, hex2, ratio)`
- `getColorTemperature(hex)` — warm/cool score

**Acceptance criteria:**
- All conversions accurate
- Adjustments work correctly

### Task 3.4: Harmony Generators

Generate palettes based on color theory.

**File:** `client/js/color/palettes.js`

**From dominant hue, generate:**
- **Complementary**: dominant + complement + 3 tints/shades
- **Analogous**: 5 adjacent hues (±30° each)
- **Triadic**: 3 hues at 120° + 2 supporting
- **Split-complementary**: dominant + 2 split complements + 2 tints
- **Monochromatic**: dominant hue, 5 different saturation/lightness

**Each returns palette object with 5 colors.**

**Acceptance criteria:**
- All harmony types generate valid palettes
- Palettes are visually harmonious

### Task 3.5: Variant Generators

Generate aesthetic variant palettes.

**Variants:**
- **Muted**: Reduce saturation 30%, add warm undertone
- **Vintage**: Reduce saturation 20%, warm shadows, cool highlights
- **Value-stratified**: Ensure 1 light, 2 mid, 1 dark, 1 accent

**Acceptance criteria:**
- Variants meaningfully different from raw extraction
- Match described aesthetic

### Task 3.6: Derived Neutral

Calculate utility neutral color.

**Details:**
- Analyze palette overall temperature
- If warm: tint gray toward warm beige
- If cool: tint gray toward cool gray
- Lightness: medium (50-60%)

**Acceptance criteria:**
- Neutral complements palette
- Works as subtle background

### Task 3.7: Palette Modal UI

Create palette selection interface.

**File:** `client/js/panels/paletteModal.js`

**Layout:**
- Modal overlay, centered panel
- Grid of palette options (4 columns)
- Each shows: name, 5 color swatches
- Click to select, close modal
- Selected palette highlighted
- "Regenerate" button re-runs extraction

**Sections:**
- "Extracted" — raw extraction result
- "Harmonies" — complementary, analogous, etc.
- "Variants" — muted, vintage, etc.

**Acceptance criteria:**
- Modal opens/closes
- All generated palettes displayed
- Selection updates state
- Current selection indicated

### Task 3.8: Color Picker Component

Reusable palette color selector.

**Appearance:**
- Dropdown button showing current color swatch
- Dropdown menu: 5 palette colors + divider + white/black/neutral
- Click to select

**Acceptance criteria:**
- Shows all 8 color options
- Updates bound parameter
- Used throughout param panel

### Task 3.9: Extraction Trigger

Re-extract colors when photos change.

**Details:**
- Watch for photo additions/removals
- Debounce 500ms
- Re-run extraction
- Regenerate all palettes
- If no palette selected, auto-select first
- If palette selected, try to keep same type

**Acceptance criteria:**
- Palettes update when photos change
- Selection persists when possible

---

## Phase 4: Canvas Rendering Foundation

### Task 4.1: Canvas Setup

Initialize canvas with correct sizing.

**File:** `client/js/canvas/renderer.js`

**Details:**
- Create canvas element in center panel
- Size to fit panel while maintaining aspect ratio
- Handle devicePixelRatio for sharp rendering
- Track preview dimensions vs. output dimensions

**Acceptance criteria:**
- Canvas displays at correct aspect ratio
- Sharp on high-DPI displays
- Resizes with window

### Task 4.2: Layer System

Implement compositing layers.

**File:** `client/js/canvas/layers.js`

**Layers (bottom to top):**
1. Background (solid color or texture)
2. Photos (the actual images)
3. Frames (borders, polaroid edges)
4. Overlay (future: stickers, text)

**Each layer:**
- Has render function
- Can be enabled/disabled
- Renders to main canvas in order

**Acceptance criteria:**
- Layers render in correct order
- Layer system extensible

### Task 4.3: Solid Background

Render solid color backgrounds.

**Details:**
- Fill entire canvas with selected color
- Color from palette or utility

**Acceptance criteria:**
- Solid backgrounds work
- Color picker integrated

### Task 4.4: Procedural Textures

Generate texture patterns.

**File:** `client/js/canvas/textures.js`

**Textures:**

**Polkadots:**
- Regular grid of circles
- Parameters: dot size, spacing, colors (dot, background)
- Slight randomness in position optional

**Stripes:**
- Diagonal, horizontal, or vertical
- Parameters: stripe width, colors (2)
- Direction option

**Cork:**
- Perlin/simplex noise base
- Brown/tan color range from palette
- Subtle speckles overlay

**Acceptance criteria:**
- Each texture generates seamlessly tileable pattern
- Colors driven by palette
- Patterns look good at various scales

### Task 4.5: Texture Tiling

Apply textures as background.

**Details:**
- Generate texture to small canvas (256x256)
- Use `ctx.createPattern()` for tiling
- Fill main canvas with pattern

**Acceptance criteria:**
- Textures tile seamlessly
- No visible seams or artifacts

### Task 4.6: Pinboard Style Selector

UI for background selection.

**Options:**
- Solid (uses backgroundColor)
- Polkadots (uses backgroundColor + dotColor)
- Stripes (uses stripeColor1 + stripeColor2)
- Cork (uses palette-derived browns)
- White (hardcoded #ffffff)
- Black (hardcoded #000000)

**Acceptance criteria:**
- Dropdown in global params
- Relevant color pickers show/hide based on selection
- Background renders correctly

### Task 4.7: Render Trigger

Re-render on state changes.

**Details:**
- Subscribe to state changes
- Debounce renders (100ms)
- Clear canvas and re-render all layers
- Show subtle loading state for slow renders

**Acceptance criteria:**
- Canvas updates when any param changes
- No excessive re-renders
- Smooth user experience

---

## Phase 5: Photo Rendering

### Task 5.1: Focal Point Storage

Add focal point to photo data.

**Details:**
- Add `focalPoint: { x, y }` to photo schema (0-1 normalized)
- Default to `{ x: 0.5, y: 0.5 }` (center)
- Update manifest on focal point change

**Acceptance criteria:**
- Focal point persists
- Default applied to new uploads

### Task 5.2: Focal Point UI

Allow setting focal point per photo.

**Details:**
- Click thumbnail to enter "focal point mode"
- Show larger preview with crosshair
- Click to set focal point
- Click outside or press Escape to exit
- Show subtle indicator on thumbnails with non-center focal points

**Acceptance criteria:**
- Can adjust focal point
- Visual feedback on current point
- Changes persist

### Task 5.3: Crop Calculation

Calculate source rectangle for cropping.

**File:** `client/js/canvas/photoUtils.js`

```javascript
function calculateCrop(sourceW, sourceH, targetAspect, focalX, focalY) {
  // Returns { x, y, width, height } in source coordinates
  // Crop is centered on focal point as much as possible
  // Maintains target aspect ratio
}
```

**Acceptance criteria:**
- Correct crop rectangle calculated
- Focal point centered when possible
- Handles edge cases (focal point near edge)

### Task 5.4: Photo Drawing Utility

Draw cropped photo to canvas.

```javascript
function drawPhoto(ctx, img, sourceRect, destRect) {
  // Draw portion of img defined by sourceRect
  // To canvas location defined by destRect
}
```

**Acceptance criteria:**
- Photos draw correctly
- Cropping applied properly
- No stretching or distortion

### Task 5.5: Frame Drawing Utilities

Implement frame style renderers.

**Frame styles:**

**Borderless:**
- Just the photo, no frame

**Bordered:**
- Solid color border around photo
- Border width as % of photo size

**Polaroid:**
- Like bordered, but bottom border = regular border × multiplier
- Slight shadow optional

**Rounded Corners:**
- Clip photo to rounded rectangle
- Can have border or not

**Circle:**
- Clip photo to circle
- Can have border or not

**Each returns the actual photo draw area (inside any border).**

**Acceptance criteria:**
- All frame styles render correctly
- Frame respects border color from palette
- Calculations correct for all sizes

### Task 5.6: Frame Parameters

Wire frame parameters to rendering.

**Parameters:**
- `borderPct`: Border thickness as % of photo dimension
- `polaroidMult`: Bottom border multiplier
- `cornerRadius`: Radius as % of photo dimension (for rounded/circle)
- `borderColor`: From palette

**Acceptance criteria:**
- Parameters affect rendering
- Live preview updates

---

## Phase 6: Grid Arrangement

### Task 6.1: Grid Layout Calculation

Compute photo positions for grid.

**Inputs:**
- `boardWidth`, `boardHeight`
- `cols`, `rows`
- `photoSizePct`
- `linkedSpacing`

**Algorithm:**
```
photoSide = min(boardWidth, boardHeight) * (photoSizePct / 100)
totalPhotoWidth = cols * photoSide
totalPhotoHeight = rows * photoSide
hGap = (boardWidth - totalPhotoWidth) / (cols + 1)
vGap = (boardHeight - totalPhotoHeight) / (rows + 1)

if linkedSpacing:
  gap = min(hGap, vGap)
  hOffset = (boardWidth - (cols * photoSide + (cols - 1) * gap)) / 2
  vOffset = (boardHeight - (rows * photoSide + (rows - 1) * gap)) / 2
  use gap for both, offset to center
else:
  hOffset = hGap
  vOffset = vGap

for each position (row, col):
  x = hOffset + col * (photoSide + gap)
  y = vOffset + row * (photoSide + gap)
```

**Output:** Array of `{ x, y, size }` for each photo position.

**Acceptance criteria:**
- Positions calculated correctly
- Spacing even and centered
- Linked mode works

### Task 6.2: Validation

Check if layout is possible.

**Checks:**
- Photos fit within board dimensions
- At least 1 photo
- Cols and rows > 0

**Return error messages for invalid states.**

**Acceptance criteria:**
- Invalid configurations detected
- User-friendly error messages
- Prevents render with invalid params

### Task 6.3: Frame Style Assignment

Assign frame styles using seeded RNG.

**Algorithm:**
```javascript
function assignFrameStyles(photoCount, weights, rng) {
  const normalized = normalizeWeights(weights);
  return Array(photoCount).fill(null).map(() => 
    rng.randomWeighted(normalized)
  );
}
```

**Acceptance criteria:**
- Same seed produces same assignments
- Distribution matches weights over many samples
- Works with single style (100% one type)

### Task 6.4: Grid Render Function

Implement the main grid rendering.

**Steps:**
1. Validate parameters, return early if invalid
2. Calculate layout positions
3. Assign frame styles
4. For each position:
   - Get photo from ordered list
   - Calculate crop based on focal point
   - Draw frame (determines actual photo rect)
   - Draw photo into frame

**Acceptance criteria:**
- Grid renders correctly
- All parameters respected
- Photos cropped and framed properly

### Task 6.5: Orientation Handling

Handle portrait ↔ landscape.

**For grid:**
- Swap board dimensions
- Cols and rows stay as user set
- Photos rotate 90° to remain upright

**Implementation:**
- Track orientation in global state
- Adjust board dimensions before layout
- May need to rotate source images on draw

**Acceptance criteria:**
- Both orientations work
- Photos always right-side up
- Switching is seamless

### Task 6.6: Photo Count Integration

Wire photo count to arrangement.

**Details:**
- Grid needs exactly `cols × rows` photos
- Update photo panel warning when cols/rows change
- Render only if enough photos

**Acceptance criteria:**
- Count updates dynamically
- Warning shows when not enough photos
- Graceful handling when count changes

---

## Phase 7: Polish & Export

### Task 7.1: Export Resolution

Add resolution selection.

**Options:**
- 1x: Preview size
- 2x: 2× preview dimensions
- 3x: 3× preview dimensions
- Custom: User enters pixel dimensions

**Acceptance criteria:**
- Resolution selector in UI
- Selection persists

### Task 7.2: High-Resolution Render

Render at export resolution.

**Details:**
- Create offscreen canvas at target size
- Re-run all render logic at new scale
- Scale all positions, sizes proportionally

**Acceptance criteria:**
- Exports render at correct resolution
- Quality maintained
- No artifacts from scaling

### Task 7.3: Export Download

Save rendered canvas as file.

**Details:**
- "Export" button in UI
- `canvas.toBlob()` at quality 0.95 for JPEG, PNG option
- Create download link, trigger download
- Filename: `pinboard-{arrangement}-{seed}.{ext}`

**Acceptance criteria:**
- Download works in all browsers
- File quality good
- Filename descriptive

### Task 7.4: Preset Save

Save current configuration.

**Preset includes:**
- Arrangement ID
- All arrangement params
- Global params
- Palette
- Seed
- Name (user-provided)

**Storage:** `localStorage` initially, could add server persistence.

**Acceptance criteria:**
- Can save current state as preset
- Prompted for name
- Saved to storage

### Task 7.5: Preset Load

Restore saved configuration.

**Details:**
- Load preset from storage
- Apply all values to state
- Trigger re-render
- Handle missing photos gracefully (warn user)

**Acceptance criteria:**
- Presets restore correctly
- Arrangement switches if needed
- Graceful degradation

### Task 7.6: Preset Library UI

Manage saved presets.

**Features:**
- List in sidebar or modal
- Click to load
- Delete button per preset
- Show preview thumbnail if feasible

**Acceptance criteria:**
- Presets listed
- Load/delete functional
- Clear visual organization

### Task 7.7: Keyboard Shortcuts

Add power-user shortcuts.

**Shortcuts:**
- `R`: Randomize seed
- `E`: Export
- `↑`/`↓`: Increment/decrement seed when seed input focused
- `Delete`: Delete all photos (with confirmation)

**Acceptance criteria:**
- Shortcuts work
- Don't interfere with text input
- Discoverable (tooltip or help)

### Task 7.8: Loading States

Add feedback during operations.

**Loading states for:**
- Photo upload
- Color extraction
- Render (if slow)
- Export

**Acceptance criteria:**
- User knows when operations are in progress
- No UI freezing perception

---

## Implementation Notes

### Canvas Coordinate System

- Origin (0, 0) at top-left
- X increases right
- Y increases down
- All positions in pixels at current render scale

### Color Format

- Internal: Hex strings (`#rrggbb`)
- Display: Hex or RGB based on context
- Canvas: Hex strings work directly

### Error Handling

- Validate all user inputs
- Show user-friendly error messages
- Console warnings for developer debugging
- Graceful degradation where possible

### Performance Considerations

- Debounce renders and extractions
- Use thumbnails for extraction
- Cache texture patterns
- Consider Web Workers for heavy extraction

---

## Testing Checklist

### Photo Management
- [ ] Upload single photo
- [ ] Upload multiple photos
- [ ] Reorder by dragging
- [ ] Delete single photo
- [ ] Delete all photos
- [ ] Photos persist after refresh
- [ ] Focal point setting

### Parameters
- [ ] Global params update state
- [ ] Arrangement params render from schema
- [ ] Conditional params show/hide
- [ ] Seed controls work
- [ ] Orientation toggle works

### Color System
- [ ] Colors extracted from photos
- [ ] All harmony types generate
- [ ] Variant palettes work
- [ ] Palette modal functional
- [ ] Color pickers use palette

### Rendering
- [ ] Background styles all work
- [ ] Textures tile correctly
- [ ] Photos draw with correct crop
- [ ] All frame styles render
- [ ] Grid layout calculated correctly
- [ ] Orientation swap works

### Export
- [ ] Export at different resolutions
- [ ] Downloaded file is correct
- [ ] Presets save and load
