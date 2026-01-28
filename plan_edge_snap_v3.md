# Collage Algorithm v3 — Edge Snap Layout

## Overview

A complete rethink of the collage layout algorithm optimized for iPhone display (2.17:1 aspect ratio). Key innovations:

1. **Content-driven map sizing** — Map size determined by cluster positions, not arbitrary percentage
2. **Portrait elliptical clusters** — Clusters are taller than wide, matching device orientation
3. **Edge snapping placement** — Photos attach flush to existing photos, growing outward like crystals
4. **Staged placement with spread** — Controlled randomness applied after structured placement

---

## Canvas Dimensions

```
Aspect Ratio: 2.17:1 (height:width)
Default Canvas: 1000 × 2170 pixels

iPhone Reference:
- iPhone 14/15 Pro: 2556 × 1179 = 2.17:1
- This matches the native display ratio
```

The collage outputs at this ratio so it displays perfectly on iPhone without letterboxing or cropping.

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
│                 PHASE 2: CLUSTER SIZING                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Calculate base radius: photoCount^exponent                  │
│  2. Apply portrait ellipse bias (2.17:1)                        │
│  3. Apply cluster_radius_mult                                   │
│  4. Expand clusters to fill available space                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 3: MAP SIZING                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Calculate bounding box that fits all cluster ellipses       │
│  2. Add padding                                                 │
│  3. Apply map_size_mult                                         │
│  4. This becomes the map region                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 4: PHOTO SIZE CALCULATION                  │
├─────────────────────────────────────────────────────────────────┤
│  1. hero_area = map_area × hero_image_size_ratio                │
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
│    2. Place hero at cluster centroid                            │
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
│      6. If within cluster radius AND no overlap → accept        │
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
│              PHASE 9: HANDLE EDGE OVERFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│  For photos extending beyond canvas bounds:                     │
│    - 'crop': Clip photo at canvas edge                          │
│    - 'delete': Remove photo entirely                            │
│    - 'shift': Move photo inward until fully visible             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 10: RENDER                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Draw map background                                         │
│  2. Draw photos in order (heroes last / on top)                 │
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
| `map_size_mult` | 1.0 | 0.1 – 1.5 | Multiplier on calculated map size |
| `hero_image_size_ratio` | 0.10 | 0.01 – 0.5 | Hero area as fraction of map area |
| `size_step_ratio` | 0.25 | 0.1 – 0.5 | Area ratio between size tiers |
| `medium_probability_early` | 0.75 | 0 – 1.0 | P(medium) for first 5 photos after hero |
| `small_probability_early` | 0.25 | 0 – 1.0 | P(small) for first 5 photos after hero |
| `medium_probability_late` | 0.25 | 0 – 1.0 | P(medium) after first 5 photos |
| `small_probability_late` | 0.75 | 0 – 1.0 | P(small) after first 5 photos |
| `image_spread` | 1.0 | 0.5 – 2.0 | Post-placement spread multiplier from cluster center |
| `rotation_range` | 10 | 0 – 20 | Max rotation in degrees (±) |
| `placement_attempts` | 10 | 5 – 50 | Consecutive failures before stopping cluster |
| `edge_overflow_mode` | 'crop' | 'crop' / 'delete' / 'shift' | How to handle canvas overflow |

### Config Object Structure

```javascript
{
  canvas: {
    aspectRatio: 2.17,      // height:width
    width: 1000,            // pixels
    height: 2170            // pixels (width × aspectRatio)
  },
  clustering: {
    epsilon: 1.0,           // km (from previous implementation)
    minPoints: 3,
    adaptive: true
  },
  clusterSizing: {
    ellipseMult: 2.17,
    photoCountExp: 0.5,
    radiusMult: 1.0
  },
  mapSizing: {
    sizeMult: 1.0
  },
  photoSizing: {
    heroSizeRatio: 0.10,
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
    mode: 'crop'  // 'crop' | 'delete' | 'shift'
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

### Phase 2: Cluster Sizing

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
function calculateClusterRadius(cluster, params) {
  const photoCount = cluster.photos.length;
  
  // Base radius from photo count with sub-linear scaling
  const baseRadius = Math.pow(photoCount, params.clusterSizing.photoCountExp);
  
  // Apply multiplier
  const radius = baseRadius * params.clusterSizing.radiusMult;
  
  return radius;
}
```

**Expand to Fill:**

After initial radius calculation, expand all clusters proportionally until they nearly touch or reach canvas bounds.

```javascript
function expandClustersToFill(clusters, canvasSize, params) {
  const maxIterations = 50;
  const expansionFactor = 1.05;
  
  for (let i = 0; i < maxIterations; i++) {
    // Check if expansion would cause overlap
    let canExpand = true;
    
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        if (ellipsesWouldOverlap(clusters[a], clusters[b], expansionFactor, params)) {
          canExpand = false;
          break;
        }
      }
      if (!canExpand) break;
    }
    
    if (!canExpand) break;
    
    // Expand all
    for (const cluster of clusters) {
      cluster.radius *= expansionFactor;
    }
  }
}
```

**Ellipse Overlap Check:**

```javascript
function ellipsesWouldOverlap(clusterA, clusterB, expansionFactor, params) {
  const radiusA = clusterA.radius * expansionFactor;
  const radiusB = clusterB.radius * expansionFactor;
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  // Distance between centers
  const dx = clusterB.canvasPos.x - clusterA.canvasPos.x;
  const dy = clusterB.canvasPos.y - clusterA.canvasPos.y;
  
  // Normalize distance by ellipse dimensions
  // For two ellipses to not overlap, the normalized distance should be > 2
  // This is an approximation; exact ellipse-ellipse intersection is complex
  const normalizedDist = Math.sqrt(
    (dx / (radiusA + radiusB)) ** 2 + 
    (dy / ((radiusA + radiusB) * ellipseMult)) ** 2
  );
  
  return normalizedDist < 1.0;
}
```

---

### Phase 3: Map Sizing

**Calculate map region to exactly fit all cluster ellipses:**

```javascript
function calculateMapSize(clusters, params) {
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const cluster of clusters) {
    const { x, y } = cluster.canvasPos;
    const r = cluster.radius;
    
    // Ellipse extents
    const ellipseWidth = r;
    const ellipseHeight = r * ellipseMult;
    
    minX = Math.min(minX, x - ellipseWidth);
    maxX = Math.max(maxX, x + ellipseWidth);
    minY = Math.min(minY, y - ellipseHeight);
    maxY = Math.max(maxY, y + ellipseHeight);
  }
  
  // Add small padding (5%)
  const padding = 0.05;
  const width = (maxX - minX) * (1 + padding * 2);
  const height = (maxY - minY) * (1 + padding * 2);
  
  // Apply multiplier
  const finalWidth = width * params.mapSizing.sizeMult;
  const finalHeight = height * params.mapSizing.sizeMult;
  
  return {
    x: minX - (finalWidth - (maxX - minX)) / 2,
    y: minY - (finalHeight - (maxY - minY)) / 2,
    width: finalWidth,
    height: finalHeight
  };
}
```

---

### Phase 4: Photo Size Calculation

```javascript
function calculatePhotoSizes(mapRect, params) {
  const mapArea = mapRect.width * mapRect.height;
  
  const heroArea = mapArea * params.photoSizing.heroSizeRatio;
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
  // area = h * aspectRatio * h = h² * aspectRatio
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
function placeHeroPhotos(clusters, photoSizes, params, rng) {
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
    
    // Place at cluster center
    placements.push({
      photo: heroPhoto,
      x: cluster.canvasPos.x,
      y: cluster.canvasPos.y,
      width,
      height,
      rotation: 0,  // Heroes get minimal/no rotation initially
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

**Core Algorithm:**

```javascript
function edgeSnapPlacement(clusters, photoSizes, params, rng) {
  const allPlacements = [];
  
  for (const cluster of clusters) {
    let consecutiveFailures = 0;
    let photosPlacedAfterHero = 0;
    
    for (const photo of cluster.remainingPhotos) {
      if (consecutiveFailures >= params.placement.attempts) {
        // Stop adding to this cluster
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
```

**Try Place Photo (Edge Snapping):**

```javascript
function tryPlacePhoto(photo, width, height, sizeCategory, cluster, params, rng) {
  // Get bounding box of all placed photos in this cluster
  const bbox = getClusterBoundingBox(cluster.placedPhotos);
  
  // Try multiple random positions along the bounding box edges
  for (let attempt = 0; attempt < params.placement.attempts; attempt++) {
    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = rng.int(0, 3);
    
    // Pick a random position along that edge
    const position = getRandomEdgePosition(bbox, edge, width, height, rng);
    
    // Check if this position is valid:
    // 1. Within cluster ellipse radius
    // 2. No overlap with existing photos
    
    if (!isWithinClusterEllipse(position.x, position.y, cluster, params)) {
      continue;
    }
    
    if (overlapsExistingPhotos(position, width, height, cluster.placedPhotos)) {
      continue;
    }
    
    // Valid placement found
    return {
      photo,
      x: position.x,
      y: position.y,
      width,
      height,
      rotation: 0,  // Applied later in post-processing
      clusterId: cluster.id,
      isHero: false,
      sizeCategory
    };
  }
  
  // Could not place
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
    case 0: // Top edge - photo goes above bbox
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.minY - halfH  // Flush against top
      };
    case 1: // Right edge - photo goes to the right
      return {
        x: bbox.maxX + halfW,  // Flush against right
        y: rng.range(bbox.minY, bbox.maxY)
      };
    case 2: // Bottom edge - photo goes below
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.maxY + halfH  // Flush against bottom
      };
    case 3: // Left edge - photo goes to the left
      return {
        x: bbox.minX - halfW,  // Flush against left
        y: rng.range(bbox.minY, bbox.maxY)
      };
  }
}

function isWithinClusterEllipse(x, y, cluster, params) {
  const dx = x - cluster.canvasPos.x;
  const dy = y - cluster.canvasPos.y;
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
    
    // Check rectangle intersection
    if (newRect.left < placedRect.right &&
        newRect.right > placedRect.left &&
        newRect.top < placedRect.bottom &&
        newRect.bottom > placedRect.top) {
      return true;  // Overlap detected
    }
  }
  
  return false;
}
```

---

### Phase 7: Post-Placement Adjustments

**Image Spread:**

Push photos away from cluster center by a multiplier.

```javascript
function applyImageSpread(placements, clusters, params) {
  const spreadMult = params.postProcess.imageSpread;
  
  if (spreadMult === 1.0) return;  // No change needed
  
  for (const placement of placements) {
    if (placement.isHero) continue;  // Don't move heroes
    
    const cluster = clusters.find(c => c.id === placement.clusterId);
    
    // Vector from cluster center to photo
    const dx = placement.x - cluster.canvasPos.x;
    const dy = placement.y - cluster.canvasPos.y;
    
    // Apply spread
    placement.x = cluster.canvasPos.x + dx * spreadMult;
    placement.y = cluster.canvasPos.y + dy * spreadMult;
  }
}
```

**Random Rotation:**

```javascript
function applyRandomRotation(placements, params, rng) {
  const range = params.postProcess.rotationRange;
  
  for (const placement of placements) {
    // Heroes get less rotation
    const maxRotation = placement.isHero ? range * 0.5 : range;
    placement.rotation = rng.range(-maxRotation, maxRotation);
  }
}
```

---

### Phase 8: Handle Cluster Overlap

After spread is applied, photos from different clusters may overlap. Delete overlapping photos one by one.

```javascript
function resolveInterClusterOverlap(placements) {
  let hadOverlap = true;
  
  while (hadOverlap) {
    hadOverlap = false;
    
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        
        // Only check photos from different clusters
        if (a.clusterId === b.clusterId) continue;
        
        if (photosOverlap(a, b)) {
          // Delete the lower-priority photo (non-hero, or smaller)
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
  // Simple AABB overlap check (ignoring rotation for simplicity)
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
  // Return true if b should be removed, false if a should be removed
  // Priority: heroes > medium > small
  if (a.isHero && !b.isHero) return true;
  if (!a.isHero && b.isHero) return false;
  if (a.sizeCategory === 'medium' && b.sizeCategory === 'small') return true;
  if (a.sizeCategory === 'small' && b.sizeCategory === 'medium') return false;
  
  // Same priority - remove the one placed later (higher index = b)
  return true;
}
```

---

### Phase 9: Handle Edge Overflow

```javascript
function handleEdgeOverflow(placements, canvasSize, params) {
  const mode = params.edgeOverflow.mode;
  const result = [];
  
  for (const placement of placements) {
    const overflow = getOverflow(placement, canvasSize);
    
    if (!overflow.any) {
      result.push(placement);
      continue;
    }
    
    switch (mode) {
      case 'crop':
        // Keep placement as-is; renderer will clip at canvas bounds
        placement.clipped = true;
        result.push(placement);
        break;
        
      case 'delete':
        // Don't include in result
        break;
        
      case 'shift':
        // Move photo inward until fully visible
        shiftInward(placement, canvasSize);
        result.push(placement);
        break;
    }
  }
  
  return result;
}

function getOverflow(placement, canvasSize) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;
  
  return {
    left: placement.x - halfW < 0,
    right: placement.x + halfW > canvasSize.width,
    top: placement.y - halfH < 0,
    bottom: placement.y + halfH > canvasSize.height,
    any: (placement.x - halfW < 0) ||
         (placement.x + halfW > canvasSize.width) ||
         (placement.y - halfH < 0) ||
         (placement.y + halfH > canvasSize.height)
  };
}

function shiftInward(placement, canvasSize) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;
  
  // Clamp position so photo is fully within canvas
  placement.x = Math.max(halfW, Math.min(canvasSize.width - halfW, placement.x));
  placement.y = Math.max(halfH, Math.min(canvasSize.height - halfH, placement.y));
}
```

---

### Phase 10: Render

```javascript
async function renderCollage(canvas, clusters, placements, mapRect, config) {
  const ctx = canvas.getContext('2d');
  
  // 1. Clear canvas
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Render map background
  const mapCanvas = await renderMapSnapshot(
    clusters, 
    mapRect.width, 
    mapRect.height,
    config.mapStyle || 'street'
  );
  ctx.drawImage(mapCanvas, mapRect.x, mapRect.y);
  
  // 3. Sort placements for draw order
  // Non-heroes first (underneath), then heroes (on top)
  // Within each group, larger photos first (underneath smaller)
  placements.sort((a, b) => {
    if (a.isHero && !b.isHero) return 1;
    if (!a.isHero && b.isHero) return -1;
    return (b.width * b.height) - (a.width * a.height);
  });
  
  // 4. Draw photos
  for (const placement of placements) {
    drawPhoto(ctx, placement, canvas);
  }
}

function drawPhoto(ctx, placement, canvas) {
  ctx.save();
  
  // Handle clipping for 'crop' mode
  if (placement.clipped) {
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
  }
  
  // Move to photo center
  ctx.translate(placement.x, placement.y);
  
  // Apply rotation
  ctx.rotate(placement.rotation * Math.PI / 180);
  
  // Draw photo centered at origin
  ctx.drawImage(
    placement.photo.img,
    -placement.width / 2,
    -placement.height / 2,
    placement.width,
    placement.height
  );
  
  ctx.restore();
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
│       └── edgeSnap.js        ← NEW: This algorithm
└── lib/
    ├── exif.js
    └── leaflet/
```

---

## UI Controls

### HTML Additions

```html
<!-- Canvas Settings -->
<div class="control-section">
  <h3>Canvas</h3>
  <div class="control-group">
    <label>Aspect Ratio (H:W): <span id="aspectRatioValue">2.17</span></label>
    <input type="range" id="aspectRatio" min="1.0" max="3.0" step="0.01" value="2.17">
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

<!-- Map Sizing -->
<div class="control-section">
  <h3>Map Sizing</h3>
  
  <div class="control-group">
    <label>Map Size Multiplier: <span id="mapSizeMultValue">1.0</span></label>
    <input type="range" id="mapSizeMult" min="0.1" max="1.5" step="0.05" value="1.0">
  </div>
</div>

<!-- Photo Sizing -->
<div class="control-section">
  <h3>Photo Sizing</h3>
  
  <div class="control-group">
    <label>Hero Size (% of map): <span id="heroSizeValue">10</span>%</label>
    <input type="range" id="heroSize" min="1" max="50" step="1" value="10">
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

### Cluster Ellipses

```javascript
function drawClusterEllipses(ctx, clusters, params) {
  const ellipseMult = params.clusterSizing.ellipseMult;
  
  for (const cluster of clusters) {
    ctx.save();
    ctx.translate(cluster.canvasPos.x, cluster.canvasPos.y);
    
    // Draw ellipse
    ctx.beginPath();
    ctx.ellipse(
      0, 0,                           // center
      cluster.radius,                 // radiusX
      cluster.radius * ellipseMult,   // radiusY (taller)
      0,                              // rotation
      0, Math.PI * 2                  // full ellipse
    );
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
  }
}
```

### Bounding Boxes

```javascript
function drawBoundingBoxes(ctx, clusters) {
  for (const cluster of clusters) {
    if (!cluster.placedPhotos || cluster.placedPhotos.length === 0) continue;
    
    const bbox = getClusterBoundingBox(cluster.placedPhotos);
    
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      bbox.minX,
      bbox.minY,
      bbox.maxX - bbox.minX,
      bbox.maxY - bbox.minY
    );
  }
}
```

### Photo Outlines

```javascript
function drawPhotoOutlines(ctx, placements) {
  for (const p of placements) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation * Math.PI / 180);
    
    ctx.strokeStyle = p.isHero ? 'gold' : 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = p.isHero ? 3 : 1;
    ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
    
    ctx.restore();
  }
}
```

---

## Return Value

The algorithm returns comprehensive data for debugging and stats:

```javascript
{
  placements: Placement[],
  mapRect: { x, y, width, height },
  clusters: [
    {
      id,
      canvasPos: { x, y },
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

### Core Functionality
- [ ] Canvas renders at 2.17:1 ratio
- [ ] Clusters form portrait ellipses (taller than wide)
- [ ] Map size fits clusters exactly (with multiplier)
- [ ] Hero photos placed at cluster centers
- [ ] Edge snapping places photos flush against existing
- [ ] Photos don't overlap within a cluster
- [ ] Photos stop being added after 10 consecutive failures
- [ ] Image spread pushes photos outward from center
- [ ] Rotation applied to all photos
- [ ] Inter-cluster overlap resolved by deletion
- [ ] Edge overflow handled by selected mode

### Parameters
- [ ] cluster_ellipse_mult changes ellipse shape
- [ ] cluster_radius_photo_count_exp affects radius scaling
- [ ] cluster_radius_mult scales all radiuses
- [ ] map_size_mult scales map
- [ ] hero_image_size_ratio changes hero size
- [ ] size_step_ratio changes medium/small relative sizes
- [ ] Probability sliders affect medium/small distribution
- [ ] image_spread pushes photos outward
- [ ] rotation_range affects rotation amount
- [ ] edge_overflow_mode changes overflow behavior

### Edge Cases
- [ ] Single cluster (all photos in one location)
- [ ] Many clusters (10+)
- [ ] Few photos (3-5)
- [ ] Many photos (50+)
- [ ] Clusters very close together
- [ ] Clusters at canvas edges
- [ ] All photos same aspect ratio
- [ ] Mixed portrait/landscape photos

---

## Summary of Key Differences from v2

| Aspect | v2 (Anchored Scatter) | v3 (Edge Snap) |
|--------|----------------------|----------------|
| Canvas ratio | 1:1 (square) | 2.17:1 (iPhone portrait) |
| Cluster shape | Circular | Portrait ellipse |
| Map sizing | Percentage-based | Content-driven (fits clusters) |
| Placement method | Random with rejection | Edge snapping (flush) |
| Overlap handling | Max % threshold | Zero overlap (flush placement) |
| Spread | N/A | Post-placement adjustment |
| Photo sizes | Continuous variation | Discrete tiers (hero/medium/small) |

---

**Document Version:** 1.0  
**Algorithm Name:** Edge Snap Layout (v3)  
**Purpose:** Complete specification for Claude Code implementation
