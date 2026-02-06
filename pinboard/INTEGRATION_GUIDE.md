# Background System v0.2 — Integration Guide

## New Files to Copy

Copy these into your project:

```
pinboard/client/js/backgrounds/
  registry.js          ← Plugin system
  bgUtils.js           ← Shared rendering utilities
  index.js             ← Imports & registers all backgrounds
  solid.js             ← Solid color
  whiteBlack.js        ← White & Black
  polkadots.js         ← Classic polka dots
  confetti.js          ← Scattered random dots (2 sizes, 3 colors)
  halftone.js          ← Size-varying dots (radial/diagonal/linear)
  bubbles.js           ← Overlapping transparent circles
  stripes.js           ← Even stripes with angle
  pinstripe.js         ← Thin lines on solid
  candyStripe.js       ← Multi-color uneven stripes
  chevron.js           ← Zigzag pattern
  cork.js              ← Improved cork board (multi-layer noise)
  linen.js             ← Fabric crosshatch texture
  paper.js             ← Paper variants (smooth, kraft, watercolor, cardstock)
  graphPaper.js        ← Grid/graph paper
  checkerboard.js      ← Checker pattern
  gingham.js           ← Gingham (woven check)
  diamond.js           ← Argyle with stitch lines
  hexagonal.js         ← Honeycomb
  scatteredShapes.js   ← Stars, hearts, Xs, circles
  washiTape.js         ← Decorative semi-transparent bands
  tornPaper.js         ← Torn edge revealing under-layer
  splatter.js          ← Paint splatter marks

pinboard/client/js/panels/backgroundPanel.js  ← Gallery picker UI
pinboard/client/styles/background-panel.css     ← Styles
```

---

## Existing File Modifications

### 1. `state.js` — Updated State Shape

Replace the `globalParams` section and add new top-level keys:

```javascript
// REPLACE these in globalParams:
//   pinboardStyle: 'solid',
//   backgroundColor: 0,
//   dotColor: 1,
//   stripeColor1: 0,
//   stripeColor2: 1
//
// WITH these new top-level state keys:

const initialState = {
  photos: [],
  photoOrder: [],
  globalParams: {
    orientation: 'portrait',
    aspectRatio: 2.17,
    seed: 12345,
    // DROP SHADOW (new)
    shadowEnabled: true,
    shadowBlur: 8,
    shadowOffsetX: 3,
    shadowOffsetY: 4,
    shadowOpacity: 35,      // percent
    shadowColor: 'dark'     // 'dark', 'light', or palette index
  },
  arrangementId: 'grid',
  arrangementParams: {},
  // BACKGROUND (new — replaces pinboardStyle)
  backgroundId: 'solid',
  backgroundParams: {
    bgColor: 0              // defaults populated from background schema
  },
  palette: null,
  availablePalettes: [],
  presets: []
};
```

### 2. `index.html` — Add CSS import and restructure right panel

Add the new CSS file in `<head>`:
```html
<link rel="stylesheet" href="styles/background-panel.css">
```

In the right panel (parameters), restructure to have sections:
```html
<div class="panel panel-right" id="parameterPanel">
  <!-- Palette section (moved to top) -->
  <div class="palette-section-top" id="paletteSection">
    <!-- Populated by JS -->
  </div>

  <!-- Background section (new) -->
  <div class="param-section" id="backgroundSection">
    <h3 class="section-header">Background</h3>
    <!-- backgroundPanel.js mounts here -->
  </div>

  <!-- Drop Shadow section (new) -->
  <div class="param-section" id="shadowSection">
    <!-- Drop shadow controls -->
  </div>

  <!-- Arrangement section (existing, moves below) -->
  <div class="param-section" id="arrangementSection">
    <h3 class="section-header">Layout</h3>
    <!-- Existing arrangement params -->
  </div>
</div>
```

### 3. `app.js` — Import background system and init panel

Add at top:
```javascript
import '../backgrounds/index.js';
import { initBackgroundPanel } from '../panels/backgroundPanel.js';
```

In your init function, after setting up the parameter panel:
```javascript
// Initialize background gallery
const bgSection = document.getElementById('backgroundSection');
if (bgSection) {
  initBackgroundPanel(bgSection);
}

// Initialize drop shadow controls
initShadowControls();
```

Add the shadow controls initializer:
```javascript
function initShadowControls() {
  const section = document.getElementById('shadowSection');
  if (!section) return;

  section.innerHTML = `
    <div class="shadow-controls">
      <div class="shadow-controls-header">
        <label>Drop Shadow</label>
        <input type="checkbox" id="shadowEnabled" class="bg-param-toggle">
      </div>
      <div class="shadow-param-grid" id="shadowParams">
        <label>Blur</label>
        <input type="range" id="shadowBlur" min="0" max="30" step="1" value="8">
        <span class="param-value" id="shadowBlurVal">8</span>

        <label>Offset X</label>
        <input type="range" id="shadowOffsetX" min="-20" max="20" step="1" value="3">
        <span class="param-value" id="shadowOffsetXVal">3</span>

        <label>Offset Y</label>
        <input type="range" id="shadowOffsetY" min="-20" max="20" step="1" value="4">
        <span class="param-value" id="shadowOffsetYVal">4</span>

        <label>Opacity</label>
        <input type="range" id="shadowOpacity" min="0" max="100" step="5" value="35">
        <span class="param-value" id="shadowOpacityVal">35%</span>
      </div>
    </div>
  `;

  const state = getState();
  const gp = state.globalParams;

  const enabledEl = section.querySelector('#shadowEnabled');
  enabledEl.checked = gp.shadowEnabled !== false;

  const sliders = ['shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowOpacity'];
  for (const id of sliders) {
    const slider = section.querySelector(`#${id}`);
    const valEl = section.querySelector(`#${id}Val`);
    slider.value = gp[id] ?? slider.value;
    valEl.textContent = slider.value + (id === 'shadowOpacity' ? '%' : '');

    slider.addEventListener('input', () => {
      valEl.textContent = slider.value + (id === 'shadowOpacity' ? '%' : '');
      setState({
        globalParams: { ...getState().globalParams, [id]: parseFloat(slider.value) }
      });
    });
  }

  enabledEl.addEventListener('change', () => {
    setState({
      globalParams: { ...getState().globalParams, shadowEnabled: enabledEl.checked }
    });
    // Toggle visibility of shadow param sliders
    section.querySelector('#shadowParams').style.display = enabledEl.checked ? '' : 'none';
  });

  // Initial visibility
  section.querySelector('#shadowParams').style.display = enabledEl.checked ? '' : 'none';
}
```

### 4. `layers.js` — Use New Background System

Replace the background rendering layer to use the new system:

```javascript
import { getBackground, getBackgroundDefaults } from '../backgrounds/index.js';
import { createSeededRng } from '../utils/random.js';

// REPLACE the old background layer renderer with:
export function renderBackground(ctx, width, height, state) {
  const bgId = state.backgroundId || 'solid';
  const bg = getBackground(bgId);

  if (!bg) {
    // Fallback: solid gray
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // Merge stored params with defaults (in case schema changed)
  const defaults = getBackgroundDefaults(bgId);
  const params = { ...defaults, ...state.backgroundParams };

  // Create seeded RNG for deterministic rendering
  const seed = state.globalParams?.seed || 12345;
  const rng = createSeededRng(seed);

  bg.render(ctx, width, height, params, state.palette, rng);
}
```

The `renderLayers()` function should call `renderBackground(ctx, w, h, state)` instead of the old texture/solid logic.

### 5. `grid.js` — Add Drop Shadow to Photo Rendering

In the `drawFramedPhoto()` function (or wherever the per-photo canvas draw happens), add shadow before drawing the frame:

```javascript
// Inside drawFramedPhoto, BEFORE drawing frame/photo:
function applyDropShadow(ctx, globalParams) {
  if (!globalParams.shadowEnabled) return;

  const opacity = (globalParams.shadowOpacity || 35) / 100;
  ctx.shadowColor = `rgba(0, 0, 0, ${opacity})`;
  ctx.shadowBlur = globalParams.shadowBlur || 8;
  ctx.shadowOffsetX = globalParams.shadowOffsetX || 3;
  ctx.shadowOffsetY = globalParams.shadowOffsetY || 4;
}

function clearDropShadow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// Usage in drawFramedPhoto:
// After ctx.save() and before drawing the frame shape:
applyDropShadow(ctx, globalParams);

// Draw the frame background (the shadow will cast from this shape)
// For bordered: draw the border rect
// For polaroid: draw the polaroid card
// For borderless/rounded: draw a small rect behind photo area
ctx.fillStyle = borderColor;
ctx.fillRect(x, y, frameW, frameH);  // or rounded rect, etc.

// IMMEDIATELY clear shadow before drawing anything else on top
clearDropShadow(ctx);

// Then draw photo, etc. as normal
```

The key insight: the shadow should be cast by the **frame shape** (the white border/polaroid card/photo area), not by the photo image itself. This means:
- Apply shadow → draw frame fill → clear shadow → draw photo on top
- For `borderless` style: draw a tiny shadow rect behind the photo area, or skip shadow
- For `roundedBorderless`: apply shadow to the rounded clip path

**Important:** The `globalParams` must be passed through to the `drawFramedPhoto` function. In the grid arrangement's `render()`, you already have access to state — pass `state.globalParams` down.

### 6. `parameterPanel.js` — Move Palette to Top

In `loadArrangementParams()` or wherever the right panel builds, add a palette display at the top:

```javascript
function renderPaletteSection() {
  const section = document.getElementById('paletteSection');
  if (!section) return;

  const state = getState();
  const palette = state.palette;

  if (!palette) {
    section.innerHTML = `
      <div class="palette-section-top">
        <div class="section-label">Color Palette</div>
        <button class="change-palette-btn" id="openPaletteBtn">Choose Palette</button>
      </div>
    `;
  } else {
    const swatches = palette.colors.map(c =>
      `<div class="palette-swatch" style="background-color: ${c}"></div>`
    ).join('');

    section.innerHTML = `
      <div class="palette-section-top">
        <div class="section-label">Color Palette</div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="palette-swatches">${swatches}</div>
          <span class="palette-name">${palette.name || ''}</span>
          <button class="change-palette-btn" id="openPaletteBtn">Change</button>
        </div>
      </div>
    `;
  }

  // Wire up palette button to open modal
  const btn = section.querySelector('#openPaletteBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      // Open your existing palette modal
      openPaletteModal();
    });
  }
}

// Call renderPaletteSection() on init and subscribe to palette changes
subscribe((state, prev) => {
  if (state.palette !== prev?.palette) {
    renderPaletteSection();
  }
});
```

### 7. `textures.js` — Can Be Deprecated

The old `textures.js` with `generatePolkadots()`, `generateStripes()`, and `generateCork()` is fully replaced by the new background modules. You can delete it or keep it as a reference. Just make sure `layers.js` no longer imports from it.

---

## Data Flow (Updated)

```
User clicks background thumbnail
  → selectBackground(id)
  → setState({ backgroundId, backgroundParams })
  → subscribers fire
  → renderer.scheduleRender()
  → renderLayers()
  → renderBackground(ctx, w, h, state)
  → background.render(ctx, w, h, params, palette, rng)

User adjusts background parameter
  → onChange(value)
  → setState({ backgroundParams: {...existing, [key]: value} })
  → same render flow

User changes palette
  → setState({ palette })
  → background thumbnails re-render
  → canvas re-renders (background colors resolve from new palette)

User adjusts drop shadow
  → setState({ globalParams: {...existing, shadowX: val} })
  → canvas re-renders
  → grid.drawFramedPhoto applies shadow before frame draw
```

---

## Background Type Reference

| ID | Name | Category | Color Params | Other Params |
|---|---|---|---|---|
| `solid` | Solid | basics | bgColor | — |
| `white` | White | basics | — | — |
| `black` | Black | basics | — | — |
| `polkadots` | Polka Dots | dots | bgColor, dotColor | dotSize, spacing |
| `confetti` | Confetti Dots | dots | bgColor, mediumColor, smallColor | density, mediumSize, smallSize, sizeVariation |
| `halftone` | Halftone | dots | bgColor, dotColor | gridSize, minDot, maxDot, direction |
| `bubbles` | Bubbles | dots | bgColor, color1, color2 | density, minSize, maxSize, opacity |
| `stripes` | Stripes | stripes | color1, color2 | width, angle |
| `pinstripe` | Pin Stripe | stripes | bgColor, lineColor | lineWidth, spacing, angle |
| `candyStripe` | Candy Stripe | stripes | color1, color2, color3 | width, ratio, angle |
| `chevron` | Chevron | stripes | color1, color2 | width, amplitude, horizontal |
| `cork` | Cork Board | textures | baseColor | grainIntensity, darkStreaks, poreDetail |
| `linen` | Linen | textures | bgColor | intensity, threadSpacing |
| `paper` | Paper | textures | bgColor | paperType, grainAmount |
| `graphPaper` | Graph Paper | geometric | bgColor, lineColor | cellSize, lineWidth, opacity, majorEvery |
| `checkerboard` | Checkerboard | geometric | color1, color2 | cellSize |
| `gingham` | Gingham | geometric | color1, color2 | cellSize |
| `diamond` | Argyle | geometric | color1, color2, lineColor | cellSize, showLines |
| `hexagonal` | Honeycomb | geometric | bgColor, lineColor | hexSize, lineWidth, filled, fillOpacity |
| `scatteredShapes` | Scattered Shapes | decorative | bgColor, shapeColor1, shapeColor2 | density, shapeSize, shapeType, opacity |
| `washiTape` | Washi Tape | decorative | bgColor, tapeColor1-3 | tapeCount, tapeWidth, opacity, maxAngle, pattern |
| `tornPaper` | Torn Paper | decorative | topColor, bottomColor | tearWidth, roughness, tearSide, showShadow |
| `splatter` | Paint Splatter | decorative | bgColor, color1-3 | splatCount, splatSize, opacity, droplets |

---

## Migration Checklist

- [ ] Copy all `backgrounds/` files into `client/js/backgrounds/`
- [ ] Copy `backgroundPanel.js` into `client/js/panels/`
- [ ] Copy `background-panel.css` into `client/styles/`
- [ ] Update `state.js` — remove old pinboardStyle params, add backgroundId/backgroundParams, add shadow params
- [ ] Update `index.html` — add CSS link, restructure right panel sections
- [ ] Update `app.js` — import backgrounds, init background panel, init shadow controls
- [ ] Update `layers.js` — replace old background rendering with new system
- [ ] Update `grid.js` — add drop shadow to frame drawing, pass globalParams through
- [ ] Update `parameterPanel.js` — add palette section at top, remove old background dropdown
- [ ] Delete or deprecate `textures.js`
- [ ] Test: all 22 backgrounds render correctly with palette colors
- [ ] Test: switching backgrounds preserves shared params
- [ ] Test: drop shadow works on all frame styles
- [ ] Test: export renders backgrounds at high resolution
