# Collage Algorithm v3.1 — Edge Snap Layout with Zoom

## Overview

A complete rethink of the collage layout algorithm optimized for iPhone display (2.17:1 aspect ratio). Key innovations:

1. **Content-driven map sizing** — Map size determined by cluster positions, not arbitrary percentage
2. **Portrait elliptical clusters** — Clusters are taller than wide, matching device orientation
3. **Edge snapping placement** — Photos attach flush to existing photos, growing outward like crystals
4. **Master canvas with zoom** — Work at 2× scale, then zoom in/out via viewport
5. **Staged placement with spread** — Controlled randomness applied after structured placement

---

## Canvas Architecture

### The Zoom Model

Instead of resizing the map independently of photos, we use a **master canvas** approach:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    MASTER CANVAS (2x)                       │
│                                                             │
│         All clusters and photos placed here                 │
│         at fixed positions relative to map                  │
│                                                             │
│              ┌─────────────────────┐                        │
│              │                     │                        │
│              │   VIEWPORT          │                        │
│              │   (what user sees)  │                        │
│              │                     │                        │
│              │   map_size_mult     │                        │
│              │   controls size     │                        │
│              │                     │                        │
│              └─────────────────────┘                        │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

map_size_mult = 0.5  →  Viewport is SMALL  →  Zoomed IN   →  Photos appear LARGER
map_size_mult = 1.0  →  Viewport is MEDIUM →  Default     →  Balanced view
map_size_mult = 1.5  →  Viewport is LARGE  →  Zoomed OUT  →  Photos appear SMALLER
map_size_mult = 2.0  →  Viewport is FULL   →  Max zoom out → Everything visible
```

### Dimensions

```
Final Output:
  Aspect Ratio: 2.17:1 (height:width)
  Default: 1000 × 2170 pixels

Master Canvas:
  2× final output
  Default: 2000 × 4340 pixels
  
  All placement logic operates here.
  Photos and clusters are positioned relative to this space.

Viewport:
  Controlled by map_size_mult
  Centered on master canvas
  Scaled to fit final output
```

### Why This Works

- **Photos stay fixed to map** — When you "zoom out," photos shrink proportionally with the map
- **No re-placement needed** — Changing zoom doesn't require recalculating positions
- **Intuitive behavior** — Matches pinch-to-zoom in native map apps
- **Edge overflow becomes zoom overflow** — Photos near edges naturally appear/disappear based on zoom level

---

## Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: CLUSTERING                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Run DBSCAN on photo GPS coordinates                         │
│  2. Calculate cluster centroids                                 │
│  3. Score photos within each cluster                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 2: GEO TO MASTER CANVAS MAPPING              │
├─────────────────────────────────────────────────────────────────┤
│  1. Calculate geographic bounds of all clusters                 │
│  2. Map cluster centroids to master canvas coordinates          │
│  3. Maintain aspect ratio and center on master canvas           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 3: CLUSTER SIZING                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Calculate base radius: photoCount^exponent                  │
│  2. Apply portrait ellipse bias (2.17:1)                        │
│  3. Apply cluster_radius_mult                                   │
│  4. Expand clusters to fill master canvas                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 4: PHOTO SIZE CALCULATION                  │
├─────────────────────────────────────────────────────────────────┤
│  1. hero_area = master_canvas_area × hero_image_size_ratio      │
│  2. medium_area = hero_area × size_step_ratio                   │
│  3. small_area = medium_area × size_step_ratio                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 5: PLACE HERO PHOTOS                         │
├─────────────────────────────────────────────────────────────────┤
│  For each cluster:                                              │
│    1. Select highest-scored photo as hero                       │
│    2. Place hero at cluster centroid (master canvas coords)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            PHASE 6: EDGE SNAP PLACEMENT                         │
├─────────────────────────────────────────────────────────────────┤
│  For each cluster:                                              │
│    While photos remain AND attempts < max:                      │
│      1. Pick random size (medium/small by probability)          │
│      2. Get bounding box of placed photos (cluster_image_set)   │
│      3. Pick random edge of bounding box                        │
│      4. Pick random position along that edge                    │
│      5. Place photo flush against edge                          │
│      6. If within cluster ellipse AND no overlap → accept       │
│      7. If 10 consecutive failures → stop this cluster          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 7: POST-PLACEMENT ADJUSTMENTS                │
├─────────────────────────────────────────────────────────────────┤
│  1. Apply image_spread (push photos away from cluster center)   │
│  2. Apply random rotation to each photo                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 8: HANDLE CLUSTER OVERLAP                    │
├─────────────────────────────────────────────────────────────────┤
│  If photos from different clusters overlap:                     │
│    Delete overlapping photos one by one until none overlap      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 9: CALCULATE VIEWPORT                        │
├─────────────────────────────────────────────────────────────────┤
│  1. Viewport size = final_canvas × map_size_mult                │
│  2. Center viewport on master canvas                            │
│  3. Calculate scale factor for rendering                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 10: HANDLE VIEWPORT OVERFLOW                 │
├─────────────────────────────────────────────────────────────────┤
│  For photos partially/fully outside viewport:                   │
│    - 'crop': Clip photo at viewport edge                        │
│    - 'delete': Remove photo entirely                            │
│    - 'shift': Move photo inward until fully visible             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 11: RENDER                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Draw map background (scaled by viewport)                    │
│  2. Transform: scale and translate for viewport                 │
│  3. Draw photos at master canvas positions                      │
│  4. Transform handles the "zoom" effect automatically           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Parameters

### All Tunable Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `cluster_ellipse_mult` | 2.17 | 1.0 – 3.0 | Height:width ratio of cluster ellipses (portrait orientation) |
| `cluster_radius_photo_count_exp` | 0.5 | 0.1 – 1.0 | Exponent for photoCount → radius scaling |
| `cluster_radius_mult` | 1.0 | 0.25 – 2.0 | Multiplier on calculated cluster radius |
| `map_size_mult` | 1.0 | 0.5 – 2.0 | Zoom level: <1 = zoomed in, >1 = zoomed out |
| `hero_image_size_ratio` | 0.05 | 0.01 – 0.25 | Hero area as fraction of master canvas area |
| `size_step_ratio` | 0.25 | 0.1 – 0.5 | Area ratio between size tiers |
| `medium_probability_early` | 0.75 | 0 – 1.0 | P(medium) for first 5 photos after hero |
| `small_probability_early` | 0.25 | 0 – 1.0 | P(small) for first 5 photos after hero |
| `medium_probability_late` | 0.25 | 0 – 1.0 | P(medium) after first 5 photos |
| `small_probability_late` | 0.75 | 0 – 1.0 | P(small) after first 5 photos |
| `image_spread` | 1.0 | 0.5 – 2.0 | Post-placement spread multiplier from cluster center |
| `rotation_range` | 10 | 0 – 20 | Max rotation in degrees (±) |
| `placement_attempts` | 10 | 5 – 50 | Consecutive failures before stopping cluster |
| `edge_overflow_mode` | 'crop' | 'crop' / 'delete' / 'shift' | How to handle viewport overflow |

### Config Object Structure

```javascript
{
  canvas: {
    aspectRatio: 2.17,           // height:width
    width: 1000,                 // final output width in pixels
    height: 2170,                // final output height (width × aspectRatio)
    masterScale: 2               // master canvas multiplier
  },
  clustering: {
    epsilon: 1.0,                // km (from previous implementation)
    minPoints: 3,
    adaptive: true
  },
  clusterSizing: {
    ellipseMult: 2.17,
    photoCountExp: 0.5,
    radiusMult: 1.0
  },
  zoom: {
    mapSizeMult: 1.0             // viewport zoom level
  },
  photoSizing: {
    heroSizeRatio: 0.05,         // relative to master canvas
    sizeStepRatio: 0.25
  },
  placement: {
    mediumProbabilityEarly: 0.75,
    smallProbabilityEarly: 0.25,
    mediumProbabilityLate: 0.25,
    smallProbabilityLate: 0.75,
    attempts: 10
  },
  postProcess: {
    imageSpread: 1.0,
    rotationRange: 10
  },
  edgeOverflow: {
    mode: 'crop'                 // 'crop' | 'delete' | 'shift'
  },
  seed: 4821
}
```

---

## Detailed Phase Specifications

### Phase 1: Clustering

Use existing DBSCAN implementation from previous version. No changes needed.

**Output:**
```javascript
clusters = [
  {
    id: 0,
    photos: Photo[],
    centroid: { lat, lon },
    bounds: { north, south, east, west }
  },
  // ...
]
```

---

### Phase 2: Geo to Master Canvas Mapping

Map geographic coordinates to master canvas positions.

```javascript
function mapClustersToMasterCanvas(clusters, masterCanvas) {
  // Calculate geographic bounds
  const geoBounds = calculateGeoBounds(clusters);
  
  // Add padding to geo bounds (10%)
  const latPadding = (geoBounds.maxLat - geoBounds.minLat) * 0.1 || 0.01;
  const lonPadding = (geoBounds.maxLon - geoBounds.minLon) * 0.1 || 0.01;
  
  const paddedBounds = {
    minLat: geoBounds.minLat - latPadding,
    maxLat: geoBounds.maxLat + latPadding,
    minLon: geoBounds.minLon - lonPadding,
    maxLon: geoBounds.maxLon + lonPadding
  };
  
  // Calculate aspect ratios
  const geoAspect = (paddedBounds.maxLon - paddedBounds.minLon) / 
                    (paddedBounds.maxLat - paddedBounds.minLat);
  const canvasAspect = masterCanvas.width / masterCanvas.height;
  
  // Determine mapping area (fit geo bounds into canvas maintaining aspect)
  let mapWidth, mapHeight, offsetX, offsetY;
  
  if (geoAspect > canvasAspect) {
    // Geo is wider - fit to width
    mapWidth = masterCanvas.width * 0.9;  // 90% to leave margin
    mapHeight = mapWidth / geoAspect;
    offsetX = masterCanvas.width * 0.05;
    offsetY = (masterCanvas.height - mapHeight) / 2;
  } else {
    // Geo is taller - fit to height
    mapHeight = masterCanvas.height * 0.9;
    mapWidth = mapHeight * geoAspect;
    offsetX = (masterCanvas.width - mapWidth) / 2;
    offsetY = masterCanvas.height * 0.05;
  }
  
  // Map each cluster centroid to canvas coordinates
  for (const cluster of clusters) {
    const normalX = (cluster.centroid.lon - paddedBounds.minLon) / 
                    (paddedBounds.maxLon - paddedBounds.minLon);
    const normalY = (paddedBounds.maxLat - cluster.centroid.lat) / 
                    (paddedBounds.maxLat - paddedBounds.minLat);  // Flip Y
    
    cluster.masterPos = {
      x: offsetX + normalX * mapWidth,
      y: offsetY + normalY * mapHeight
    };
  }
  
  // Return the map region for later rendering
  return {
    geoBounds: paddedBounds,
    canvasRegion: { x: offsetX, y: offsetY, width: mapWidth, height: mapHeight }
  };
}

function calculateGeoBounds(clusters) {
  const lats = clusters.map(c => c.centroid.lat);
  const lons = clusters.map(c => c.centroid.lon);
  
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  };
}
```

---

### Phase 3: Cluster Sizing

**Portrait Ellipse Formula:**

For a point (x, y) relative to cluster center, it's inside the ellipse if:

```
x² + (y / ellipseMult)² ≤ radius²
```

Where:
- `ellipseMult = 2.17` (default)
- This creates an ellipse that's 2.17× taller than it is wide

**Radius Calculation:**

```javascript
function calculateClusterRadiuses(clusters, masterCanvas, params) {
  // Base radius from photo count with sub-linear scaling
  for (const cluster of clusters) {
    const photoCount = cluster.photos.length;
    cluster.baseRadius = Math.pow(photoCount, params.clusterSizing.photoCountExp);
  }
  
  // Normalize radiuses relative to master canvas size
  const maxBaseRadius = Math.max(...clusters.map(c => c.baseRadius));
  const referenceSize = Math.min(masterCanvas.width, masterCanvas.height) * 0.15;
  
  for (const cluster of clusters) {
    cluster.radius = (cluster.baseRadius / maxBaseRadius) * referenceSize;
    cluster.radius *= params.clusterSizing.radiusMult;
  }
  
  // Expand to fill available space
  expandClustersToFill(clusters, masterCanvas, params);
}

function expandClustersToFill(clusters, masterCanvas, params) {
  const maxIterations = 50;
  const expansionFactor = 1.05;
  const maxRadius = Math.min(masterCanvas.width, masterCanvas.height) * 0.4;
  
  for (let i = 0; i < maxIterations; i++) {
    let canExpand = true;
    
    // Check if expansion would cause overlap between clusters
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        if (ellipsesWouldOverlap(clusters[a], clusters[b], expansionFactor, params)) {
          canExpand = false;
          break;
        }
      }
      if (!canExpand) break;
    }
    
    // Check if any cluster would exceed max radius
    if (clusters.some(c => c.radius * expansionFactor > maxRadius)) {
      canExpand = false;
    }
    
    if (!canExpand) break;
    
    // Expand all clusters
    for (const cluster of clusters) {
      cluster.radius *= expansionFactor;
    }
  }
}

function ellipsesWouldOverlap(clusterA, clusterB, expansionFactor, params) {
  const radiusA = clusterA.radius * expansionFactor;
  const radiusB = clusterB.radius * expansionFactor;
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  const dx = clusterB.masterPos.x - clusterA.masterPos.x;
  const dy = clusterB.masterPos.y - clusterA.masterPos.y;
  
  // Approximate ellipse-ellipse overlap check
  // Normalize by combined ellipse dimensions
  const combinedRadiusX = radiusA + radiusB;
  const combinedRadiusY = (radiusA + radiusB) * ellipseMult;
  
  const normalizedDist = Math.sqrt(
    (dx / combinedRadiusX) ** 2 + 
    (dy / combinedRadiusY) ** 2
  );
  
  return normalizedDist < 1.0;
}
```

---

### Phase 4: Photo Size Calculation

Photo sizes are calculated relative to master canvas, so they scale with zoom.

```javascript
function calculatePhotoSizes(masterCanvas, params) {
  const masterArea = masterCanvas.width * masterCanvas.height;
  
  const heroArea = masterArea * params.photoSizing.heroSizeRatio;
  const mediumArea = heroArea * params.photoSizing.sizeStepRatio;
  const smallArea = mediumArea * params.photoSizing.sizeStepRatio;
  
  return {
    hero: heroArea,
    medium: mediumArea,
    small: smallArea
  };
}

/**
 * Convert area budget to actual dimensions preserving aspect ratio
 */
function areaToDimensions(targetArea, photo) {
  const aspectRatio = photo.width / photo.height;
  
  // area = w * h, and w = h * aspectRatio
  // area = h² * aspectRatio
  // h = sqrt(area / aspectRatio)
  const height = Math.sqrt(targetArea / aspectRatio);
  const width = height * aspectRatio;
  
  return { width, height };
}
```

**Size Hierarchy (with default size_step_ratio = 0.25):**

```
Hero:   100% of hero_area
Medium: 25% of hero_area  (dimensions: 50% of hero)
Small:  6.25% of hero_area (dimensions: 25% of hero)
```

---

### Phase 5: Place Hero Photos

```javascript
function placeHeroPhotos(clusters, photoSizes, rng) {
  const placements = [];
  
  for (const cluster of clusters) {
    // Find highest-scored photo
    const scoredPhotos = cluster.photos.map(p => ({
      photo: p,
      score: scorePhoto(p)
    }));
    scoredPhotos.sort((a, b) => b.score - a.score);
    
    const heroPhoto = scoredPhotos[0].photo;
    cluster.heroPhoto = heroPhoto;
    cluster.remainingPhotos = scoredPhotos.slice(1).map(s => s.photo);
    
    // Calculate hero dimensions
    const { width, height } = areaToDimensions(photoSizes.hero, heroPhoto);
    
    // Place at cluster center (master canvas coordinates)
    placements.push({
      photo: heroPhoto,
      x: cluster.masterPos.x,
      y: cluster.masterPos.y,
      width,
      height,
      rotation: 0,
      clusterId: cluster.id,
      isHero: true,
      sizeCategory: 'hero'
    });
    
    // Initialize cluster's placed photos for edge snapping
    cluster.placedPhotos = [placements[placements.length - 1]];
  }
  
  return placements;
}

function scorePhoto(photo) {
  let score = 0;
  if (photo.hasFaces) score += 40;
  score += (photo.quality ?? 0.5) * 60;
  return score;
}
```

---

### Phase 6: Edge Snap Placement

```javascript
function edgeSnapPlacement(clusters, photoSizes, params, rng) {
  const allPlacements = [];
  
  for (const cluster of clusters) {
    let consecutiveFailures = 0;
    let photosPlacedAfterHero = 0;
    
    for (const photo of cluster.remainingPhotos) {
      if (consecutiveFailures >= params.placement.attempts) {
        break;
      }
      
      // Determine size category by probability
      const sizeCategory = pickSizeCategory(photosPlacedAfterHero, params, rng);
      const targetArea = photoSizes[sizeCategory];
      const { width, height } = areaToDimensions(targetArea, photo);
      
      // Try to place this photo
      const placement = tryPlacePhoto(
        photo, 
        width, 
        height, 
        sizeCategory,
        cluster, 
        params, 
        rng
      );
      
      if (placement) {
        cluster.placedPhotos.push(placement);
        allPlacements.push(placement);
        consecutiveFailures = 0;
        photosPlacedAfterHero++;
      } else {
        consecutiveFailures++;
      }
    }
  }
  
  return allPlacements;
}

function pickSizeCategory(photosPlacedAfterHero, params, rng) {
  const isEarly = photosPlacedAfterHero < 5;
  
  const mediumProb = isEarly 
    ? params.placement.mediumProbabilityEarly 
    : params.placement.mediumProbabilityLate;
  
  return rng.next() < mediumProb ? 'medium' : 'small';
}

function tryPlacePhoto(photo, width, height, sizeCategory, cluster, params, rng) {
  const bbox = getClusterBoundingBox(cluster.placedPhotos);
  
  for (let attempt = 0; attempt < params.placement.attempts; attempt++) {
    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = rng.int(0, 3);
    
    // Pick a random position along that edge
    const position = getRandomEdgePosition(bbox, edge, width, height, rng);
    
    // Check constraints
    if (!isWithinClusterEllipse(position.x, position.y, cluster, params)) {
      continue;
    }
    
    if (overlapsExistingPhotos(position, width, height, cluster.placedPhotos)) {
      continue;
    }
    
    return {
      photo,
      x: position.x,
      y: position.y,
      width,
      height,
      rotation: 0,
      clusterId: cluster.id,
      isHero: false,
      sizeCategory
    };
  }
  
  return null;
}

function getClusterBoundingBox(placedPhotos) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of placedPhotos) {
    const halfW = p.width / 2;
    const halfH = p.height / 2;
    
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  }
  
  return { minX, maxX, minY, maxY };
}

function getRandomEdgePosition(bbox, edge, photoWidth, photoHeight, rng) {
  const halfW = photoWidth / 2;
  const halfH = photoHeight / 2;
  
  switch (edge) {
    case 0: // Top - photo goes above bbox
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.minY - halfH
      };
    case 1: // Right - photo goes to the right
      return {
        x: bbox.maxX + halfW,
        y: rng.range(bbox.minY, bbox.maxY)
      };
    case 2: // Bottom - photo goes below
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.maxY + halfH
      };
    case 3: // Left - photo goes to the left
      return {
        x: bbox.minX - halfW,
        y: rng.range(bbox.minY, bbox.maxY)
      };
  }
}

function isWithinClusterEllipse(x, y, cluster, params) {
  const dx = x - cluster.masterPos.x;
  const dy = y - cluster.masterPos.y;
  const r = cluster.radius;
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  // Ellipse equation: x² + (y/ellipseMult)² ≤ r²
  const normalizedDist = (dx * dx) + (dy * dy) / (ellipseMult * ellipseMult);
  
  return normalizedDist <= r * r;
}

function overlapsExistingPhotos(position, width, height, placedPhotos) {
  const halfW = width / 2;
  const halfH = height / 2;
  
  const newRect = {
    left: position.x - halfW,
    right: position.x + halfW,
    top: position.y - halfH,
    bottom: position.y + halfH
  };
  
  for (const placed of placedPhotos) {
    const pHalfW = placed.width / 2;
    const pHalfH = placed.height / 2;
    
    const placedRect = {
      left: placed.x - pHalfW,
      right: placed.x + pHalfW,
      top: placed.y - pHalfH,
      bottom: placed.y + pHalfH
    };
    
    if (newRect.left < placedRect.right &&
        newRect.right > placedRect.left &&
        newRect.top < placedRect.bottom &&
        newRect.bottom > placedRect.top) {
      return true;
    }
  }
  
  return false;
}
```

---

### Phase 7: Post-Placement Adjustments

```javascript
function applyImageSpread(placements, clusters, params) {
  const spreadMult = params.postProcess.imageSpread;
  
  if (spreadMult === 1.0) return;
  
  for (const placement of placements) {
    if (placement.isHero) continue;
    
    const cluster = clusters.find(c => c.id === placement.clusterId);
    
    // Vector from cluster center to photo
    const dx = placement.x - cluster.masterPos.x;
    const dy = placement.y - cluster.masterPos.y;
    
    // Apply spread
    placement.x = cluster.masterPos.x + dx * spreadMult;
    placement.y = cluster.masterPos.y + dy * spreadMult;
  }
}

function applyRandomRotation(placements, params, rng) {
  const range = params.postProcess.rotationRange;
  
  for (const placement of placements) {
    const maxRotation = placement.isHero ? range * 0.5 : range;
    placement.rotation = rng.range(-maxRotation, maxRotation);
  }
}
```

---

### Phase 8: Handle Cluster Overlap

```javascript
function resolveInterClusterOverlap(placements) {
  let hadOverlap = true;
  
  while (hadOverlap) {
    hadOverlap = false;
    
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        
        if (a.clusterId === b.clusterId) continue;
        
        if (photosOverlap(a, b)) {
          const removeIndex = getRemovalPriority(a, b) ? j : i;
          placements.splice(removeIndex, 1);
          hadOverlap = true;
          break;
        }
      }
      if (hadOverlap) break;
    }
  }
  
  return placements;
}

function photosOverlap(a, b) {
  const aLeft = a.x - a.width / 2;
  const aRight = a.x + a.width / 2;
  const aTop = a.y - a.height / 2;
  const aBottom = a.y + a.height / 2;
  
  const bLeft = b.x - b.width / 2;
  const bRight = b.x + b.width / 2;
  const bTop = b.y - b.height / 2;
  const bBottom = b.y + b.height / 2;
  
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function getRemovalPriority(a, b) {
  // Return true if b should be removed
  if (a.isHero && !b.isHero) return true;
  if (!a.isHero && b.isHero) return false;
  if (a.sizeCategory === 'medium' && b.sizeCategory === 'small') return true;
  if (a.sizeCategory === 'small' && b.sizeCategory === 'medium') return false;
  return true;
}
```

---

### Phase 9: Calculate Viewport

**This is the key new phase that implements the zoom model.**

```javascript
function calculateViewport(masterCanvas, finalCanvas, params) {
  const mapSizeMult = params.zoom.mapSizeMult;
  
  // Viewport size in master canvas coordinates
  // When mapSizeMult = 1.0, viewport equals final canvas size
  // When mapSizeMult > 1.0, viewport is larger (zoomed out)
  // When mapSizeMult < 1.0, viewport is smaller (zoomed in)
  const viewportWidth = finalCanvas.width * mapSizeMult;
  const viewportHeight = finalCanvas.height * mapSizeMult;
  
  // Center viewport on master canvas
  const viewportX = (masterCanvas.width - viewportWidth) / 2;
  const viewportY = (masterCanvas.height - viewportHeight) / 2;
  
  // Scale factor: how much to scale master canvas coords to final canvas
  const scaleX = finalCanvas.width / viewportWidth;
  const scaleY = finalCanvas.height / viewportHeight;
  
  return {
    x: viewportX,
    y: viewportY,
    width: viewportWidth,
    height: viewportHeight,
    scaleX,
    scaleY
  };
}
```

**Viewport behavior by map_size_mult:**

| map_size_mult | Viewport Size | Scale | Visual Effect |
|---------------|---------------|-------|---------------|
| 0.5 | 500 × 1085 | 2.0 | Zoomed in, photos appear 2× larger |
| 1.0 | 1000 × 2170 | 1.0 | Default, 1:1 mapping |
| 1.5 | 1500 × 3255 | 0.67 | Zoomed out, photos appear 2/3 size |
| 2.0 | 2000 × 4340 | 0.5 | Full zoom out, entire master visible |

---

### Phase 10: Handle Viewport Overflow

Check which photos are outside the viewport and handle accordingly.

```javascript
function handleViewportOverflow(placements, viewport, params) {
  const mode = params.edgeOverflow.mode;
  const result = [];
  
  for (const placement of placements) {
    const overflow = getViewportOverflow(placement, viewport);
    
    if (!overflow.any) {
      result.push(placement);
      continue;
    }
    
    switch (mode) {
      case 'crop':
        placement.clipped = true;
        result.push(placement);
        break;
        
      case 'delete':
        // Check if COMPLETELY outside viewport
        if (overflow.complete) {
          // Don't include
        } else {
          // Partially visible - keep but mark for clipping
          placement.clipped = true;
          result.push(placement);
        }
        break;
        
      case 'shift':
        shiftIntoViewport(placement, viewport);
        result.push(placement);
        break;
    }
  }
  
  return result;
}

function getViewportOverflow(placement, viewport) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;
  
  const photoLeft = placement.x - halfW;
  const photoRight = placement.x + halfW;
  const photoTop = placement.y - halfH;
  const photoBottom = placement.y + halfH;
  
  const viewLeft = viewport.x;
  const viewRight = viewport.x + viewport.width;
  const viewTop = viewport.y;
  const viewBottom = viewport.y + viewport.height;
  
  const overflowLeft = photoLeft < viewLeft;
  const overflowRight = photoRight > viewRight;
  const overflowTop = photoTop < viewTop;
  const overflowBottom = photoBottom > viewBottom;
  
  // Completely outside = no part visible
  const complete = photoRight < viewLeft || 
                   photoLeft > viewRight || 
                   photoBottom < viewTop || 
                   photoTop > viewBottom;
  
  return {
    left: overflowLeft,
    right: overflowRight,
    top: overflowTop,
    bottom: overflowBottom,
    any: overflowLeft || overflowRight || overflowTop || overflowBottom,
    complete
  };
}

function shiftIntoViewport(placement, viewport) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;
  
  const minX = viewport.x + halfW;
  const maxX = viewport.x + viewport.width - halfW;
  const minY = viewport.y + halfH;
  const maxY = viewport.y + viewport.height - halfH;
  
  placement.x = Math.max(minX, Math.min(maxX, placement.x));
  placement.y = Math.max(minY, Math.min(maxY, placement.y));
}
```

---

### Phase 11: Render

```javascript
async function renderCollage(
  canvas, 
  clusters, 
  placements, 
  mapRegion, 
  viewport, 
  config
) {
  const ctx = canvas.getContext('2d');
  
  // 1. Clear canvas
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Render map background
  //    Map tiles need to be fetched for the geographic region
  //    then scaled/positioned according to viewport
  const mapCanvas = await renderMapForViewport(
    mapRegion,
    viewport,
    canvas,
    config.mapStyle || 'street'
  );
  ctx.drawImage(mapCanvas, 0, 0);
  
  // 3. Set up viewport transform
  ctx.save();
  
  // Scale from master canvas to final canvas
  ctx.scale(viewport.scaleX, viewport.scaleY);
  
  // Translate so viewport origin maps to canvas origin
  ctx.translate(-viewport.x, -viewport.y);
  
  // 4. Set up clipping region (for 'crop' mode)
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();
  
  // 5. Sort placements for draw order
  placements.sort((a, b) => {
    if (a.isHero && !b.isHero) return 1;
    if (!a.isHero && b.isHero) return -1;
    return (b.width * b.height) - (a.width * a.height);
  });
  
  // 6. Draw photos at master canvas positions
  //    The transform handles scaling automatically
  for (const placement of placements) {
    drawPhoto(ctx, placement);
  }
  
  ctx.restore();
}

function drawPhoto(ctx, placement) {
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
}

async function renderMapForViewport(mapRegion, viewport, finalCanvas, mapStyle) {
  // The map needs to cover the viewport area
  // mapRegion contains the geographic bounds and master canvas position
  
  // Calculate which part of the geo bounds is visible in viewport
  // This is a bit complex - we need to map viewport coords back to geo coords
  
  // For simplicity, render map for full master canvas region,
  // then let the viewport transform crop it
  
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = finalCanvas.width;
  mapCanvas.height = finalCanvas.height;
  
  const mapCtx = mapCanvas.getContext('2d');
  
  // Fetch map tiles for the geographic region
  // Scale and position to match viewport
  await renderMapTiles(
    mapCtx,
    mapRegion.geoBounds,
    viewport,
    finalCanvas,
    mapStyle
  );
  
  return mapCanvas;
}
```

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
│       └── edgeSnapZoom.js    ← This algorithm (v3.1)
└── lib/
    ├── exif.js
    └── leaflet/
```

---

## UI Controls

### HTML

```html
<!-- Canvas Settings -->
<div class="control-section">
  <h3>Canvas</h3>
  <div class="control-group">
    <label>Aspect Ratio (H:W): <span id="aspectRatioValue">2.17</span></label>
    <input type="range" id="aspectRatio" min="1.0" max="3.0" step="0.01" value="2.17">
  </div>
</div>

<!-- Zoom Control -->
<div class="control-section">
  <h3>Zoom</h3>
  <div class="control-group">
    <label>Map Zoom: <span id="mapZoomValue">1.0</span>x</label>
    <input type="range" id="mapZoom" min="0.5" max="2.0" step="0.05" value="1.0">
    <small>< 1 = zoomed in, > 1 = zoomed out</small>
  </div>
</div>

<!-- Cluster Sizing -->
<div class="control-section">
  <h3>Cluster Sizing</h3>
  
  <div class="control-group">
    <label>Ellipse Mult (H:W): <span id="ellipseMultValue">2.17</span></label>
    <input type="range" id="ellipseMult" min="1.0" max="3.0" step="0.01" value="2.17">
  </div>
  
  <div class="control-group">
    <label>Photo Count Exponent: <span id="photoCountExpValue">0.5</span></label>
    <input type="range" id="photoCountExp" min="0.1" max="1.0" step="0.05" value="0.5">
  </div>
  
  <div class="control-group">
    <label>Radius Multiplier: <span id="radiusMultValue">1.0</span></label>
    <input type="range" id="radiusMult" min="0.25" max="2.0" step="0.05" value="1.0">
  </div>
</div>

<!-- Photo Sizing -->
<div class="control-section">
  <h3>Photo Sizing</h3>
  
  <div class="control-group">
    <label>Hero Size (% of canvas): <span id="heroSizeValue">5</span>%</label>
    <input type="range" id="heroSize" min="1" max="25" step="1" value="5">
  </div>
  
  <div class="control-group">
    <label>Size Step Ratio: <span id="sizeStepValue">0.25</span></label>
    <input type="range" id="sizeStep" min="0.1" max="0.5" step="0.05" value="0.25">
  </div>
</div>

<!-- Placement Probabilities -->
<div class="control-section">
  <h3>Size Probabilities</h3>
  
  <div class="control-group">
    <label>Early Medium %: <span id="earlyMediumValue">75</span>%</label>
    <input type="range" id="earlyMedium" min="0" max="100" step="5" value="75">
  </div>
  
  <div class="control-group">
    <label>Late Medium %: <span id="lateMediumValue">25</span>%</label>
    <input type="range" id="lateMedium" min="0" max="100" step="5" value="25">
  </div>
  
  <div class="control-group">
    <label>Placement Attempts: <span id="attemptsValue">10</span></label>
    <input type="range" id="attempts" min="5" max="50" step="5" value="10">
  </div>
</div>

<!-- Post-Processing -->
<div class="control-section">
  <h3>Post-Processing</h3>
  
  <div class="control-group">
    <label>Image Spread: <span id="spreadValue">1.0</span>x</label>
    <input type="range" id="spread" min="0.5" max="2.0" step="0.05" value="1.0">
  </div>
  
  <div class="control-group">
    <label>Rotation Range: <span id="rotationValue">10</span>°</label>
    <input type="range" id="rotation" min="0" max="20" step="1" value="10">
  </div>
</div>

<!-- Edge Overflow -->
<div class="control-section">
  <h3>Edge Overflow</h3>
  
  <div class="control-group">
    <label>Overflow Mode</label>
    <select id="overflowMode">
      <option value="crop" selected>Crop at edge</option>
      <option value="delete">Delete photo</option>
      <option value="shift">Shift inward</option>
    </select>
  </div>
</div>
```

---

## Debug Overlays

### Master Canvas vs Viewport

```javascript
function drawViewportDebug(ctx, viewport, masterCanvas, finalCanvas) {
  // Draw in final canvas coordinates
  ctx.save();
  
  // Show viewport bounds on a mini master canvas representation
  const miniScale = 0.15;
  const miniWidth = masterCanvas.width * miniScale;
  const miniHeight = masterCanvas.height * miniScale;
  const miniX = 10;
  const miniY = 10;
  
  // Master canvas outline
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(miniX, miniY, miniWidth, miniHeight);
  ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
  ctx.fillRect(miniX, miniY, miniWidth, miniHeight);
  
  // Viewport within master
  const vpMiniX = miniX + (viewport.x / masterCanvas.width) * miniWidth;
  const vpMiniY = miniY + (viewport.y / masterCanvas.height) * miniHeight;
  const vpMiniW = (viewport.width / masterCanvas.width) * miniWidth;
  const vpMiniH = (viewport.height / masterCanvas.height) * miniHeight;
  
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(vpMiniX, vpMiniY, vpMiniW, vpMiniH);
  ctx.fillStyle = 'rgba(255, 100, 100, 0.1)';
  ctx.fillRect(vpMiniX, vpMiniY, vpMiniW, vpMiniH);
  
  // Label
  ctx.fillStyle = '#333';
  ctx.font = '10px sans-serif';
  ctx.fillText('Master Canvas', miniX, miniY - 3);
  ctx.fillStyle = '#c00';
  ctx.fillText('Viewport', vpMiniX, vpMiniY - 3);
  
  ctx.restore();
}
```

### Cluster Ellipses (in viewport coordinates)

```javascript
function drawClusterEllipses(ctx, clusters, viewport, params) {
  ctx.save();
  
  // Apply viewport transform
  ctx.scale(viewport.scaleX, viewport.scaleY);
  ctx.translate(-viewport.x, -viewport.y);
  
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  for (const cluster of clusters) {
    ctx.save();
    ctx.translate(cluster.masterPos.x, cluster.masterPos.y);
    
    ctx.beginPath();
    ctx.ellipse(
      0, 0,
      cluster.radius,
      cluster.radius * ellipseMult,
      0,
      0, Math.PI * 2
    );
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 2 / viewport.scaleX;  // Maintain consistent line width
    ctx.setLineDash([5 / viewport.scaleX, 5 / viewport.scaleX]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
  }
  
  ctx.restore();
}
```

---

## Return Value

```javascript
{
  placements: Placement[],
  masterCanvas: { width, height },
  viewport: { x, y, width, height, scaleX, scaleY },
  mapRegion: { geoBounds, canvasRegion },
  clusters: [
    {
      id,
      masterPos: { x, y },
      radius,
      photosPlaced: number,
      photosSkipped: number
    }
  ],
  stats: {
    totalPhotos: number,
    placedPhotos: number,
    deletedOverlap: number,
    deletedOverflow: number,
    croppedOverflow: number,
    shiftedOverflow: number
  }
}
```

---

## Testing Checklist

### Zoom Behavior
- [ ] map_size_mult = 0.5 shows zoomed in view (photos larger)
- [ ] map_size_mult = 1.0 shows default view
- [ ] map_size_mult = 2.0 shows fully zoomed out (all content visible)
- [ ] Photos stay fixed to map when changing zoom
- [ ] Clusters stay fixed to map when changing zoom
- [ ] Map geography matches cluster positions at all zoom levels

### Core Functionality
- [ ] Canvas renders at 2.17:1 ratio
- [ ] Clusters form portrait ellipses (taller than wide)
- [ ] Hero photos placed at cluster centers
- [ ] Edge snapping places photos flush against existing
- [ ] Photos don't overlap within a cluster
- [ ] Photos stop being added after 10 consecutive failures
- [ ] Image spread pushes photos outward from center
- [ ] Rotation applied to all photos
- [ ] Inter-cluster overlap resolved by deletion
- [ ] Edge overflow handled by selected mode

### Parameters
- [ ] All sliders update view in real-time
- [ ] Seed produces consistent results

### Edge Cases
- [ ] Single cluster
- [ ] Many clusters (10+)
- [ ] Few photos (3-5)
- [ ] Many photos (50+)
- [ ] Extreme zoom in (map_size_mult = 0.5)
- [ ] Extreme zoom out (map_size_mult = 2.0)

---

## Summary: Key Changes from v3

| Aspect | v3 (Edge Snap) | v3.1 (Edge Snap Zoom) |
|--------|----------------|----------------------|
| Map sizing | Content-driven percentage | Master canvas + viewport |
| map_size_mult effect | Resized map only | Zoom (scales everything together) |
| Photo positions | Relative to map | Fixed to master canvas |
| Rendering | Direct to canvas | Viewport transform |

---

**Document Version:** 1.1  
**Algorithm Name:** Edge Snap Layout with Zoom (v3.1)  
**Purpose:** Complete specification for Claude Code implementation
