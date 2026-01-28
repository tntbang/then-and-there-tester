# Then & There Web — Collage Algorithm Testbed

## Purpose

A local development tool for visually testing and iterating on collage layout algorithms. This is NOT a consumer product — it's a sandbox for rapid algorithm development that will inform the iOS app.

**Goal:** Drag in photos → see them clustered on a map → generate collages with different algorithms → tweak parameters in real-time → export winning configurations.

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vanilla JS (ES Modules) | No build step, fast iteration, minimal complexity |
| Canvas | HTML5 Canvas API | Direct control, no dependencies |
| Maps | Leaflet.js + OpenStreetMap | Free, no API key, works offline after tile cache |
| EXIF | exif-js library | Browser-based GPS extraction, well-maintained |
| Styling | Minimal CSS | Functional only, not the focus |
| Storage | None | Everything in-memory, no persistence needed |
| Canvas Size | 1000×1000 px | Fast rendering for iteration |
| Photo Size | Full resolution | User preference, no thumbnailing |

---

## File Structure

```
then-and-there-web/
├── index.html
├── style.css
├── js/
│   ├── main.js
│   ├── photoLoader.js
│   ├── clustering.js
│   ├── mapRenderer.js
│   ├── collageRenderer.js
│   ├── utils.js
│   └── algorithms/
│       ├── index.js
│       ├── mapRegions.js
│       ├── orbital.js
│       ├── anchoredScatter.js
│       ├── gravityWells.js
│       ├── gridOverlay.js
│       ├── spiral.js
│       └── freeform.js
└── lib/
    ├── exif.js
    └── leaflet/
        ├── leaflet.js
        └── leaflet.css
```

---

## Data Structures

### Photo Object

```javascript
{
  id: string,           // Unique ID (generated from filename + timestamp)
  filename: string,     // Original filename
  src: string,          // Data URL of full image
  img: HTMLImageElement,// Loaded image element (for canvas drawing)
  lat: number | null,   // GPS latitude (null if no EXIF)
  lon: number | null,   // GPS longitude (null if no EXIF)
  date: Date | null,    // Date taken (from EXIF)
  width: number,        // Original pixel width
  height: number,       // Original pixel height
  hasLocation: boolean  // Convenience flag
}
```

### Cluster Object

```javascript
{
  id: number,           // Cluster index
  photos: Photo[],      // Photos in this cluster
  centroid: {           // Geographic center
    lat: number,
    lon: number
  },
  bounds: {             // Bounding box
    north: number,
    south: number,
    east: number,
    west: number
  }
}
```

### Placement Object (algorithm output)

```javascript
{
  photo: Photo,
  x: number,            // Canvas X (center of photo)
  y: number,            // Canvas Y (center of photo)
  width: number,        // Rendered width on canvas
  height: number,       // Rendered height on canvas
  rotation: number,     // Rotation in degrees
  clusterId: number     // Which cluster this belongs to
}
```

### Config Object (for export)

```javascript
{
  algorithm: string,
  clustering: {
    epsilon: number,      // km
    minPoints: number,
    adaptive: boolean
  },
  layout: {
    mapAreaPercent: number,   // 30-70
    maxPhotos: number,        // 10-50
    sizeVariation: string,    // "uniform" | "slight" | "dramatic"
    rotationRange: number,    // 0-20 degrees
    overlapTolerance: string  // "none" | "slight" | "aggressive"
  },
  seed: number
}
```

---

## Module Specifications

### 1. photoLoader.js

**Purpose:** Handle drag-and-drop photo upload and EXIF extraction.

**Exports:**
```javascript
export function initPhotoLoader(dropZoneId, onPhotosLoaded)
export function getPhotos() // Returns current Photo[]
export function clearPhotos()
```

**Implementation Details:**

1. Set up drag-and-drop listeners on the drop zone element
2. Accept multiple files, filter to images only (jpg, jpeg, png, heic)
3. For each file:
   - Read as DataURL using FileReader
   - Create HTMLImageElement and wait for load
   - Extract EXIF data using exif-js library
   - Parse GPS coordinates from EXIF (handle degrees/minutes/seconds format)
   - Parse DateTimeOriginal from EXIF
   - Create Photo object
4. Call `onPhotosLoaded(photos)` callback with all processed photos
5. Display count of photos loaded, count with valid GPS

**EXIF GPS Parsing:**
```javascript
// EXIF stores GPS as [degrees, minutes, seconds]
// Convert to decimal degrees:
function toDecimal(dms, ref) {
  const degrees = dms[0] + dms[1]/60 + dms[2]/3600;
  return (ref === 'S' || ref === 'W') ? -degrees : degrees;
}
```

**Edge Cases:**
- Photos without GPS: Set `lat: null, lon: null, hasLocation: false`
- Photos without date: Set `date: null`
- Corrupt EXIF: Catch errors, treat as no metadata
- Non-image files: Skip silently
- Very large files: No special handling (user requested full-res)

---

### 2. clustering.js

**Purpose:** Implement DBSCAN clustering algorithm for geographic grouping.

**Exports:**
```javascript
export function clusterPhotos(photos, epsilon, minPoints, adaptive)
// Returns Cluster[]
```

**DBSCAN Algorithm:**

```
INPUT: 
  - photos: Photo[] (only those with hasLocation: true)
  - epsilon: number (distance threshold in km)
  - minPoints: number (minimum photos to form cluster)
  
OUTPUT:
  - clusters: Cluster[]

ALGORITHM:
1. If adaptive=true, calculate epsilon based on geographic span:
   - Calculate bounding box of all photos
   - span = max(latSpan, lonSpan) in km
   - if span < 1km: epsilon = 0.1
   - if span 1-50km: epsilon = 1.0
   - if span > 50km: epsilon = 5.0
   
2. Initialize all photos as UNVISITED

3. For each UNVISITED photo P:
   a. Mark P as VISITED
   b. Find neighbors N = all photos within epsilon km of P
   c. If |N| < minPoints:
      - Mark P as NOISE
   d. Else:
      - Create new cluster C
      - Add P to C
      - For each photo Q in N:
        - If Q is UNVISITED:
          - Mark Q as VISITED
          - Find neighbors N' of Q
          - If |N'| >= minPoints:
            - Add N' to N (expand search)
        - If Q is not yet in any cluster:
          - Add Q to C

4. For photos marked as NOISE:
   - Create single-photo clusters (each noise point becomes its own cluster)
   
5. For each cluster, calculate:
   - centroid (average lat/lon)
   - bounds (min/max lat/lon)
   
6. Return clusters sorted by photo count (descending)
```

**Distance Calculation (Haversine):**
```javascript
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

---

### 3. mapRenderer.js

**Purpose:** Generate a map image for the collage background using Leaflet.

**Exports:**
```javascript
export function initMap(containerId)
export async function renderMapSnapshot(clusters, width, height, padding)
// Returns Promise<HTMLCanvasElement> with map image
```

**Implementation Details:**

1. Create a hidden Leaflet map instance (off-screen div)
2. Calculate bounding box from all cluster centroids
3. Add padding (default 20%) to bounds
4. Fit map to bounds
5. Wait for tiles to load
6. Use `leaflet-image` plugin OR html2canvas to capture map as canvas
7. Return canvas element

**Alternative (simpler):** Use static map tiles
- Calculate tile coordinates for bounds
- Fetch tile images directly
- Composite onto canvas
- This avoids Leaflet complexity but is more manual

**Recommended Approach for MVP:**
Use Leaflet with `leaflet-image` plugin for simplicity. Can optimize later if performance is an issue.

**Map Styling:**
- Use standard OpenStreetMap tiles for now
- No custom styling in v0.1
- Future: add map style options (satellite, terrain, minimal)

---

### 4. collageRenderer.js

**Purpose:** Composite the final collage image (map + photos).

**Exports:**
```javascript
export function renderCollage(canvas, mapImage, placements, debugOptions)
export function saveAsPng(canvas, filename)
```

**Implementation Details:**

1. Clear canvas
2. Draw map image centered (based on mapAreaPercent)
3. For each placement (sorted by size, smallest last so they appear on top):
   - Save canvas state
   - Translate to photo position (x, y)
   - Rotate by placement.rotation
   - Draw photo centered at origin, scaled to placement.width/height
   - Restore canvas state
4. If debug options enabled, draw overlays (see Debug Overlays section)

**Drawing a Rotated Photo:**
```javascript
ctx.save();
ctx.translate(placement.x, placement.y);
ctx.rotate(placement.rotation * Math.PI / 180);
ctx.drawImage(
  placement.photo.img,
  -placement.width / 2,
  -placement.height / 2,
  placement.width,
  placement.height
);
ctx.restore();
```

**Save as PNG:**
```javascript
function saveAsPng(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename || 'collage.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

---

### 5. utils.js

**Purpose:** Shared utility functions.

**Exports:**
```javascript
export class SeededRandom
export function clamp(value, min, max)
export function lerp(a, b, t)
export function mapRange(value, inMin, inMax, outMin, outMax)
export function generateId()
export function shuffleArray(array, rng)
```

**Seeded Random Number Generator:**
```javascript
export class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  // Returns float between 0 and 1
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  
  // Returns float between min and max
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  // Returns integer between min and max (inclusive)
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}
```

---

### 6. algorithms/index.js

**Purpose:** Algorithm registry and common interface.

**Exports:**
```javascript
export const algorithms = {
  mapRegions: { name: 'Map Regions', fn: mapRegionsLayout },
  orbital: { name: 'Orbital', fn: orbitalLayout },
  anchoredScatter: { name: 'Anchored Scatter', fn: anchoredScatterLayout },
  gravityWells: { name: 'Gravity Wells', fn: gravityWellsLayout },
  gridOverlay: { name: 'Grid Overlay', fn: gridOverlayLayout },
  spiral: { name: 'Spiral', fn: spiralLayout },
  freeform: { name: 'Freeform', fn: freeformLayout }
};

export function runAlgorithm(name, photos, clusters, params, canvasSize, mapRect, rng)
// Returns Placement[]
```

**Common Algorithm Interface:**
```javascript
function algorithmName(photos, clusters, params, canvasSize, mapRect, rng) {
  // photos: Photo[] - all photos with location
  // clusters: Cluster[] - clustering result
  // params: object - layout parameters from UI
  // canvasSize: { width, height }
  // mapRect: { x, y, width, height } - where map sits on canvas
  // rng: SeededRandom instance
  
  // Returns: Placement[]
}
```

---

### 7. algorithms/mapRegions.js (PRIMARY - Build First)

**Purpose:** Implement the Map Regions layout algorithm (matches iOS MVP).

**Algorithm Description:**

The canvas is divided into regions around the central map. Photos are assigned to regions based on which direction their cluster is from the map center, then scattered within that region.

```
┌─────────────────────────────────┐
│     NW      │  TOP  │    NE    │
│   Region    │ Region│  Region  │
├─────────────┼───────┼──────────┤
│    LEFT     │       │  RIGHT   │
│   Region    │  MAP  │  Region  │
├─────────────┼───────┼──────────┤
│     SW      │BOTTOM │    SE    │
│   Region    │Region │  Region  │
└─────────────────────────────────┘
```

**Step-by-Step Implementation:**

```
INPUT:
  - photos: Photo[]
  - clusters: Cluster[]
  - params: { mapAreaPercent, maxPhotos, sizeVariation, rotationRange, overlapTolerance }
  - canvasSize: { width: 1000, height: 1000 }
  - mapRect: calculated from mapAreaPercent
  - rng: SeededRandom

OUTPUT:
  - placements: Placement[]

ALGORITHM:

1. CALCULATE MAP RECTANGLE
   mapWidth = canvasSize.width * (params.mapAreaPercent / 100)
   mapHeight = canvasSize.height * (params.mapAreaPercent / 100)
   mapRect = {
     x: (canvasSize.width - mapWidth) / 2,
     y: (canvasSize.height - mapHeight) / 2,
     width: mapWidth,
     height: mapHeight
   }
   mapCenter = {
     x: canvasSize.width / 2,
     y: canvasSize.height / 2
   }

2. DEFINE PLACEMENT REGIONS (8 regions around map)
   regions = {
     NW:  { x: 0, y: 0, w: mapRect.x, h: mapRect.y },
     TOP: { x: mapRect.x, y: 0, w: mapRect.width, h: mapRect.y },
     NE:  { x: mapRect.x + mapRect.width, y: 0, w: canvasSize.width - mapRect.x - mapRect.width, h: mapRect.y },
     LEFT: { x: 0, y: mapRect.y, w: mapRect.x, h: mapRect.height },
     RIGHT: { x: mapRect.x + mapRect.width, y: mapRect.y, w: canvasSize.width - mapRect.x - mapRect.width, h: mapRect.height },
     SW:  { x: 0, y: mapRect.y + mapRect.height, w: mapRect.x, h: canvasSize.height - mapRect.y - mapRect.height },
     BOTTOM: { x: mapRect.x, y: mapRect.y + mapRect.height, w: mapRect.width, h: canvasSize.height - mapRect.y - mapRect.height },
     SE:  { x: mapRect.x + mapRect.width, y: mapRect.y + mapRect.height, w: canvasSize.width - mapRect.x - mapRect.width, h: canvasSize.height - mapRect.y - mapRect.height }
   }

3. CALCULATE GEOGRAPHIC BOUNDS
   allLats = clusters.map(c => c.centroid.lat)
   allLons = clusters.map(c => c.centroid.lon)
   geoBounds = {
     minLat: min(allLats), maxLat: max(allLats),
     minLon: min(allLons), maxLon: max(allLons)
   }
   geoCenter = {
     lat: (geoBounds.minLat + geoBounds.maxLat) / 2,
     lon: (geoBounds.minLon + geoBounds.maxLon) / 2
   }

4. ASSIGN CLUSTERS TO REGIONS
   For each cluster:
     - Compare cluster.centroid to geoCenter
     - north = centroid.lat > geoCenter.lat
     - south = centroid.lat < geoCenter.lat
     - east = centroid.lon > geoCenter.lon
     - west = centroid.lon < geoCenter.lon
     
     - Assign to primary region:
       - north && west → NW
       - north && east → NE
       - south && west → SW
       - south && east → SE
       - north && !east && !west → TOP
       - south && !east && !west → BOTTOM
       - west && !north && !south → LEFT
       - east && !north && !south → RIGHT
       
     - Handle edge case (cluster at exact center): assign to region with fewest photos

5. ALLOCATE PHOTO COUNTS PER CLUSTER
   totalScore = sum of cluster.photos.length for all clusters
   For each cluster:
     proportion = cluster.photos.length / totalScore
     allocation = round(proportion * params.maxPhotos)
     allocation = clamp(allocation, 2, params.maxPhotos / 2)
   
   Adjust allocations so total equals params.maxPhotos

6. SELECT PHOTOS FROM EACH CLUSTER
   For each cluster:
     - Sort photos by some criteria (for now: random with seed)
     - Take first N photos where N = allocation for this cluster

7. CALCULATE PHOTO SIZES
   Based on params.sizeVariation:
   - "uniform": all photos same size
   - "slight": 70% medium, 20% small, 10% large
   - "dramatic": 50% medium, 30% small, 20% large
   
   Base size = calculate based on region size and photo count
   - small = base * 0.7
   - medium = base * 1.0
   - large = base * 1.3
   
   Assign size category to each photo using rng

8. PLACE PHOTOS IN REGIONS
   For each cluster:
     region = assigned region for this cluster
     photos = selected photos for this cluster
     
     For each photo:
       - Generate random position within region (using rng)
       - Apply "orbital pull" toward map center (15% pull strength)
         adjustedX = lerp(randomX, mapCenter.x, 0.15)
         adjustedY = lerp(randomY, mapCenter.y, 0.15)
       - Generate rotation: rng.range(-params.rotationRange, params.rotationRange)
       - Create Placement object

9. COLLISION DETECTION (if overlapTolerance != "aggressive")
   For each placement:
     Check overlap with all previous placements
     If overlap detected:
       - "none": shift photo away until no overlap
       - "slight": allow up to 20% overlap
     Use simple rectangle intersection (ignoring rotation for perf)

10. RETURN placements array
```

**Size Calculation Detail:**
```javascript
function calculateBaseSize(region, photoCount, canvasSize) {
  // Target: photos should fill ~60% of their region
  const regionArea = region.w * region.h;
  const targetCoverage = 0.6;
  const totalPhotoArea = regionArea * targetCoverage;
  const areaPerPhoto = totalPhotoArea / photoCount;
  const baseSize = Math.sqrt(areaPerPhoto);
  
  // Clamp to reasonable bounds
  const minSize = canvasSize.width * 0.05;  // 5% of canvas
  const maxSize = canvasSize.width * 0.15;  // 15% of canvas
  return clamp(baseSize, minSize, maxSize);
}
```

---

### 8. Other Algorithms (Build After Map Regions Works)

Brief specs for remaining algorithms:

**orbital.js**
- Each cluster's pin is placed on the map
- Photos orbit their pin at varying distances
- Distance from pin = importance (closer = more important)
- Use polar coordinates, convert to cartesian

**anchoredScatter.js**
- Highest-scored photo in each cluster sits directly on pin location
- Remaining photos scatter nearby (within radius)
- Good for "hero photo" emphasis

**gravityWells.js**
- Start with random photo positions across canvas
- Iterate: each photo is pulled toward its cluster's pin
- Strength parameter controls pull force
- Results in organic clustering

**gridOverlay.js**
- Overlay invisible grid on canvas
- Assign grid cells to clusters based on proximity
- Place photos in assigned cells
- Uniform, organized look

**spiral.js**
- Photos arranged in expanding spiral from center
- Cluster order determines position in spiral
- Good for single-location trips

**freeform.js**
- Completely random initial positions (avoiding map)
- Run collision detection/resolution iterations
- Most chaotic/organic result

---

### 9. main.js

**Purpose:** Wire everything together, handle UI interactions.

**Responsibilities:**
- Initialize all modules on page load
- Set up event listeners for controls
- Manage state (current photos, clusters, config)
- Trigger re-renders when parameters change
- Handle export functions

**State:**
```javascript
const state = {
  photos: [],
  clusters: [],
  config: {
    algorithm: 'mapRegions',
    clustering: { epsilon: 1.0, minPoints: 3, adaptive: true },
    layout: { mapAreaPercent: 50, maxPhotos: 20, sizeVariation: 'slight', rotationRange: 10, overlapTolerance: 'none' },
    seed: Math.floor(Math.random() * 10000)
  },
  debug: {
    showClusters: false,
    showQuadrants: false,
    showPins: false,
    showBounds: false
  }
};
```

**Event Flow:**
```
Photos dropped
    → photoLoader processes
    → state.photos updated
    → clustering runs
    → state.clusters updated
    → map renders
    → algorithm runs
    → collage renders

Parameter changed
    → state.config updated
    → if clustering param: re-cluster, re-render all
    → if layout param: re-run algorithm, re-render collage
    → if debug param: re-render collage only
```

---

## UI Specification

### HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Then & There — Algorithm Testbed</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="lib/leaflet/leaflet.css">
</head>
<body>
  <div class="container">
    
    <!-- Drop Zone -->
    <div id="dropZone" class="drop-zone">
      <p>Drop photos here</p>
      <p class="subtext">or click to browse</p>
      <input type="file" id="fileInput" multiple accept="image/*" hidden>
      <p id="photoCount" class="photo-count"></p>
    </div>
    
    <!-- Main Layout -->
    <div class="main">
      
      <!-- Control Panel -->
      <div class="controls">
        
        <!-- Algorithm Selector -->
        <div class="control-group">
          <label>Algorithm</label>
          <select id="algorithmSelect">
            <option value="mapRegions">Map Regions</option>
            <option value="orbital">Orbital</option>
            <option value="anchoredScatter">Anchored Scatter</option>
            <option value="gravityWells">Gravity Wells</option>
            <option value="gridOverlay">Grid Overlay</option>
            <option value="spiral">Spiral</option>
            <option value="freeform">Freeform</option>
          </select>
        </div>
        
        <!-- Clustering -->
        <div class="control-section">
          <h3>Clustering</h3>
          
          <div class="control-group">
            <label>Epsilon (km): <span id="epsilonValue">1.0</span></label>
            <input type="range" id="epsilon" min="0.1" max="10" step="0.1" value="1.0">
          </div>
          
          <div class="control-group">
            <label>Min Points: <span id="minPointsValue">3</span></label>
            <input type="range" id="minPoints" min="1" max="10" step="1" value="3">
          </div>
          
          <div class="control-group">
            <label>
              <input type="checkbox" id="adaptive" checked>
              Adaptive Epsilon
            </label>
          </div>
        </div>
        
        <!-- Layout -->
        <div class="control-section">
          <h3>Layout</h3>
          
          <div class="control-group">
            <label>Map Size: <span id="mapSizeValue">50%</span></label>
            <input type="range" id="mapSize" min="30" max="70" step="5" value="50">
          </div>
          
          <div class="control-group">
            <label>Max Photos: <span id="maxPhotosValue">20</span></label>
            <input type="range" id="maxPhotos" min="10" max="50" step="5" value="20">
          </div>
          
          <div class="control-group">
            <label>Rotation: <span id="rotationValue">10°</span></label>
            <input type="range" id="rotation" min="0" max="20" step="1" value="10">
          </div>
          
          <div class="control-group">
            <label>Size Variation</label>
            <select id="sizeVariation">
              <option value="uniform">Uniform</option>
              <option value="slight" selected>Slight</option>
              <option value="dramatic">Dramatic</option>
            </select>
          </div>
          
          <div class="control-group">
            <label>Overlap</label>
            <select id="overlap">
              <option value="none" selected>None</option>
              <option value="slight">Slight</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
        </div>
        
        <!-- Debug -->
        <div class="control-section">
          <h3>Debug Overlays</h3>
          <label><input type="checkbox" id="debugClusters"> Cluster colors</label>
          <label><input type="checkbox" id="debugQuadrants"> Region lines</label>
          <label><input type="checkbox" id="debugPins"> Pin markers</label>
          <label><input type="checkbox" id="debugBounds"> Photo bounds</label>
        </div>
        
        <!-- Actions -->
        <div class="control-section">
          <div class="control-group">
            <label>Seed</label>
            <input type="number" id="seed" value="4821">
            <button id="randomSeed">🎲</button>
          </div>
          
          <button id="regenerate" class="primary">Regenerate</button>
          <button id="savePng">Save PNG</button>
          <button id="exportConfig">Export Config</button>
        </div>
        
      </div>
      
      <!-- Canvas Area -->
      <div class="canvas-container">
        <canvas id="collageCanvas" width="1000" height="1000"></canvas>
        <div id="mapContainer" class="hidden"></div>
      </div>
      
    </div>
    
    <!-- Status Bar -->
    <div id="status" class="status-bar">
      Ready — drop photos to begin
    </div>
    
  </div>
  
  <script src="lib/exif.js"></script>
  <script src="lib/leaflet/leaflet.js"></script>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

---

## Debug Overlays

When enabled, draw these on top of the collage:

**Cluster Colors:**
- Semi-transparent colored overlay on each photo
- Same color for photos in same cluster
- Use distinct hues: red, blue, green, orange, purple, cyan, etc.

**Region Lines:**
- Draw dashed lines showing the 8 region boundaries
- Label each region (NW, TOP, NE, etc.)

**Pin Markers:**
- Draw small circles at cluster centroid positions (mapped to canvas coords)
- Color matches cluster color

**Photo Bounds:**
- Draw rectangles around each photo's bounding box
- Useful for debugging collision detection

---

## Build Order

### Phase 1: Foundation
1. Create file structure
2. Set up index.html with basic layout
3. Add minimal CSS for functional UI
4. Include exif.js and Leaflet libraries

### Phase 2: Photo Loading
5. Implement photoLoader.js
6. Test: can drop photos, see count, GPS extracted

### Phase 3: Clustering
7. Implement clustering.js (DBSCAN)
8. Test: photos cluster correctly, view in console

### Phase 4: Map Rendering
9. Implement mapRenderer.js
10. Test: map appears with correct bounds

### Phase 5: Basic Canvas
11. Implement collageRenderer.js (just draw map + photos without layout)
12. Test: map and photos appear on canvas

### Phase 6: Map Regions Algorithm
13. Implement mapRegions.js fully
14. Test: photos scatter in correct regions with rotation/sizing

### Phase 7: Controls & Interactivity
15. Implement main.js with full event wiring
16. Test: sliders update collage in real-time

### Phase 8: Debug & Export
17. Add debug overlays
18. Add PNG save
19. Add config export

### Phase 9: Remaining Algorithms
20. Implement orbital.js
21. Implement anchoredScatter.js
22. Implement gravityWells.js
23. Implement gridOverlay.js
24. Implement spiral.js
25. Implement freeform.js

### Phase 10: Polish
26. Error handling for edge cases
27. Loading states
28. Performance optimization if needed

---

## Running Locally

```bash
cd then-and-there-web
python3 -m http.server 8000
# Open http://localhost:8000
```

Or with Node:
```bash
npx serve
```

---

## Edge Cases to Handle

| Case | Handling |
|------|----------|
| No photos dropped | Show "Drop photos to begin" |
| All photos missing GPS | Show warning, disable generate |
| Some photos missing GPS | Filter them out, show count |
| Only 1 photo | Still generate (single photo collage) |
| 100+ photos | No limit, but may be slow |
| Single cluster | All photos go to one region |
| Photos span entire globe | Large epsilon, may be one cluster |
| EXIF extraction fails | Treat as no GPS |
| Map tiles fail to load | Show error, continue with blank map area |

---

## Config Export Format

```json
{
  "exportedAt": "2026-01-27T10:30:00Z",
  "photoCount": 24,
  "clusterCount": 4,
  "algorithm": "mapRegions",
  "clustering": {
    "epsilon": 1.5,
    "minPoints": 3,
    "adaptive": true,
    "effectiveEpsilon": 1.0
  },
  "layout": {
    "mapAreaPercent": 50,
    "maxPhotos": 20,
    "sizeVariation": "slight",
    "rotationRange": 10,
    "overlapTolerance": "none"
  },
  "seed": 4821
}
```

---

## Success Criteria

- [ ] Can drop 20+ photos and see them load with GPS data
- [ ] Clustering produces reasonable groupings
- [ ] Map shows correct geographic area
- [ ] Map Regions algorithm places photos in logical positions
- [ ] Sliders update collage in real-time (<500ms)
- [ ] Can switch between all 7 algorithms
- [ ] Debug overlays help visualize what's happening
- [ ] Can export PNG of result
- [ ] Can export JSON config
- [ ] Same seed produces same output

---

## Notes for Claude Code

1. **Start with Map Regions only** — get the full pipeline working with one algorithm before adding others.

2. **Use ES Modules** — all JS files should use `export`/`import` syntax.

3. **No build step** — this should run directly in browser with a simple HTTP server.

4. **Prioritize functionality over beauty** — CSS should be minimal and functional.

5. **Console logging is fine** — this is a dev tool, verbose logging helps debugging.

6. **Test with real photos** — the user will drag photos from their Mac Photos app.

7. **Leaflet tiles need CORS** — OpenStreetMap tiles work fine, but note this for debugging.

8. **Full resolution images** — don't resize/thumbnail, user wants to test with real sizes.

---

## Reference: iOS App Parameters

For comparison, here are the values used in the iOS app:

```swift
// Clustering
let defaultEpsilon = 1.0  // km
let minPointsPerCluster = 2

// Layout
let mapAreaPercent = 50
let maxPhotosPerCollage = 30
let sizeDistribution = (small: 0.25, medium: 0.60, large: 0.15)
let rotationRange = 10  // degrees
let orbitalPullStrength = 0.15  // 15%

// Sizing
let smallScale = 0.7
let mediumScale = 1.0
let largeScale = 1.3
```

---

**Document Version:** 1.0  
**Created:** January 2026  
**Purpose:** Handoff to Claude Code for implementation
