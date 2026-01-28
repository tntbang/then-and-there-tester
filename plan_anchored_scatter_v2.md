# Anchored Scatter v2 — Algorithm Update

This document updates the Anchored Scatter algorithm from `plan.md` with improved radius calculation, overlap constraints, and space utilization.

---

## Problems with v1

1. **Too much empty map space** — Fixed radiuses don't adapt to photo count or canvas usage
2. **Photo pile-ups** — Small clusters become unreadable stacks of overlapping photos
3. **Wasted canvas** — Clusters don't expand to fill available space
4. **Lost photos** — Overlapping centers means you can't see photos underneath

---

## Key Changes in v2

| Aspect | v1 | v2 |
|--------|----|----|
| Radius calculation | Fixed min/max | √(photoCount) scaling, expand to fill |
| Cluster spacing | Arbitrary | Calculated to prevent overlap |
| Photo placement | Random within radius | Random with 10% max overlap constraint |
| Fallback | None (photos pile up) | Golden angle spiral |
| Map sizing | Fixed 50% | Adaptive based on photo count |

---

## New Parameters

Add these to the UI control panel:

```html
<!-- Cluster Sizing -->
<div class="control-section">
  <h3>Cluster Sizing</h3>
  
  <div class="control-group">
    <label>Radius Exponent: <span id="radiusExponentValue">0.5</span></label>
    <input type="range" id="radiusExponent" min="0.2" max="1.0" step="0.1" value="0.5">
    <small>Lower = tighter clusters, Higher = bigger spread</small>
  </div>
  
  <div class="control-group">
    <label>Cluster Gap: <span id="clusterGapValue">20</span>px</label>
    <input type="range" id="clusterGap" min="0" max="50" step="5" value="20">
  </div>
  
  <div class="control-group">
    <label>
      <input type="checkbox" id="expandToFill" checked>
      Expand clusters to fill space
    </label>
  </div>
</div>

<!-- Photo Placement -->
<div class="control-section">
  <h3>Photo Placement</h3>
  
  <div class="control-group">
    <label>Max Overlap: <span id="maxOverlapValue">10</span>%</label>
    <input type="range" id="maxOverlap" min="0" max="30" step="5" value="10">
  </div>
  
  <div class="control-group">
    <label>
      <input type="checkbox" id="adaptiveMapSize" checked>
      Adaptive map size
    </label>
  </div>
</div>
```

---

## Updated Config Object

```javascript
{
  algorithm: 'anchoredScatter',
  clustering: {
    epsilon: 1.0,
    minPoints: 3,
    adaptive: true
  },
  layout: {
    mapAreaPercent: 50,        // May be overridden if adaptiveMapSize=true
    maxPhotos: 20,
    sizeVariation: 'slight',
    rotationRange: 10,
    overlapTolerance: 'none'   // Deprecated, use maxOverlapPercent
  },
  anchoredScatter: {           // NEW: algorithm-specific params
    radiusExponent: 0.5,
    clusterGap: 20,
    expandToFill: true,
    maxOverlapPercent: 0.10,
    placementAttempts: 50,
    heroScale: 1.5,
    heroOverlapPercent: 0.05,
    adaptiveMapSize: true,
    useSpiralFallback: true
  },
  seed: 4821
}
```

---

## Full Algorithm: Anchored Scatter v2

### File: `algorithms/anchoredScatter.js`

```javascript
import { SeededRandom, clamp, dist, lerp } from '../utils.js';

/**
 * Anchored Scatter v2
 * 
 * Hero photos anchor at cluster pins.
 * Scatter photos radiate outward with controlled overlap.
 * Cluster radiuses scale with sqrt(photoCount) and expand to fill space.
 */
export function anchoredScatterLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const config = {
    radiusExponent: params.anchoredScatter?.radiusExponent ?? 0.5,
    clusterGap: params.anchoredScatter?.clusterGap ?? 20,
    expandToFill: params.anchoredScatter?.expandToFill ?? true,
    maxOverlapPercent: params.anchoredScatter?.maxOverlapPercent ?? 0.10,
    placementAttempts: params.anchoredScatter?.placementAttempts ?? 50,
    heroScale: params.anchoredScatter?.heroScale ?? 1.5,
    heroOverlapPercent: params.anchoredScatter?.heroOverlapPercent ?? 0.05,
    useSpiralFallback: params.anchoredScatter?.useSpiralFallback ?? true,
    minRadius: canvasSize.width * 0.05,
    maxRadius: canvasSize.width * 0.35
  };

  const placements = [];
  const skippedPhotos = [];

  // ═══════════════════════════════════════════════════════════════
  // PHASE 0: CALCULATE ADAPTIVE MAP SIZE
  // ═══════════════════════════════════════════════════════════════
  
  let effectiveMapRect = { ...mapRect };
  
  if (params.anchoredScatter?.adaptiveMapSize) {
    const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
    let mapPercent;
    
    if (totalPhotos > 30) {
      mapPercent = 0.30;
    } else if (totalPhotos > 20) {
      mapPercent = 0.35;
    } else if (totalPhotos > 10) {
      mapPercent = 0.40;
    } else {
      mapPercent = 0.45;
    }
    
    const mapWidth = canvasSize.width * mapPercent;
    const mapHeight = canvasSize.height * mapPercent;
    
    effectiveMapRect = {
      x: (canvasSize.width - mapWidth) / 2,
      y: (canvasSize.height - mapHeight) / 2,
      width: mapWidth,
      height: mapHeight
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: CONVERT GEO COORDINATES TO CANVAS
  // ═══════════════════════════════════════════════════════════════
  
  const geoBounds = calculateGeoBounds(clusters);
  
  for (const cluster of clusters) {
    cluster.canvasPos = geoToCanvas(
      cluster.centroid.lat,
      cluster.centroid.lon,
      geoBounds,
      effectiveMapRect
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: CALCULATE CLUSTER RADIUSES
  // ═══════════════════════════════════════════════════════════════
  
  // 2.1 Calculate raw radius ratios using exponent scaling
  for (const cluster of clusters) {
    cluster.rawRatio = Math.pow(cluster.photos.length, config.radiusExponent);
  }
  
  const totalRatio = clusters.reduce((sum, c) => sum + c.rawRatio, 0);
  
  // 2.2 Calculate initial radiuses proportionally
  // Available space = canvas area not occupied by map (simplified to linear dimension)
  const availableLinear = Math.min(canvasSize.width, canvasSize.height) * 0.8;
  
  for (const cluster of clusters) {
    cluster.radius = (availableLinear / totalRatio) * cluster.rawRatio;
  }
  
  // 2.3 If expandToFill, iteratively grow radiuses until they almost touch
  if (config.expandToFill && clusters.length > 1) {
    expandClustersToFill(clusters, config.clusterGap, config.maxRadius);
  }
  
  // 2.4 Shrink radiuses if any pair overlaps
  shrinkOverlappingClusters(clusters, config.clusterGap, 100);
  
  // 2.5 Apply min/max constraints
  for (const cluster of clusters) {
    cluster.radius = clamp(cluster.radius, config.minRadius, config.maxRadius);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: ALLOCATE PHOTOS PER CLUSTER
  // ═══════════════════════════════════════════════════════════════
  
  const maxPhotos = params.layout?.maxPhotos ?? 20;
  const allocations = allocatePhotos(clusters, maxPhotos);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: SELECT AND SCORE PHOTOS
  // ═══════════════════════════════════════════════════════════════
  
  for (const cluster of clusters) {
    // Score photos
    const scored = cluster.photos.map(photo => ({
      photo,
      score: scorePhoto(photo)
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Select top N
    const allocation = allocations.get(cluster.id);
    cluster.selectedPhotos = scored.slice(0, allocation).map(s => s.photo);
    
    // First photo is hero
    cluster.heroPhoto = cluster.selectedPhotos[0];
    cluster.scatterPhotos = cluster.selectedPhotos.slice(1);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: CALCULATE PHOTO SIZES
  // ═══════════════════════════════════════════════════════════════
  
  const baseSize = calculateBasePhotoSize(clusters, canvasSize, params.layout?.sizeVariation);
  const heroSize = baseSize * config.heroScale;
  
  const sizes = {
    small: baseSize * 0.7,
    medium: baseSize * 1.0,
    large: baseSize * 1.3
  };

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: PLACE HERO PHOTOS
  // ═══════════════════════════════════════════════════════════════
  
  for (const cluster of clusters) {
    if (!cluster.heroPhoto) continue;
    
    const aspectRatio = cluster.heroPhoto.width / cluster.heroPhoto.height;
    let width, height;
    
    if (aspectRatio > 1) {
      width = heroSize;
      height = heroSize / aspectRatio;
    } else {
      height = heroSize;
      width = heroSize * aspectRatio;
    }
    
    placements.push({
      photo: cluster.heroPhoto,
      x: cluster.canvasPos.x,
      y: cluster.canvasPos.y,
      width,
      height,
      rotation: rng.range(-5, 5),
      clusterId: cluster.id,
      isHero: true
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: PLACE SCATTER PHOTOS WITH OVERLAP CONSTRAINT
  // ═══════════════════════════════════════════════════════════════
  
  for (const cluster of clusters) {
    for (const photo of cluster.scatterPhotos) {
      const placed = placePhotoWithConstraint(
        photo,
        cluster,
        placements,
        sizes,
        config,
        params.layout?.rotationRange ?? 10,
        rng
      );
      
      if (!placed) {
        skippedPhotos.push({ photo, cluster });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 8: FALLBACK - PLACE SKIPPED PHOTOS USING SPIRAL
  // ═══════════════════════════════════════════════════════════════
  
  if (config.useSpiralFallback && skippedPhotos.length > 0) {
    placeSpiralFallback(
      skippedPhotos,
      placements,
      sizes,
      config,
      params.layout?.rotationRange ?? 10,
      rng
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 9: SORT FOR DRAW ORDER (heroes on top)
  // ═══════════════════════════════════════════════════════════════
  
  placements.sort((a, b) => {
    // Non-heroes first (drawn underneath)
    if (a.isHero && !b.isHero) return 1;
    if (!a.isHero && b.isHero) return -1;
    // Among non-heroes, larger photos first (underneath smaller ones)
    return (b.width * b.height) - (a.width * a.height);
  });

  // ═══════════════════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════════════════
  
  return {
    placements,
    effectiveMapRect,
    clusterRadiuses: clusters.map(c => ({ id: c.id, radius: c.radius })),
    skippedCount: skippedPhotos.length,
    stats: {
      totalPhotos: clusters.reduce((sum, c) => sum + c.selectedPhotos.length, 0),
      placedPhotos: placements.length,
      skippedPhotos: skippedPhotos.length
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert lat/lon to canvas coordinates
 */
function geoToCanvas(lat, lon, geoBounds, mapRect) {
  // Handle single point (no span)
  const latSpan = geoBounds.maxLat - geoBounds.minLat || 0.01;
  const lonSpan = geoBounds.maxLon - geoBounds.minLon || 0.01;
  
  const normalX = (lon - geoBounds.minLon) / lonSpan;
  const normalY = (geoBounds.maxLat - lat) / latSpan; // flip Y axis
  
  return {
    x: mapRect.x + normalX * mapRect.width,
    y: mapRect.y + normalY * mapRect.height
  };
}

/**
 * Calculate geographic bounds from clusters
 */
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

/**
 * Expand cluster radiuses until they almost touch
 */
function expandClustersToFill(clusters, gap, maxRadius) {
  const expansionFactor = 1.05; // Grow by 5% each iteration
  const maxIterations = 50;
  
  for (let i = 0; i < maxIterations; i++) {
    // Check if any pair would overlap after expansion
    let canExpand = true;
    
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const distance = dist(clusters[a].canvasPos, clusters[b].canvasPos);
        const combinedRadius = (clusters[a].radius + clusters[b].radius) * expansionFactor + gap;
        
        if (combinedRadius >= distance) {
          canExpand = false;
          break;
        }
      }
      if (!canExpand) break;
    }
    
    if (!canExpand) break;
    
    // Check max radius constraint
    const wouldExceedMax = clusters.some(c => c.radius * expansionFactor > maxRadius);
    if (wouldExceedMax) break;
    
    // Expand all clusters
    for (const cluster of clusters) {
      cluster.radius *= expansionFactor;
    }
  }
}

/**
 * Shrink clusters that overlap
 */
function shrinkOverlappingClusters(clusters, gap, maxIterations) {
  for (let iter = 0; iter < maxIterations; iter++) {
    let hadCollision = false;
    
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const distance = dist(clusters[a].canvasPos, clusters[b].canvasPos);
        const combinedRadius = clusters[a].radius + clusters[b].radius + gap;
        
        if (combinedRadius > distance && distance > 0) {
          // Shrink proportionally
          const shrinkFactor = (distance - gap) / (clusters[a].radius + clusters[b].radius);
          clusters[a].radius *= shrinkFactor;
          clusters[b].radius *= shrinkFactor;
          hadCollision = true;
        }
      }
    }
    
    if (!hadCollision) break;
  }
}

/**
 * Allocate photo counts per cluster proportionally
 */
function allocatePhotos(clusters, maxTotal) {
  const allocations = new Map();
  const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
  
  let allocated = 0;
  
  for (const cluster of clusters) {
    const proportion = cluster.photos.length / totalPhotos;
    let count = Math.round(proportion * maxTotal);
    
    // Constraints
    count = Math.max(count, 2); // Minimum 2 per cluster
    count = Math.min(count, Math.floor(maxTotal / 2)); // Max 50% in one cluster
    count = Math.min(count, cluster.photos.length); // Can't exceed available
    
    allocations.set(cluster.id, count);
    allocated += count;
  }
  
  // Adjust if we over/under allocated
  // (Simple approach: scale all proportionally)
  if (allocated !== maxTotal) {
    const scale = maxTotal / allocated;
    for (const [id, count] of allocations) {
      allocations.set(id, Math.max(2, Math.round(count * scale)));
    }
  }
  
  return allocations;
}

/**
 * Score a photo for selection priority
 */
function scorePhoto(photo) {
  let score = 0;
  
  // Faces are valuable
  if (photo.hasFaces) {
    score += 40;
  }
  
  // Quality score (if available from EXIF or estimation)
  score += (photo.quality ?? 0.5) * 60;
  
  // Slight randomness to break ties
  score += Math.random() * 5;
  
  return score;
}

/**
 * Calculate base photo size based on cluster radiuses and variation setting
 */
function calculateBasePhotoSize(clusters, canvasSize, sizeVariation) {
  // Average radius
  const avgRadius = clusters.reduce((sum, c) => sum + c.radius, 0) / clusters.length;
  
  // Base size is fraction of average radius
  let baseSize = avgRadius * 0.4;
  
  // Clamp to reasonable range
  const minSize = canvasSize.width * 0.04;
  const maxSize = canvasSize.width * 0.12;
  
  return clamp(baseSize, minSize, maxSize);
}

/**
 * Attempt to place a photo with overlap constraint
 */
function placePhotoWithConstraint(photo, cluster, existingPlacements, sizes, config, rotationRange, rng) {
  const sizeCategory = pickSizeCategory(rng);
  const baseSize = sizes[sizeCategory];
  
  // Calculate actual dimensions preserving aspect ratio
  const aspectRatio = photo.width / photo.height;
  let width, height;
  
  if (aspectRatio > 1) {
    width = baseSize;
    height = baseSize / aspectRatio;
  } else {
    height = baseSize;
    width = baseSize * aspectRatio;
  }
  
  const heroSize = sizes.medium * config.heroScale;
  const minDistance = heroSize * 0.5; // Don't place too close to hero center
  
  for (let attempt = 0; attempt < config.placementAttempts; attempt++) {
    // Generate random position within cluster radius
    const angle = rng.range(0, Math.PI * 2);
    const distance = rng.range(minDistance, cluster.radius);
    
    const x = cluster.canvasPos.x + Math.cos(angle) * distance;
    const y = cluster.canvasPos.y + Math.sin(angle) * distance;
    
    // Create candidate placement
    const candidate = { x, y, width, height };
    
    // Check overlap with all existing placements
    let maxOverlap = 0;
    
    for (const existing of existingPlacements) {
      const overlap = calculateOverlapPercent(candidate, existing);
      maxOverlap = Math.max(maxOverlap, overlap);
      
      // Early exit if already over threshold
      if (maxOverlap > config.maxOverlapPercent) break;
    }
    
    // Valid position found
    if (maxOverlap <= config.maxOverlapPercent) {
      existingPlacements.push({
        photo,
        x,
        y,
        width,
        height,
        rotation: rng.range(-rotationRange, rotationRange),
        clusterId: cluster.id,
        isHero: false
      });
      return true;
    }
  }
  
  // Could not find valid position
  return false;
}

/**
 * Pick size category based on distribution
 */
function pickSizeCategory(rng) {
  const roll = rng.next();
  
  // 60% medium, 25% small, 15% large
  if (roll < 0.25) return 'small';
  if (roll < 0.85) return 'medium';
  return 'large';
}

/**
 * Calculate overlap percentage between two photo placements
 * Returns overlap as fraction of the smaller photo's area
 */
function calculateOverlapPercent(photoA, photoB) {
  // Treat as axis-aligned rectangles (ignore rotation for performance)
  const rectA = {
    left: photoA.x - photoA.width / 2,
    right: photoA.x + photoA.width / 2,
    top: photoA.y - photoA.height / 2,
    bottom: photoA.y + photoA.height / 2
  };
  
  const rectB = {
    left: photoB.x - photoB.width / 2,
    right: photoB.x + photoB.width / 2,
    top: photoB.y - photoB.height / 2,
    bottom: photoB.y + photoB.height / 2
  };
  
  // Calculate intersection
  const overlapWidth = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
  const overlapHeight = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
  const overlapArea = overlapWidth * overlapHeight;
  
  if (overlapArea === 0) return 0;
  
  // Return as fraction of smaller photo
  const areaA = photoA.width * photoA.height;
  const areaB = photoB.width * photoB.height;
  const smallerArea = Math.min(areaA, areaB);
  
  return overlapArea / smallerArea;
}

/**
 * Place skipped photos using golden angle spiral
 */
function placeSpiralFallback(skippedPhotos, existingPlacements, sizes, config, rotationRange, rng) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
  
  for (let i = 0; i < skippedPhotos.length; i++) {
    const { photo, cluster } = skippedPhotos[i];
    
    const sizeCategory = pickSizeCategory(rng);
    const baseSize = sizes[sizeCategory];
    
    const aspectRatio = photo.width / photo.height;
    let width, height;
    
    if (aspectRatio > 1) {
      width = baseSize;
      height = baseSize / aspectRatio;
    } else {
      height = baseSize;
      width = baseSize * aspectRatio;
    }
    
    // Spiral position
    const angle = i * goldenAngle;
    const spiralRadius = cluster.radius * 0.3 + (i * baseSize * 0.5);
    
    // Clamp to cluster radius
    const effectiveRadius = Math.min(spiralRadius, cluster.radius * 0.95);
    
    const x = cluster.canvasPos.x + Math.cos(angle) * effectiveRadius;
    const y = cluster.canvasPos.y + Math.sin(angle) * effectiveRadius;
    
    existingPlacements.push({
      photo,
      x,
      y,
      width,
      height,
      rotation: rng.range(-rotationRange, rotationRange),
      clusterId: cluster.id,
      isHero: false,
      isFallback: true
    });
  }
}
```

---

## Updated Return Value

The algorithm now returns additional data for debugging and status display:

```javascript
{
  placements: Placement[],
  effectiveMapRect: { x, y, width, height },  // May differ from input if adaptive
  clusterRadiuses: [{ id, radius }],          // For debug overlay
  skippedCount: number,                        // Photos that couldn't fit
  stats: {
    totalPhotos: number,
    placedPhotos: number,
    skippedPhotos: number
  }
}
```

---

## Status Bar Update

Show placement stats in the UI:

```html
<div id="status" class="status-bar">
  <span id="statusText">Ready</span>
  <span id="placementStats"></span>
</div>
```

```javascript
// After running algorithm
const result = anchoredScatterLayout(...);

document.getElementById('placementStats').textContent = 
  `Placed ${result.stats.placedPhotos} of ${result.stats.totalPhotos} photos` +
  (result.stats.skippedPhotos > 0 ? ` (${result.stats.skippedPhotos} in fallback)` : '');
```

---

## Debug Overlays for v2

Add these new debug visualizations:

### Cluster Radius Circles

```javascript
function drawClusterRadiuses(ctx, clusters) {
  for (const cluster of clusters) {
    ctx.beginPath();
    ctx.arc(cluster.canvasPos.x, cluster.canvasPos.y, cluster.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label with photo count
    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${cluster.photos.length} photos`,
      cluster.canvasPos.x - 25,
      cluster.canvasPos.y - cluster.radius - 5
    );
  }
}
```

### Overlap Heatmap

```javascript
function drawOverlapHeatmap(ctx, placements) {
  for (const placement of placements) {
    let totalOverlap = 0;
    
    for (const other of placements) {
      if (other === placement) continue;
      totalOverlap += calculateOverlapPercent(placement, other);
    }
    
    // Color based on overlap amount
    const intensity = Math.min(totalOverlap * 5, 1); // Scale for visibility
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.3})`;
    ctx.fillRect(
      placement.x - placement.width / 2,
      placement.y - placement.height / 2,
      placement.width,
      placement.height
    );
  }
}
```

### Fallback Indicator

```javascript
function drawFallbackIndicators(ctx, placements) {
  for (const placement of placements) {
    if (placement.isFallback) {
      // Draw small warning triangle
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      ctx.moveTo(placement.x, placement.y - 10);
      ctx.lineTo(placement.x - 8, placement.y + 5);
      ctx.lineTo(placement.x + 8, placement.y + 5);
      ctx.closePath();
      ctx.fill();
    }
  }
}
```

Add checkboxes for these:

```html
<label><input type="checkbox" id="debugRadiuses"> Cluster radiuses</label>
<label><input type="checkbox" id="debugOverlap"> Overlap heatmap</label>
<label><input type="checkbox" id="debugFallback"> Fallback markers</label>
```

---

## Integration with collageRenderer.js

Update the main render function to use the new return value:

```javascript
export async function renderCollage(canvas, clusters, config, rng) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  // Clear
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, width, height);
  
  // Initial map rect (may be adjusted by algorithm)
  const mapAreaPercent = config.layout.mapAreaPercent / 100;
  const mapSize = Math.min(width, height) * mapAreaPercent;
  const initialMapRect = {
    x: (width - mapSize) / 2,
    y: (height - mapSize) / 2,
    width: mapSize,
    height: mapSize
  };
  
  // Run algorithm
  const result = runAlgorithm(
    config.algorithm,
    getAllPhotos(clusters),
    clusters,
    config,
    { width, height },
    initialMapRect,
    rng
  );
  
  // Use effective map rect (may be smaller if adaptive)
  const mapRect = result.effectiveMapRect || initialMapRect;
  
  // Render map
  const mapCanvas = await renderMapSnapshot(clusters, mapRect.width, mapRect.height, config.mapStyle);
  ctx.drawImage(mapCanvas, mapRect.x, mapRect.y);
  
  // Draw photos
  for (const placement of result.placements) {
    drawPhoto(ctx, placement);
  }
  
  // Debug overlays
  if (config.debug?.showRadiuses) {
    drawClusterRadiuses(ctx, clusters);
  }
  if (config.debug?.showOverlap) {
    drawOverlapHeatmap(ctx, result.placements);
  }
  if (config.debug?.showFallback) {
    drawFallbackIndicators(ctx, result.placements);
  }
  
  return result.stats;
}
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `algorithms/anchoredScatter.js` | Complete rewrite with v2 algorithm |
| `index.html` | New control groups for cluster sizing and placement |
| `style.css` | Styling for new controls |
| `main.js` | Wire new parameters, display stats |
| `collageRenderer.js` | Handle effectiveMapRect, new debug overlays |
| `utils.js` | Add `dist()` function if not present |

---

## Testing Checklist

- [ ] Radius scales with sqrt(photoCount)
- [ ] Clusters expand to fill available space
- [ ] Clusters don't overlap (respect clusterGap)
- [ ] Photos don't exceed maxOverlapPercent
- [ ] Skipped photos use spiral fallback
- [ ] Heroes appear on top
- [ ] Adaptive map size shrinks map when many photos
- [ ] Stats show placed vs skipped count
- [ ] Debug overlays render correctly
- [ ] Same seed produces same output

---

## Parameter Tuning Guide

| If you see... | Try adjusting... |
|---------------|------------------|
| Clusters too tight | Increase radiusExponent (e.g., 0.7) |
| Clusters too spread | Decrease radiusExponent (e.g., 0.3) |
| Photos piling up | Decrease maxOverlapPercent (e.g., 5%) |
| Too few photos placed | Increase maxOverlapPercent or placementAttempts |
| Too much empty space | Enable expandToFill, decrease clusterGap |
| Map too dominant | Enable adaptiveMapSize, or manually reduce mapAreaPercent |

---

**Document Version:** 1.0  
**Purpose:** Update plan.md with Anchored Scatter v2 algorithm  
**Replaces:** Original anchoredScatter.js specification in plan.md
