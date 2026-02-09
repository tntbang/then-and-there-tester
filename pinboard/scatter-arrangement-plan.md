# Scatter Arrangements — Implementation Plan

## Goal

Add two new arrangement types alongside the existing `grid.js`: **Poisson Scatter** and **Hybrid Scatter**. Both produce the look of photos hand-pinned onto a board — well-spread, slightly rotated, variable sizes, small overlaps, no items clipping canvas edges, and no large empty patches of background.

Reference image: `uploads/1770420420860_image.png` — note how items appear random but are actually well-distributed with consistent coverage.

---

## Context: How Arrangements Work

Read these files first to understand the plugin system:

- `client/js/arrangements/registry.js` — plugin registration pattern
- `client/js/arrangements/grid.js` — the only existing arrangement; follow this as the template for schema definition, parameter structure, and render function signature
- `client/js/state.js` — state shape, particularly `arrangementId` and `arrangementParams`
- `client/js/canvas/renderer.js` — how arrangements get called during render
- `client/js/canvas/photoUtils.js` — image loading, cropping, drawing helpers
- `client/js/utils/random.js` — seeded RNG (Mulberry32). All randomness MUST use this for deterministic rendering.

Key contract: an arrangement exports:
1. `schema` — array of parameter definitions (types: number/slider, boolean, select, weight, palette-color, group)
2. `render(ctx, width, height, photos, photoImages, state)` — draws all photos onto the canvas

The arrangement receives the full canvas dimensions, the photo objects (with focal points), pre-loaded image elements, and the full state (including palette, globalParams with shadow settings, etc).

---

## Architecture Decision

Create two new files:
- `client/js/arrangements/scatter.js` — Poisson Disk scatter
- `client/js/arrangements/hybrid.js` — Hybrid Grid Seeds + Organic Placement

Both register themselves via `registerArrangement()` from `registry.js`. The existing arrangement dropdown/selector in the UI should automatically pick them up.

### Shared Utilities

Both arrangements need common scatter helpers. Create:
- `client/js/arrangements/scatterUtils.js` — shared functions for both scatter types

This should contain:
- Bounding box overlap detection (accounting for rotation)
- Edge rejection / clamping logic
- The "draw scattered photo" function (rotation, shadow, frame style)
- Overlap percentage calculation between two rotated rectangles
- Canvas coverage estimation (how much of the canvas is covered by placed items)

---

## Algorithm 1: Poisson Disk Scatter (`scatter.js`)

### Core Idea
Use Poisson disk sampling to generate well-spaced center points, then place variably-sized, slightly-rotated photos at those points. Poisson disk naturally prevents clustering while still feeling organic.

### Algorithm Steps

1. **Compute placement parameters** from canvas size and user params (base photo size, spacing factor)
2. **Run Poisson disk sampling** on the canvas area (inset by edge margin) to generate candidate center points. The `minDistance` parameter controls density — it should be derived from base photo size × a spacing factor.
3. **Assign properties to each point:** random size (base ± variation), random rotation (within max), random aspect ratio nudge
4. **Edge rejection pass:** remove any item whose rotated bounding box extends beyond canvas bounds (inset by edge margin). Do NOT clip — just remove entirely, as specified.
5. **Photo assignment:** map available photos to placement slots. If more slots than photos, cycle photos. If more photos than slots, use only as many slots as photos.
6. **Sort for layering:** sort items by some criterion (y-position, or random) to determine draw order (back to front)
7. **Render each item** using the shared draw function (respects frame styles, drop shadow from globalParams, focal-point-aware cropping)

### Key Parameters (schema)

| Parameter | Type | Range | Default | Purpose |
|-----------|------|-------|---------|---------|
| `photoSize` | number/slider | 10–40 (% of canvas short side) | 18 | Base photo size |
| `sizeVariation` | number/slider | 0–50 | 25 | ±% random size deviation |
| `spacing` | number/slider | 50–150 | 85 | Spacing factor (% of photo size). Lower = denser/more overlap |
| `rotationMax` | number/slider | 0–45 | 12 | Max rotation in degrees |
| `edgeMargin` | number/slider | 0–15 (% of canvas) | 3 | Minimum gap from canvas edges |
| `aspectVariation` | number/slider | 0–30 | 10 | ±% aspect ratio deviation from square |

Frame style parameters should mirror what grid.js offers (borderless, bordered, polaroid, rounded, etc.) — reuse or reference the same schema pattern and weight system.

### Poisson Disk Implementation Notes

- There's already a `poissonDisk()` function in `client/js/backgrounds/bgUtils.js` — evaluate whether to reuse it or write a standalone version in `scatterUtils.js`. The bgUtils version returns `{x, y}` points which is what we need, but it may need adaptation for the rectangular constraint and edge margin.
- The `minDistance` parameter to Poisson disk should be: `basePhotoSizePx * (spacing / 100)`. This means at spacing=100, photos are roughly one photo-width apart (no overlap). At spacing=70, they'll overlap slightly. At spacing=120, there's breathing room.
- Poisson disk is inherently non-deterministic in count — the number of points depends on how the sampling plays out. This is fine; the user controls density via spacing, and the actual count adapts to canvas size.

---

## Algorithm 2: Hybrid Grid Seeds + Organic Placement (`hybrid.js`)

### Core Idea
Start with a jittered grid to guarantee baseline coverage, then fill remaining gaps with a greedy placement pass, then run light relaxation to reduce excessive overlaps. This gives predictable photo count AND organic feel.

### Algorithm Steps

**Phase 1 — Grid Seeds:**
1. Compute a grid that's slightly undersized (e.g., if target is 20 photos, make a grid that holds ~60-70% of them, like 4×3=12)
2. Place seed points at grid cell centers
3. Jitter each seed point by a random offset (±jitter% of cell size in both x and y)
4. Assign random size and rotation to each seed item

**Phase 2 — Gap Filling:**
5. Compute a coarse coverage map (divide canvas into small cells, mark which are "covered" by placed items)
6. Find the largest uncovered region (or use a scoring function: cells furthest from any placed item)
7. Place next photo near the gap center with a small random offset
8. Repeat until all remaining photos are placed or no suitable gaps remain
9. If a placed item would be mostly off-canvas or heavily overlapping, try alternative positions (up to K attempts per item)

**Phase 3 — Relaxation:**
10. For each pair of items with overlap exceeding `maxOverlap`:
    - Compute push-apart vector (from center to center, weighted by overlap amount)
    - Move both items apart by a fraction of this vector
11. Push any items that are near/past canvas edges back inward
12. Repeat for N iterations (10–20 is usually sufficient)
13. Apply damping each iteration (reduce movement by 0.8-0.9x)

**Phase 4 — Final Rejection:**
14. Remove any items still extending beyond canvas bounds after relaxation
15. Remove any items with overlap exceeding a hard cap

**Phase 5 — Render:**
16. Sort items for draw order and render each

### Key Parameters (schema)

| Parameter | Type | Range | Default | Purpose |
|-----------|------|-------|---------|---------|
| `photoCount` | number/slider | 5–40 | 20 | Target number of photos |
| `photoSize` | number/slider | 10–40 | 16 | Base photo size (% of canvas short side) |
| `sizeVariation` | number/slider | 0–50 | 20 | ±% random size deviation |
| `rotationMax` | number/slider | 0–45 | 15 | Max rotation in degrees |
| `jitter` | number/slider | 0–100 | 50 | How much seed points deviate from grid (0=grid, 100=chaos) |
| `maxOverlap` | number/slider | 0–30 | 10 | Maximum allowed overlap (% of item area) |
| `edgeMargin` | number/slider | 0–15 | 3 | Canvas edge inset (%) |
| `density` | number/slider | 50–95 | 75 | Target canvas coverage (%). Affects gap-filling aggressiveness |
| `relaxIterations` | number/slider | 0–50 | 15 | Physics relaxation steps (0=skip relaxation) |

Plus the same frame style weight system from grid.js.

### Implementation Notes

- The grid seed count should be derived: roughly `photoCount * 0.6` photos go in the grid phase, the rest fill gaps. The grid dimensions (cols × rows) should be computed to roughly fill the canvas at the given photoSize.
- Coverage map resolution: divide canvas into cells of ~20px. A cell is "covered" if any placed item's bounding box contains the cell center. This is fast and good enough for gap detection.
- The relaxation phase is the trickiest to get right with rotation. Simplify: use axis-aligned bounding boxes for overlap detection during relaxation (ignore rotation). The visual overlap with rotation is small enough that AABB approximation works fine for the physics pass.
- Seed stability: all RNG calls must go through the seeded RNG in a deterministic order. The relaxation loop is deterministic as long as iteration order is fixed.

---

## Shared: Drawing a Scattered Photo (`scatterUtils.js`)

The per-item draw function needs to handle:

1. **Transform:** translate to item center, rotate by item's angle
2. **Drop shadow:** apply shadow from `globalParams` (shadowEnabled, shadowBlur, shadowOffset, shadowOpacity) before drawing the frame shape — same approach as grid.js
3. **Frame style:** draw the appropriate frame (borderless, bordered, polaroid, rounded, roundedBorderless, circle) — this logic exists in grid.js's `drawFramedPhoto` and should be extracted or referenced
4. **Photo crop:** use focal-point-aware cropping to fill the item's photo area — `photoUtils.js` has helpers for this
5. **Restore transform**

Important: the grid.js `drawFramedPhoto` function already handles frame styles, border colors, corner radius, polaroid sizing, etc. The ideal approach is to **extract this into a shared function** that both grid.js and the scatter arrangements can call. If that's too disruptive to the existing grid.js, duplicate the logic into scatterUtils.js — but note this in a comment for future refactoring.

### Item Data Structure

Each placed item should be an object like:
```
{
  x, y,              // center position on canvas
  width, height,     // photo area dimensions (before frame)
  rotation,          // radians
  photoIndex,        // which photo to draw (index into photos array)
  frameStyle,        // 'borderless' | 'bordered' | 'polaroid' | 'rounded' | etc.
  zIndex             // draw order
}
```

---

## Integration Points

### Registry
Both arrangements register with `registerArrangement()` from `registry.js`. The arrangement selector in the UI (likely a dropdown in `parameterPanel.js`) should automatically include them.

### State
When user selects a scatter arrangement, `arrangementId` changes to `'scatter'` or `'hybrid'`, and `arrangementParams` gets populated with defaults from the schema — this is existing behavior from the registry system.

### Photo Assignment
Both algorithms may generate more placement slots than available photos. Strategy: cycle through `photoOrder` repeatedly. If fewer slots than photos, only use the first N photos from `photoOrder`. The user controls density via parameters; they can always add/remove photos.

### Export
Scatter arrangements must work at export resolution just like grid. The positions and sizes are computed relative to canvas dimensions, so they should scale naturally when `renderForExport` creates a larger offscreen canvas.

---

## Parameter Panel UX Notes

- Both scatter arrangements should feel familiar in the parameter panel — same slider/toggle/select pattern as grid
- Consider grouping parameters: "Layout" (size, count, spacing/jitter, density), "Style" (rotation, frame weights, corner radius), "Edge" (margin)
- The `hybrid` arrangement has more parameters than `scatter` — that's fine, it's the "advanced" option

---

## Testing Checklist

- [ ] Both arrangements appear in arrangement selector and can be switched to
- [ ] Changing any parameter triggers a re-render with updated layout
- [ ] Seed produces identical layouts across renders (deterministic)
- [ ] Changing seed produces visibly different layouts
- [ ] No photos clip the canvas edges (edge rejection works)
- [ ] Photos are well-spread — no large empty patches at default settings
- [ ] Low spacing/high density produces overlapping photos (intentional)
- [ ] High spacing/low density produces separated photos with visible background
- [ ] Frame styles (bordered, polaroid, rounded, etc.) work correctly with rotation
- [ ] Drop shadow renders correctly on rotated items
- [ ] Focal points are respected in photo cropping
- [ ] Export at all resolutions produces correct layouts
- [ ] Portrait/landscape orientation toggle works (swap behavior if applicable)
- [ ] Works with 1 photo, 5 photos, 20 photos, and 40 photos
- [ ] Performance: renders within ~100ms at preview resolution for 20 photos

---

## Files to Create

1. `client/js/arrangements/scatterUtils.js`
2. `client/js/arrangements/scatter.js`
3. `client/js/arrangements/hybrid.js`

## Files to Modify

1. `client/js/arrangements/registry.js` — may need no changes if it auto-discovers, but verify the import chain
2. `client/js/app.js` — import the new arrangement files so they self-register
3. `client/js/arrangements/grid.js` — consider extracting `drawFramedPhoto` to shared utils (optional but recommended)
