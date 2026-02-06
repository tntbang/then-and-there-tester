# Pinboard Algorithm Tester — Iteration Plan v0.1

## Overview

This iteration addresses usability issues and bugs discovered during initial testing of v0.0.

**Issues to fix:**
1. Photo panel thumbnails become unusable with many photos
2. Landscape orientation toggle doesn't work
3. Export resolution too low for viewing individual photos
4. Texture tiling has visible seams (polkadots, stripes)
5. Missing frame style: Rounded Borderless
6. Default parameters need adjustment for iPhone wallpaper use case

---

## Issue 1: Photo Panel Thumbnails

### Problem
With 23 photos, thumbnails become thin horizontal slivers — impossible to identify or set focal points.

### Solution
Change from variable-height list to fixed-size square grid layout.

### Specification
- **Layout:** 3-column grid of square thumbnails
- **Thumbnail size:** ~75×75px (to fit 3 across in 250px panel with gaps)
- **Spacing:** 8px gap between thumbnails
- **Overflow:** Scrollable container when photos exceed visible area
- **Drag-drop reorder:** Must still work with new layout

### Files to Modify

**`client/js/panels/photoPanel.js`**

Update the photo list rendering:

```javascript
// Current: Photos rendered as variable-width thumbnails
// Change to: Fixed-size square grid

function renderPhotoList() {
  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'photo-grid';
  
  for (const photo of orderedPhotos) {
    const item = document.createElement('div');
    item.className = 'photo-grid-item';
    item.draggable = true;
    item.dataset.id = photo.id;
    
    const img = document.createElement('img');
    img.src = `/uploads/${photo.thumbnailPath}`;
    img.alt = photo.filename;
    
    // Focal point indicator (if not center)
    if (photo.focalPoint && (photo.focalPoint.x !== 0.5 || photo.focalPoint.y !== 0.5)) {
      const indicator = document.createElement('div');
      indicator.className = 'focal-indicator';
      item.appendChild(indicator);
    }
    
    item.appendChild(img);
    grid.appendChild(item);
  }
  
  photoListEl.innerHTML = '';
  photoListEl.appendChild(grid);
}
```

**`client/styles/main.css`**

Add grid styles:

```css
/* Photo grid layout */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 8px;
}

.photo-grid-item {
  aspect-ratio: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  cursor: grab;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.photo-grid-item:hover {
  border-color: var(--accent-color);
}

.photo-grid-item.dragging {
  opacity: 0.5;
}

.photo-grid-item.drag-over {
  border-color: var(--accent-color);
  border-style: dashed;
}

.photo-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-grid-item .focal-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
  border: 1px solid white;
}

/* Photo list container - ensure scrollable */
.photo-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
```

### Acceptance Criteria
- [ ] Photos display as ~75px squares in 3-column grid
- [ ] Grid scrolls when photos overflow
- [ ] Drag-to-reorder still works
- [ ] Click to set focal point still works
- [ ] Focal point indicator visible on non-centered photos
- [ ] Works with 1 photo, 10 photos, 50 photos

---

## Issue 2: Landscape Orientation Bug

### Problem
Clicking the Landscape toggle updates state but canvas dimensions don't change.

### Root Cause
`handleResize()` in `renderer.js` calculates canvas dimensions based on orientation, but it's only called on window resize and initialization — not when orientation changes via state update.

### Solution
Track orientation in the render function and call `handleResize()` when it changes.

### Files to Modify

**`client/js/canvas/renderer.js`**

Add orientation tracking at module level:

```javascript
// Add near top with other module variables
let lastOrientation = null;
```

Update the `render()` function:

```javascript
async function render() {
  if (!canvas || !ctx) return;

  const state = getState();

  // Check if orientation changed - need to resize canvas
  if (lastOrientation !== state.globalParams.orientation) {
    lastOrientation = state.globalParams.orientation;
    handleResize();
    return; // handleResize calls scheduleRender, which will call render() again
  }

  // ... rest of existing render code unchanged
}
```

Also reset `lastOrientation` when renderer initializes:

```javascript
export function initRenderer(canvasEl, container) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  containerEl = container;
  lastOrientation = null;  // Add this line

  // ... rest unchanged
}
```

### Acceptance Criteria
- [ ] Clicking Portrait/Landscape toggles updates canvas dimensions
- [ ] Canvas maintains correct aspect ratio in both orientations
- [ ] Photos re-render correctly in new orientation
- [ ] No infinite render loops
- [ ] Window resize still works correctly

---

## Issue 3: Export Resolution

### Problem
Current 2x export (~800px wide) is too low resolution for examining individual photos when zoomed in.

### Solution
Add resolution selector with higher default, targeting iPhone screen resolutions.

### Specification

**Resolution options:**

| Option | Short Side | Full Dimensions (2.17:1) | File Size Est. |
|--------|------------|--------------------------|----------------|
| Preview | 400px | 400 × 868 | ~200KB |
| HD | 1290px | 1290 × 2799 | ~1.5MB |
| 2K | 2000px | 2000 × 4340 | ~3MB |
| 4K | 3000px | 3000 × 6510 | ~6MB |

**Default:** 2K (good balance of quality and file size)

### Files to Modify

**`client/index.html`**

Add resolution selector near export button:

```html
<div class="export-controls">
  <select id="exportResolution">
    <option value="preview">Preview (400px)</option>
    <option value="hd">HD (1290px)</option>
    <option value="2k" selected>2K (2000px)</option>
    <option value="4k">4K (3000px)</option>
  </select>
  <button id="exportBtn" class="btn btn-primary">
    <span class="btn-text">Export PNG</span>
    <span class="btn-loading">Exporting...</span>
  </button>
</div>
```

**`client/styles/main.css`**

Style the export controls:

```css
.export-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.export-controls select {
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 14px;
}
```

**`client/js/canvas/renderer.js`**

Update `renderForExport()` to accept resolution option:

```javascript
/**
 * Resolution presets (short side in pixels)
 */
const EXPORT_RESOLUTIONS = {
  preview: 400,
  hd: 1290,
  '2k': 2000,
  '4k': 3000
};

/**
 * Render at specified resolution for export
 * @param {string} resolution - Resolution preset key
 * @returns {HTMLCanvasElement} Rendered canvas
 */
export async function renderForExport(resolution = '2k') {
  const state = getState();

  const exportCanvas = document.createElement('canvas');
  const isPortrait = state.globalParams.orientation === 'portrait';
  const aspectRatio = state.globalParams.aspectRatio || IPHONE_ASPECT;

  // Get short side from resolution preset
  const shortSide = EXPORT_RESOLUTIONS[resolution] || EXPORT_RESOLUTIONS['2k'];

  let width, height;
  if (isPortrait) {
    width = shortSide;
    height = Math.round(shortSide * aspectRatio);
  } else {
    height = shortSide;
    width = Math.round(shortSide * aspectRatio);
  }

  exportCanvas.width = width;
  exportCanvas.height = height;

  const exportCtx = exportCanvas.getContext('2d');
  // No scale needed - we're rendering at actual pixel dimensions

  // Get ordered photos
  const orderedPhotos = getOrderedPhotos(state);

  // Load full-resolution images for export
  const exportImages = await loadFullResImages(state.photos);

  // Render all layers
  const renderOptions = {
    boardWidth: width,
    boardHeight: height,
    photos: orderedPhotos,
    photoImages: exportImages,  // Use full-res images
    globalParams: state.globalParams,
    arrangementParams: state.arrangementParams,
    palette: state.palette,
    arrangement: getArrangement(state.arrangementId)
  };

  renderLayers(exportCtx, renderOptions);

  return exportCanvas;
}

/**
 * Load full resolution images (originals, not thumbnails)
 * @param {Array} photos - Photo objects
 * @returns {Object} Map of photo ID to Image
 */
async function loadFullResImages(photos) {
  const images = {};
  
  await Promise.all(photos.map(photo => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        images[photo.id] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load full-res image: ${photo.id}`);
        resolve();
      };
      // Load original, not thumbnail
      img.src = `/uploads/${photo.originalPath}`;
    });
  }));
  
  return images;
}
```

**`client/js/app.js`**

Update export handler to use resolution selector:

```javascript
function setupExport() {
  const exportBtn = document.getElementById('exportBtn');
  const resolutionSelect = document.getElementById('exportResolution');

  exportBtn.addEventListener('click', async () => {
    exportBtn.classList.add('loading');
    exportBtn.disabled = true;

    try {
      const resolution = resolutionSelect.value;
      const exportCanvas = await renderForExport(resolution);

      exportCanvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to generate export');
          return;
        }

        const state = getState();
        const filename = `pinboard-${state.arrangementId}-${state.globalParams.seed}-${resolution}.png`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    } finally {
      exportBtn.classList.remove('loading');
      exportBtn.disabled = false;
    }
  });
}
```

### Acceptance Criteria
- [ ] Resolution dropdown appears next to Export button
- [ ] Default selection is "2K (2000px)"
- [ ] Each resolution produces correct dimensions
- [ ] Export uses original images (not thumbnails) for quality
- [ ] Filename includes resolution (e.g., `pinboard-grid-12345-2k.png`)
- [ ] 4K export completes without browser crash (may take a few seconds)

---

## Issue 4: Texture Tiling Seams

### Problem
Polkadot and stripe textures have visible seams because the fixed 256px tile size doesn't align with pattern repeat.

### Solution
Calculate tile size dynamically based on pattern parameters to ensure seamless tiling.

### Files to Modify

**`client/js/canvas/textures.js`**

Update `generatePolkadots()`:

```javascript
/**
 * Generate seamless polkadot pattern
 * @param {Object} options - Pattern options
 * @param {string} options.backgroundColor - Background color
 * @param {string} options.dotColor - Dot color
 * @param {number} options.dotSize - Dot diameter in pixels (default: 20)
 * @param {number} options.spacing - Space between dots (default: 25)
 * @param {number} options.seed - Random seed for variation
 * @returns {HTMLCanvasElement} Pattern tile canvas
 */
export function generatePolkadots(options) {
  const {
    backgroundColor = '#d4a574',
    dotColor = '#ffffff',
    dotSize = 20,
    spacing = 25,
    seed = 12345
  } = options;

  // Calculate tile size as multiple of pattern repeat
  const patternRepeat = dotSize + spacing;
  // Ensure at least 2 repeats for good distribution, cap at 512 for performance
  const repeatCount = Math.max(2, Math.min(8, Math.ceil(128 / patternRepeat)));
  const tileSize = patternRepeat * repeatCount;

  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, tileSize, tileSize);

  // Draw dots in grid pattern
  ctx.fillStyle = dotColor;
  const radius = dotSize / 2;

  for (let y = 0; y < repeatCount; y++) {
    for (let x = 0; x < repeatCount; x++) {
      const cx = (x * patternRepeat) + (patternRepeat / 2);
      const cy = (y * patternRepeat) + (patternRepeat / 2);
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}
```

Update `generateStripes()`:

```javascript
/**
 * Generate seamless stripe pattern
 * @param {Object} options - Pattern options
 * @param {string} options.color1 - First stripe color
 * @param {string} options.color2 - Second stripe color
 * @param {number} options.stripeWidth - Width of each stripe (default: 20)
 * @param {string} options.direction - 'diagonal', 'horizontal', 'vertical' (default: 'diagonal')
 * @returns {HTMLCanvasElement} Pattern tile canvas
 */
export function generateStripes(options) {
  const {
    color1 = '#d4a574',
    color2 = '#c49464',
    stripeWidth = 20,
    direction = 'diagonal'
  } = options;

  // Pattern repeat is two stripes (one of each color)
  const patternRepeat = stripeWidth * 2;

  // For diagonal stripes, tile must be square and account for 45° angle
  // The diagonal of the stripe pattern = patternRepeat * sqrt(2)
  // Tile size must be multiple of patternRepeat for seamless tiling
  const repeatCount = Math.max(2, Math.min(8, Math.ceil(128 / patternRepeat)));
  const tileSize = patternRepeat * repeatCount;

  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');

  // Fill with first color
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, tileSize, tileSize);

  ctx.fillStyle = color2;

  if (direction === 'diagonal') {
    // Draw diagonal stripes
    // Need to draw enough stripes to cover tile diagonally
    const diagonal = tileSize * Math.sqrt(2);
    const stripeCount = Math.ceil(diagonal / patternRepeat) + 2;

    ctx.save();
    ctx.translate(tileSize / 2, tileSize / 2);
    ctx.rotate(-Math.PI / 4); // 45 degrees

    for (let i = -stripeCount; i < stripeCount; i++) {
      const x = i * patternRepeat;
      ctx.fillRect(x, -diagonal, stripeWidth, diagonal * 2);
    }

    ctx.restore();
  } else if (direction === 'horizontal') {
    for (let y = 0; y < tileSize; y += patternRepeat) {
      ctx.fillRect(0, y, tileSize, stripeWidth);
    }
  } else if (direction === 'vertical') {
    for (let x = 0; x < tileSize; x += patternRepeat) {
      ctx.fillRect(x, 0, stripeWidth, tileSize);
    }
  }

  return canvas;
}
```

**`client/js/canvas/renderer.js`**

Update texture generation calls to pass parameters:

```javascript
case 'polkadots': {
  const cacheKey = `polkadots-${backgroundColor}-${dotColor}-${globalParams.seed}`;
  if (!textureCache[cacheKey]) {
    textureCache[cacheKey] = generatePolkadots({
      backgroundColor: getColor(backgroundColor),
      dotColor: getColor(dotColor),
      dotSize: 20,      // Could make these parameters
      spacing: 25,
      seed: globalParams.seed
    });
  }
  const pattern = ctx.createPattern(textureCache[cacheKey], 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, boardWidth, boardHeight);
  break;
}

case 'stripes': {
  const cacheKey = `stripes-${stripeColor1}-${stripeColor2}`;
  if (!textureCache[cacheKey]) {
    textureCache[cacheKey] = generateStripes({
      color1: getColor(stripeColor1),
      color2: getColor(stripeColor2),
      stripeWidth: 20,  // Could make this a parameter
      direction: 'diagonal'
    });
  }
  const pattern = ctx.createPattern(textureCache[cacheKey], 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, boardWidth, boardHeight);
  break;
}
```

### Acceptance Criteria
- [ ] Polkadot pattern tiles seamlessly with no visible seams
- [ ] Stripe pattern tiles seamlessly with no visible seams
- [ ] Patterns look correct at preview and export resolutions
- [ ] Cork texture still works (unchanged)
- [ ] No performance regression

---

## Issue 5: Missing Frame Style — Rounded Borderless

### Problem
"Rounded" frame style always has a border. Need a borderless rounded corner option.

### Solution
Add `roundedBorderlessWeight` parameter and rendering logic.

### Files to Modify

**`client/js/arrangements/grid.js`**

Add to `FRAME_STYLES` array:

```javascript
const FRAME_STYLES = ['borderless', 'bordered', 'polaroid', 'rounded', 'roundedBorderless', 'circle'];
```

Add parameter to schema (inside `frameStyles` group, after `roundedWeight`):

```javascript
{
  id: 'roundedBorderlessWeight',
  name: 'Rounded Borderless',
  type: 'weight',
  default: 0
}
```

Update `cornerRadius` condition to include new style:

```javascript
{
  id: 'cornerRadius',
  name: 'Corner Radius %',
  type: 'number',
  default: 35,  // Updated default
  min: 5,
  max: 50,
  step: 5,
  condition: { anyOf: ['roundedWeight', 'roundedBorderlessWeight'] }
}
```

Update `assignFrameStyles()` to include new weight:

```javascript
function assignFrameStyles(count, params, rng) {
  const weights = [
    params.borderlessWeight || 0,
    params.borderedWeight || 0,
    params.polaroidWeight || 0,
    params.roundedWeight || 0,
    params.roundedBorderlessWeight || 0,
    params.circleWeight || 0
  ];

  // ... rest unchanged
}
```

Add rendering case in `drawFramedPhoto()`:

```javascript
case 'roundedBorderless': {
  // Create rounded clipping path - no border
  const radius = size * (cornerRadius / 100);
  ctx.beginPath();
  roundedRect(ctx, x, y, size, size, radius);
  ctx.clip();
  // Photo fills entire area
  photoX = x;
  photoY = y;
  photoW = size;
  photoH = size;
  break;
}
```

### Acceptance Criteria
- [ ] "Rounded Borderless" appears in Frame Styles group
- [ ] Setting weight > 0 causes some photos to have rounded corners without border
- [ ] Corner Radius slider appears when either rounded style has weight > 0
- [ ] Visually distinct from bordered rounded style

---

## Issue 6: Default Parameters

### Problem
Current defaults are for 3×3 grid, not optimal for iPhone wallpaper testing.

### Solution
Update defaults to match typical iPhone wallpaper layout.

### Files to Modify

**`client/js/arrangements/grid.js`**

Update default values in schema:

| Parameter | Old Default | New Default |
|-----------|-------------|-------------|
| `rows` | 3 | **7** |
| `photoSizePct` | 20 | **22** |
| `polaroidMult` | 3 | **3.5** |
| `cornerRadius` | 10 | **35** |

```javascript
{
  id: 'rows',
  name: 'Rows',
  type: 'number',
  default: 7,  // Changed from 3
  min: 1,
  max: 10,
  step: 1
},
// ...
{
  id: 'photoSizePct',
  name: 'Photo Size %',
  type: 'number',
  default: 22,  // Changed from 20
  min: 5,
  max: 50,
  step: 1,
  suffix: '%'
},
// ...
{
  id: 'polaroidMult',
  name: 'Polaroid Bottom Multiplier',
  type: 'number',
  default: 3.5,  // Changed from 3
  min: 2,
  max: 5,
  step: 0.5,
  condition: 'polaroidWeight'
},
// ...
{
  id: 'cornerRadius',
  name: 'Corner Radius %',
  type: 'number',
  default: 35,  // Changed from 10
  min: 5,
  max: 50,
  step: 5,
  condition: { anyOf: ['roundedWeight', 'roundedBorderlessWeight'] }
}
```

### Acceptance Criteria
- [ ] Fresh load shows 3 columns × 7 rows grid
- [ ] Photo size default is 22%
- [ ] Polaroid multiplier default is 3.5 (when polaroid weight > 0)
- [ ] Corner radius default is 35% (when rounded weight > 0)
- [ ] Existing saved presets (if any) are not affected

---

## Implementation Order

Recommended sequence to minimize conflicts:

1. **Issue 6: Default Parameters** — Trivial change, no dependencies
2. **Issue 5: Rounded Borderless** — Isolated to grid.js
3. **Issue 2: Landscape Bug** — Small change in renderer.js
4. **Issue 4: Texture Tiling** — Self-contained in textures.js and renderer.js
5. **Issue 3: Export Resolution** — Multiple files but straightforward
6. **Issue 1: Photo Panel** — Most UI-heavy, do last

---

## Testing Checklist

After all changes:

### Photo Panel
- [ ] Upload 1 photo — displays as single square
- [ ] Upload 25 photos — displays as scrollable 3-column grid
- [ ] Drag to reorder — works correctly
- [ ] Click photo to set focal point — still works
- [ ] Delete all — clears grid

### Orientation
- [ ] Start in Portrait — canvas is tall
- [ ] Click Landscape — canvas becomes wide immediately
- [ ] Click Portrait — canvas returns to tall
- [ ] Photos render correctly in both orientations

### Export
- [ ] Select Preview — exports ~400px wide
- [ ] Select HD — exports 1290px wide
- [ ] Select 2K — exports 2000px wide
- [ ] Select 4K — exports 3000px wide
- [ ] Zoom into exported 2K/4K — individual photos are sharp

### Textures
- [ ] Polkadots — no visible tile seams at any zoom
- [ ] Stripes — no visible tile seams at any zoom
- [ ] Cork — still works (unchanged)

### Frame Styles
- [ ] Rounded (bordered) — has visible border with rounded corners
- [ ] Rounded Borderless — rounded corners, no border
- [ ] Corner radius slider — affects both rounded styles

### Defaults
- [ ] Fresh page load shows 3×7 grid with correct default values

---

## Files Summary

| File | Changes |
|------|---------|
| `client/js/arrangements/grid.js` | New frame style, updated defaults |
| `client/js/canvas/renderer.js` | Orientation tracking, export resolution, texture params |
| `client/js/canvas/textures.js` | Dynamic tile sizing for seamless patterns |
| `client/js/panels/photoPanel.js` | 3-column grid thumbnail layout |
| `client/js/app.js` | Export resolution selector handler |
| `client/styles/main.css` | Photo grid styles, export controls styles |
| `client/index.html` | Export resolution dropdown |
