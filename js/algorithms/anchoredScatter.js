/**
 * anchoredScatter.js - Anchored Scatter v2 layout algorithm
 *
 * Hero photos anchor at cluster pins.
 * Scatter photos radiate outward with controlled overlap.
 * Cluster radiuses scale with sqrt(photoCount) and expand to fill space.
 */

import { clamp, dist, shuffleArray, mapRange } from '../utils.js';

/**
 * Convert lat/lon to canvas coordinates with inset margin
 * The margin ensures cluster centers stay away from edges so photos don't get cut off
 */
function geoToCanvas(lat, lon, geoBounds, canvasSize, margin) {
  const latSpan = geoBounds.maxLat - geoBounds.minLat || 0.01;
  const lonSpan = geoBounds.maxLon - geoBounds.minLon || 0.01;

  const normalX = (lon - geoBounds.minLon) / lonSpan;
  const normalY = (geoBounds.maxLat - lat) / latSpan;

  // Map to canvas with margin on all sides
  const usableWidth = canvasSize.width - margin * 2;
  const usableHeight = canvasSize.height - margin * 2;

  return {
    x: margin + normalX * usableWidth,
    y: margin + normalY * usableHeight
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
  const expansionFactor = 1.05;
  const maxIterations = 50;

  for (let i = 0; i < maxIterations; i++) {
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

    const wouldExceedMax = clusters.some(c => c.radius * expansionFactor > maxRadius);
    if (wouldExceedMax) break;

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

    count = Math.max(count, 1);
    count = Math.min(count, Math.floor(maxTotal / 2));
    count = Math.min(count, cluster.photos.length);

    allocations.set(cluster.id, count);
    allocated += count;
  }

  if (allocated > maxTotal) {
    const scale = maxTotal / allocated;
    for (const [id, count] of allocations) {
      allocations.set(id, Math.max(1, Math.round(count * scale)));
    }
  }

  return allocations;
}

/**
 * Score a photo for selection priority
 */
function scorePhoto(photo, rng) {
  let score = 0;

  // Higher resolution is better
  const pixels = photo.width * photo.height;
  score += Math.min(pixels / 1000000, 20);

  // Slight randomness to break ties
  score += rng.range(0, 10);

  return score;
}

/**
 * Calculate base photo size based on cluster radiuses
 */
function calculateBasePhotoSize(clusters, canvasSize, photoSizeParam) {
  const avgRadius = clusters.reduce((sum, c) => sum + c.radius, 0) / clusters.length;
  let baseSize = avgRadius * 0.35;

  const minSize = canvasSize.width * 0.04;
  const maxSize = canvasSize.width * 0.12;

  baseSize = clamp(baseSize, minSize, maxSize);

  return baseSize * (photoSizeParam / 100);
}

/**
 * Pick size category based on distribution
 */
function pickSizeCategory(rng, sizeVariation) {
  if (sizeVariation === 'uniform') return 'medium';

  const roll = rng.next();

  if (sizeVariation === 'dramatic') {
    if (roll < 0.30) return 'small';
    if (roll < 0.70) return 'medium';
    return 'large';
  }

  // slight (default)
  if (roll < 0.20) return 'small';
  if (roll < 0.85) return 'medium';
  return 'large';
}

/**
 * Calculate overlap percentage between two photo placements
 */
function calculateOverlapPercent(photoA, photoB) {
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

  const overlapWidth = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
  const overlapHeight = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
  const overlapArea = overlapWidth * overlapHeight;

  if (overlapArea === 0) return 0;

  const areaA = photoA.width * photoA.height;
  const areaB = photoB.width * photoB.height;
  const smallerArea = Math.min(areaA, areaB);

  return overlapArea / smallerArea;
}

/**
 * Attempt to place a photo with overlap constraint
 */
function placePhotoWithConstraint(photo, cluster, existingPlacements, sizes, config, rotationRange, sizeVariation, rng) {
  const sizeCategory = pickSizeCategory(rng, sizeVariation);
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

  const heroSize = sizes.medium * config.heroScale;
  const minDistance = heroSize * 0.4;

  for (let attempt = 0; attempt < config.placementAttempts; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const distance = rng.range(minDistance, cluster.radius * 0.95);

    const x = cluster.canvasPos.x + Math.cos(angle) * distance;
    const y = cluster.canvasPos.y + Math.sin(angle) * distance;

    const candidate = { x, y, width, height };

    let maxOverlap = 0;

    for (const existing of existingPlacements) {
      const overlap = calculateOverlapPercent(candidate, existing);
      maxOverlap = Math.max(maxOverlap, overlap);

      if (maxOverlap > config.maxOverlapPercent) break;
    }

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

  return false;
}

/**
 * Place skipped photos using golden angle spiral
 */
function placeSpiralFallback(skippedPhotos, existingPlacements, sizes, config, rotationRange, sizeVariation, rng) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < skippedPhotos.length; i++) {
    const { photo, cluster } = skippedPhotos[i];

    const sizeCategory = pickSizeCategory(rng, sizeVariation);
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

    const angle = i * goldenAngle;
    const spiralRadius = cluster.radius * 0.3 + (i * baseSize * 0.4);
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

/**
 * Calculate the bounding box of all photo placements (including their full extent with rotation)
 */
function calculatePlacementBounds(placements, padding = 10) {
  if (placements.length === 0) return null;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const p of placements) {
    // Account for rotation by using the diagonal as worst-case extent
    const diagonal = Math.sqrt(p.width * p.width + p.height * p.height) / 2;
    const borderSize = Math.min(p.width, p.height) * 0.04; // Polaroid border

    const extent = diagonal + borderSize + padding;

    minX = Math.min(minX, p.x - extent);
    maxX = Math.max(maxX, p.x + extent);
    minY = Math.min(minY, p.y - extent);
    maxY = Math.max(maxY, p.y + extent);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Anchored Scatter v2 Layout Algorithm
 */
export function anchoredScatterLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const config = {
    radiusExponent: params.radiusExponent ?? 0.5,
    clusterGap: params.clusterGap ?? 20,
    expandToFill: params.expandToFill ?? true,
    maxOverlapPercent: (params.maxOverlap ?? 10) / 100,
    placementAttempts: params.placementAttempts ?? 50,
    heroScale: params.heroScale ?? 1.5,
    useSpiralFallback: params.useSpiralFallback ?? true,
    minRadius: canvasSize.width * 0.08,
    maxRadius: canvasSize.width * 0.40,
    edgeMargin: canvasSize.width * 0.15  // Keep cluster centers away from edges
  };

  const placements = [];
  const skippedPhotos = [];

  if (clusters.length === 0) return placements;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: CONVERT GEO COORDINATES TO CANVAS (with edge margin)
  // ═══════════════════════════════════════════════════════════════

  const geoBounds = calculateGeoBounds(clusters);

  for (const cluster of clusters) {
    cluster.canvasPos = geoToCanvas(
      cluster.centroid.lat,
      cluster.centroid.lon,
      geoBounds,
      canvasSize,
      config.edgeMargin
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: CALCULATE CLUSTER RADIUSES
  // ═══════════════════════════════════════════════════════════════

  for (const cluster of clusters) {
    cluster.rawRatio = Math.pow(cluster.photos.length, config.radiusExponent);
  }

  const totalRatio = clusters.reduce((sum, c) => sum + c.rawRatio, 0);
  const availableLinear = Math.min(canvasSize.width, canvasSize.height) * 0.7;

  for (const cluster of clusters) {
    cluster.radius = (availableLinear / Math.max(totalRatio, 1)) * cluster.rawRatio;
    cluster.radius = Math.max(cluster.radius, config.minRadius);
  }

  if (config.expandToFill && clusters.length > 1) {
    expandClustersToFill(clusters, config.clusterGap, config.maxRadius);
  }

  shrinkOverlappingClusters(clusters, config.clusterGap, 100);

  for (const cluster of clusters) {
    cluster.radius = clamp(cluster.radius, config.minRadius, config.maxRadius);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2B: CONSTRAIN RADIUSES TO KEEP PHOTOS IN BOUNDS
  // ═══════════════════════════════════════════════════════════════

  // Shrink cluster radiuses if they would cause photos to extend beyond canvas
  const photoMargin = 20; // Extra padding at canvas edge
  for (const cluster of clusters) {
    const maxRadiusLeft = cluster.canvasPos.x - photoMargin;
    const maxRadiusRight = canvasSize.width - cluster.canvasPos.x - photoMargin;
    const maxRadiusTop = cluster.canvasPos.y - photoMargin;
    const maxRadiusBottom = canvasSize.height - cluster.canvasPos.y - photoMargin;

    const maxAllowedRadius = Math.min(maxRadiusLeft, maxRadiusRight, maxRadiusTop, maxRadiusBottom);
    cluster.radius = Math.min(cluster.radius, maxAllowedRadius);
    cluster.radius = Math.max(cluster.radius, config.minRadius * 0.5); // Don't go too small
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: ALLOCATE PHOTOS PER CLUSTER
  // ═══════════════════════════════════════════════════════════════

  const maxPhotos = params.maxPhotos ?? 20;
  const allocations = allocatePhotos(clusters, maxPhotos);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: SELECT AND SCORE PHOTOS
  // ═══════════════════════════════════════════════════════════════

  for (const cluster of clusters) {
    const scored = cluster.photos.map(photo => ({
      photo,
      score: scorePhoto(photo, rng)
    }));

    scored.sort((a, b) => b.score - a.score);

    const allocation = allocations.get(cluster.id) || 1;
    cluster.selectedPhotos = scored.slice(0, allocation).map(s => s.photo);

    cluster.heroPhoto = cluster.selectedPhotos[0];
    cluster.scatterPhotos = cluster.selectedPhotos.slice(1);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: CALCULATE PHOTO SIZES
  // ═══════════════════════════════════════════════════════════════

  const photoSizeParam = params.photoSize ?? 100;
  const baseSize = calculateBasePhotoSize(clusters, canvasSize, photoSizeParam);
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

  const rotationRange = params.rotationRange ?? 10;
  const sizeVariation = params.sizeVariation ?? 'slight';

  for (const cluster of clusters) {
    for (const photo of cluster.scatterPhotos) {
      const placed = placePhotoWithConstraint(
        photo,
        cluster,
        placements,
        sizes,
        config,
        rotationRange,
        sizeVariation,
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
      rotationRange,
      sizeVariation,
      rng
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 9: SORT FOR DRAW ORDER (heroes on top)
  // ═══════════════════════════════════════════════════════════════

  placements.sort((a, b) => {
    if (a.isHero && !b.isHero) return 1;
    if (!a.isHero && b.isHero) return -1;
    return (b.width * b.height) - (a.width * a.height);
  });

  // Store cluster info for debug overlays
  placements.clusterInfo = clusters.map(c => ({
    id: c.id,
    x: c.canvasPos.x,
    y: c.canvasPos.y,
    radius: c.radius,
    photoCount: c.photos.length
  }));

  // Calculate bounds of all photo placements for map sizing
  const photoBounds = calculatePlacementBounds(placements);
  placements.photoBounds = photoBounds;

  // Store geo bounds for map rendering
  placements.geoBounds = geoBounds;

  placements.stats = {
    totalSelected: clusters.reduce((sum, c) => sum + c.selectedPhotos.length, 0),
    placed: placements.length,
    skipped: skippedPhotos.length
  };

  console.log(`Anchored Scatter v2: placed ${placements.length} photos, ${skippedPhotos.length} in fallback`);
  if (photoBounds) {
    console.log(`Photo bounds: (${photoBounds.minX.toFixed(0)}, ${photoBounds.minY.toFixed(0)}) to (${photoBounds.maxX.toFixed(0)}, ${photoBounds.maxY.toFixed(0)})`);
  }

  return placements;
}
