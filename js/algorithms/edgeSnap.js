/**
 * edgeSnap.js - Edge Snap Layout Algorithm v3
 *
 * Key features:
 * - Portrait elliptical clusters (2.17:1 height:width ratio)
 * - Content-driven map sizing
 * - Edge snapping placement (photos attach flush to existing photos)
 * - Staged placement with controlled spread
 */

import { clamp, dist } from '../utils.js';

/**
 * Convert lat/lon to canvas coordinates
 */
function geoToCanvas(lat, lon, geoBounds, canvasSize, margin) {
  const latSpan = geoBounds.maxLat - geoBounds.minLat || 0.01;
  const lonSpan = geoBounds.maxLon - geoBounds.minLon || 0.01;

  const normalX = (lon - geoBounds.minLon) / lonSpan;
  const normalY = (geoBounds.maxLat - lat) / latSpan;

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
 * Score a photo for hero selection priority
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
 * Convert target area to photo dimensions preserving aspect ratio
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

/**
 * Check if two ellipses would overlap
 */
function ellipsesWouldOverlap(clusterA, clusterB, expansionFactor, ellipseMult) {
  const radiusA = clusterA.radius * expansionFactor;
  const radiusB = clusterB.radius * expansionFactor;

  const dx = clusterB.canvasPos.x - clusterA.canvasPos.x;
  const dy = clusterB.canvasPos.y - clusterA.canvasPos.y;

  // Normalized distance check for ellipses (portrait: Y-axis stretched)
  const normalizedDist = Math.sqrt(
    (dx / (radiusA + radiusB)) ** 2 +
    (dy / ((radiusA + radiusB) * ellipseMult)) ** 2
  );

  return normalizedDist < 1.0;
}

/**
 * Expand cluster radiuses until they nearly touch
 */
function expandClustersToFill(clusters, canvasSize, ellipseMult, maxRadius) {
  const maxIterations = 50;
  const expansionFactor = 1.05;

  for (let i = 0; i < maxIterations; i++) {
    let canExpand = true;

    // Check if expansion would cause overlap between clusters
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        if (ellipsesWouldOverlap(clusters[a], clusters[b], expansionFactor, ellipseMult)) {
          canExpand = false;
          break;
        }
      }
      if (!canExpand) break;
    }

    if (!canExpand) break;

    // Check if expansion would exceed max radius
    const wouldExceedMax = clusters.some(c => c.radius * expansionFactor > maxRadius);
    if (wouldExceedMax) break;

    // Check if expansion would push clusters outside canvas (portrait: Y-axis stretched)
    for (const cluster of clusters) {
      const newRadius = cluster.radius * expansionFactor;
      const ellipseExtent = newRadius * ellipseMult;

      const outOfBounds = cluster.canvasPos.x - newRadius < 0 ||
                          cluster.canvasPos.x + newRadius > canvasSize.width ||
                          cluster.canvasPos.y - ellipseExtent < 0 ||
                          cluster.canvasPos.y + ellipseExtent > canvasSize.height;

      if (outOfBounds) {
        canExpand = false;
        break;
      }
    }

    if (!canExpand) break;

    // Expand all clusters
    for (const cluster of clusters) {
      cluster.radius *= expansionFactor;
    }
  }
}

/**
 * Calculate map size to fit all cluster ellipses
 */
function calculateMapSize(clusters, ellipseMult, sizeMult) {
  if (clusters.length === 0) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

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

  // Add padding (5%)
  const padding = 0.05;
  const width = (maxX - minX) * (1 + padding * 2);
  const height = (maxY - minY) * (1 + padding * 2);

  // Apply multiplier
  const finalWidth = width * sizeMult;
  const finalHeight = height * sizeMult;

  return {
    x: minX - (finalWidth - (maxX - minX)) / 2,
    y: minY - (finalHeight - (maxY - minY)) / 2,
    width: finalWidth,
    height: finalHeight
  };
}

/**
 * Calculate photo sizes based on canvas area (independent of map zoom)
 */
function calculatePhotoSizes(canvasSize, config) {
  const canvasArea = canvasSize.width * canvasSize.height;

  const heroArea = canvasArea * config.heroSizeRatio;
  const mediumArea = heroArea * config.sizeStepRatio;
  const smallArea = mediumArea * config.sizeStepRatio;

  return {
    hero: heroArea,
    medium: mediumArea,
    small: smallArea
  };
}

/**
 * Get bounding box of placed photos
 */
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

/**
 * Get random position along a bounding box edge
 */
function getRandomEdgePosition(bbox, edge, photoWidth, photoHeight, rng) {
  const halfW = photoWidth / 2;
  const halfH = photoHeight / 2;

  switch (edge) {
    case 0: // Top edge - photo goes above bbox
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.minY - halfH
      };
    case 1: // Right edge - photo goes to the right
      return {
        x: bbox.maxX + halfW,
        y: rng.range(bbox.minY, bbox.maxY)
      };
    case 2: // Bottom edge - photo goes below
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.maxY + halfH
      };
    case 3: // Left edge - photo goes to the left
      return {
        x: bbox.minX - halfW,
        y: rng.range(bbox.minY, bbox.maxY)
      };
  }
  return { x: 0, y: 0 };
}

/**
 * Check if point is within cluster ellipse
 */
function isWithinClusterEllipse(x, y, cluster, ellipseMult) {
  const dx = x - cluster.canvasPos.x;
  const dy = y - cluster.canvasPos.y;
  const r = cluster.radius;

  // Ellipse equation: x²/a² + y²/b² ≤ 1
  // Portrait: a = r (width), b = r * ellipseMult (height stretched)
  const normalizedDist = (dx * dx) / (r * r) + (dy * dy) / ((r * ellipseMult) * (r * ellipseMult));

  return normalizedDist <= 1.0;
}

/**
 * Check if new photo overlaps existing photos
 */
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
      return true;
    }
  }

  return false;
}

/**
 * Pick size category based on placement progress
 */
function pickSizeCategory(photosPlacedAfterHero, config, rng) {
  const isEarly = photosPlacedAfterHero < 5;

  const mediumProb = isEarly
    ? config.mediumProbabilityEarly
    : config.mediumProbabilityLate;

  return rng.next() < mediumProb ? 'medium' : 'small';
}

/**
 * Try to place a photo using edge snapping
 */
function tryPlacePhoto(photo, width, height, sizeCategory, cluster, config, rng) {
  const bbox = getClusterBoundingBox(cluster.placedPhotos);

  for (let attempt = 0; attempt < config.placementAttempts; attempt++) {
    // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
    const edge = Math.floor(rng.next() * 4);

    const position = getRandomEdgePosition(bbox, edge, width, height, rng);

    // Check if within cluster ellipse
    if (!isWithinClusterEllipse(position.x, position.y, cluster, config.ellipseMult)) {
      continue;
    }

    // Check for overlap with existing photos
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
      rotation: 0,
      clusterId: cluster.id,
      isHero: false,
      sizeCategory
    };
  }

  return null;
}

/**
 * Apply image spread - push photos away from cluster center
 */
function applyImageSpread(placements, clusters, spreadMult) {
  if (spreadMult === 1.0) return;

  for (const placement of placements) {
    if (placement.isHero) continue;

    const cluster = clusters.find(c => c.id === placement.clusterId);
    if (!cluster) continue;

    const dx = placement.x - cluster.canvasPos.x;
    const dy = placement.y - cluster.canvasPos.y;

    placement.x = cluster.canvasPos.x + dx * spreadMult;
    placement.y = cluster.canvasPos.y + dy * spreadMult;
  }
}

/**
 * Apply random rotation to all placements
 */
function applyRandomRotation(placements, rotationRange, rng) {
  for (const placement of placements) {
    const maxRotation = placement.isHero ? rotationRange * 0.5 : rotationRange;
    placement.rotation = rng.range(-maxRotation, maxRotation);
  }
}

/**
 * Check if two photos overlap
 */
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

/**
 * Get removal priority (true = remove b, false = remove a)
 */
function getRemovalPriority(a, b) {
  if (a.isHero && !b.isHero) return true;
  if (!a.isHero && b.isHero) return false;
  if (a.sizeCategory === 'medium' && b.sizeCategory === 'small') return true;
  if (a.sizeCategory === 'small' && b.sizeCategory === 'medium') return false;
  return true; // Same priority - remove the later one
}

/**
 * Resolve overlaps between photos from different clusters
 */
function resolveInterClusterOverlap(placements) {
  let hadOverlap = true;
  let deletedCount = 0;

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
          deletedCount++;
          break;
        }
      }
      if (hadOverlap) break;
    }
  }

  return deletedCount;
}

/**
 * Check for canvas edge overflow
 */
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

/**
 * Shift photo inward until fully visible
 */
function shiftInward(placement, canvasSize) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;

  placement.x = clamp(placement.x, halfW, canvasSize.width - halfW);
  placement.y = clamp(placement.y, halfH, canvasSize.height - halfH);
}

/**
 * Handle photos extending beyond canvas bounds
 */
function handleEdgeOverflow(placements, canvasSize, mode) {
  const result = [];
  const stats = { deleted: 0, cropped: 0, shifted: 0 };

  for (const placement of placements) {
    const overflow = getOverflow(placement, canvasSize);

    if (!overflow.any) {
      result.push(placement);
      continue;
    }

    switch (mode) {
      case 'crop':
        placement.clipped = true;
        result.push(placement);
        stats.cropped++;
        break;

      case 'delete':
        stats.deleted++;
        break;

      case 'shift':
        shiftInward(placement, canvasSize);
        result.push(placement);
        stats.shifted++;
        break;

      default:
        result.push(placement);
    }
  }

  return { placements: result, stats };
}

/**
 * Edge Snap Layout Algorithm v3
 */
export function edgeSnapLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const config = {
    // Cluster sizing
    ellipseMult: params.ellipseMult ?? 2.17,
    photoCountExp: params.photoCountExp ?? 0.5,
    radiusMult: params.radiusMult ?? 1.0,
    maxRadiusPercent: params.maxRadiusPercent ?? 0.40,

    // Map sizing
    mapSizeMult: params.mapSizeMult ?? 1.0,

    // Photo sizing
    heroSizeRatio: params.heroSizeRatio ?? 0.10,
    sizeStepRatio: params.sizeStepRatio ?? 0.25,

    // Placement
    mediumProbabilityEarly: params.mediumProbabilityEarly ?? 0.75,
    mediumProbabilityLate: params.mediumProbabilityLate ?? 0.25,
    placementAttempts: params.placementAttempts ?? 10,

    // Post-processing
    imageSpread: params.imageSpread ?? 1.0,
    rotationRange: params.rotationRange ?? 10,

    // Edge overflow
    edgeOverflowMode: params.edgeOverflowMode ?? 'crop',

    // Limits
    minRadius: canvasSize.width * 0.05,
    maxRadius: Math.min(canvasSize.width, canvasSize.height) * (params.maxRadiusPercent ?? 0.40),
    edgeMargin: canvasSize.width * 0.1
  };

  const placements = [];

  if (clusters.length === 0) return placements;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: CONVERT GEO COORDINATES TO CANVAS
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
  // PHASE 2: CALCULATE CLUSTER RADIUSES (ELLIPTICAL)
  // ═══════════════════════════════════════════════════════════════

  for (const cluster of clusters) {
    const baseRadius = Math.pow(cluster.photos.length, config.photoCountExp);
    cluster.radius = baseRadius * config.radiusMult * 50; // Scale factor
    cluster.radius = clamp(cluster.radius, config.minRadius, config.maxRadius);
  }

  // Expand clusters to fill available space
  if (clusters.length > 1) {
    expandClustersToFill(clusters, canvasSize, config.ellipseMult, config.maxRadius);
  } else if (clusters.length === 1) {
    // Single cluster - expand to reasonable size (slightly less than maxRadius)
    // Portrait: constrained by width, and height / ellipseMult
    const singleClusterMax = config.maxRadiusPercent * 0.875;
    clusters[0].radius = Math.min(
      canvasSize.width * singleClusterMax,
      canvasSize.height / config.ellipseMult * singleClusterMax,
      config.maxRadius
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: CALCULATE MAP SIZE (content-driven) - for metadata only
  // ═══════════════════════════════════════════════════════════════

  const calculatedMapRect = calculateMapSize(clusters, config.ellipseMult, 1.0);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: CALCULATE PHOTO SIZES (based on canvas, not map zoom)
  // ═══════════════════════════════════════════════════════════════

  const photoSizes = calculatePhotoSizes(canvasSize, config);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: PLACE HERO PHOTOS
  // ═══════════════════════════════════════════════════════════════

  for (const cluster of clusters) {
    // Score and sort photos
    const scored = cluster.photos.map(photo => ({
      photo,
      score: scorePhoto(photo, rng)
    }));
    scored.sort((a, b) => b.score - a.score);

    const heroPhoto = scored[0].photo;
    cluster.heroPhoto = heroPhoto;
    cluster.remainingPhotos = scored.slice(1).map(s => s.photo);

    // Calculate hero dimensions
    const { width, height } = areaToDimensions(photoSizes.hero, heroPhoto);

    const heroPlacement = {
      photo: heroPhoto,
      x: cluster.canvasPos.x,
      y: cluster.canvasPos.y,
      width,
      height,
      rotation: 0,
      clusterId: cluster.id,
      isHero: true,
      sizeCategory: 'hero'
    };

    placements.push(heroPlacement);
    cluster.placedPhotos = [heroPlacement];
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: EDGE SNAP PLACEMENT
  // ═══════════════════════════════════════════════════════════════

  let totalSkipped = 0;

  for (const cluster of clusters) {
    let consecutiveFailures = 0;
    let photosPlacedAfterHero = 0;

    for (const photo of cluster.remainingPhotos) {
      if (consecutiveFailures >= config.placementAttempts) {
        totalSkipped += cluster.remainingPhotos.length - photosPlacedAfterHero;
        break;
      }

      const sizeCategory = pickSizeCategory(photosPlacedAfterHero, config, rng);
      const targetArea = photoSizes[sizeCategory];
      const { width, height } = areaToDimensions(targetArea, photo);

      const placement = tryPlacePhoto(
        photo,
        width,
        height,
        sizeCategory,
        cluster,
        config,
        rng
      );

      if (placement) {
        cluster.placedPhotos.push(placement);
        placements.push(placement);
        consecutiveFailures = 0;
        photosPlacedAfterHero++;
      } else {
        consecutiveFailures++;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: POST-PLACEMENT ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════

  applyImageSpread(placements, clusters, config.imageSpread);
  applyRandomRotation(placements, config.rotationRange, rng);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 8: HANDLE INTER-CLUSTER OVERLAP
  // ═══════════════════════════════════════════════════════════════

  const deletedOverlap = resolveInterClusterOverlap(placements);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 9: HANDLE EDGE OVERFLOW
  // ═══════════════════════════════════════════════════════════════

  const overflowResult = handleEdgeOverflow(placements, canvasSize, config.edgeOverflowMode);
  const finalPlacements = overflowResult.placements;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 10: SORT FOR DRAW ORDER (heroes last/on top)
  // ═══════════════════════════════════════════════════════════════

  finalPlacements.sort((a, b) => {
    if (a.isHero && !b.isHero) return 1;
    if (!a.isHero && b.isHero) return -1;
    return (b.width * b.height) - (a.width * a.height);
  });

  // ═══════════════════════════════════════════════════════════════
  // ATTACH METADATA
  // ═══════════════════════════════════════════════════════════════

  finalPlacements.clusterInfo = clusters.map(c => ({
    id: c.id,
    x: c.canvasPos.x,
    y: c.canvasPos.y,
    radius: c.radius,
    ellipseMult: config.ellipseMult,
    photoCount: c.photos.length,
    placedCount: c.placedPhotos ? c.placedPhotos.length : 0
  }));

  finalPlacements.mapRect = calculatedMapRect;

  finalPlacements.stats = {
    totalPhotos: clusters.reduce((sum, c) => sum + c.photos.length, 0),
    placedPhotos: finalPlacements.length,
    skippedPlacement: totalSkipped,
    deletedOverlap,
    deletedOverflow: overflowResult.stats.deleted,
    croppedOverflow: overflowResult.stats.cropped,
    shiftedOverflow: overflowResult.stats.shifted
  };

  console.log(`Edge Snap v3: placed ${finalPlacements.length} photos`);
  console.log(`  Skipped (placement): ${totalSkipped}`);
  console.log(`  Deleted (overlap): ${deletedOverlap}`);
  console.log(`  Overflow: deleted=${overflowResult.stats.deleted}, cropped=${overflowResult.stats.cropped}, shifted=${overflowResult.stats.shifted}`);

  return finalPlacements;
}
