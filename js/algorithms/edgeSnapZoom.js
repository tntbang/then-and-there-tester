/**
 * edgeSnapZoom.js - Edge Snap Layout Algorithm v3.1 with Viewport Zoom
 *
 * Key features:
 * - Master canvas (2× output) with viewport zoom
 * - Portrait elliptical clusters (2.17:1 height:width ratio)
 * - Edge snapping placement (photos attach flush to existing photos)
 * - Zoom affects everything proportionally (map + photos)
 */

import { clamp } from '../utils.js';

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
 * Map cluster centroids to master canvas coordinates
 */
function mapClustersToMasterCanvas(clusters, masterCanvas) {
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
    mapWidth = masterCanvas.width * 0.9;
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

  // Map each cluster centroid to master canvas coordinates
  for (const cluster of clusters) {
    const normalX = (cluster.centroid.lon - paddedBounds.minLon) /
                    (paddedBounds.maxLon - paddedBounds.minLon);
    const normalY = (paddedBounds.maxLat - cluster.centroid.lat) /
                    (paddedBounds.maxLat - paddedBounds.minLat);

    cluster.masterPos = {
      x: offsetX + normalX * mapWidth,
      y: offsetY + normalY * mapHeight
    };
  }

  return {
    geoBounds: paddedBounds,
    canvasRegion: { x: offsetX, y: offsetY, width: mapWidth, height: mapHeight }
  };
}

/**
 * Score a photo for hero selection priority
 */
function scorePhoto(photo, rng) {
  let score = 0;
  const pixels = photo.width * photo.height;
  score += Math.min(pixels / 1000000, 20);
  score += rng.range(0, 10);
  return score;
}

/**
 * Convert target area to photo dimensions preserving aspect ratio
 */
function areaToDimensions(targetArea, photo) {
  const aspectRatio = photo.width / photo.height;
  const height = Math.sqrt(targetArea / aspectRatio);
  const width = height * aspectRatio;
  return { width, height };
}

/**
 * Check if two ellipses would overlap
 * In portrait mode: Y-axis is stretched by ellipseMult
 * In landscape mode: X-axis is stretched by ellipseMult
 */
function ellipsesWouldOverlap(clusterA, clusterB, expansionFactor, ellipseMult, isLandscape) {
  const radiusA = clusterA.radius * expansionFactor;
  const radiusB = clusterB.radius * expansionFactor;

  const dx = clusterB.masterPos.x - clusterA.masterPos.x;
  const dy = clusterB.masterPos.y - clusterA.masterPos.y;

  let normalizedDist;
  if (isLandscape) {
    // Landscape: X-axis stretched
    normalizedDist = Math.sqrt(
      (dx / ((radiusA + radiusB) * ellipseMult)) ** 2 +
      (dy / (radiusA + radiusB)) ** 2
    );
  } else {
    // Portrait: Y-axis stretched
    normalizedDist = Math.sqrt(
      (dx / (radiusA + radiusB)) ** 2 +
      (dy / ((radiusA + radiusB) * ellipseMult)) ** 2
    );
  }

  return normalizedDist < 1.0;
}

/**
 * Expand cluster radiuses until they nearly touch
 */
function expandClustersToFill(clusters, masterCanvas, ellipseMult, maxRadius, isLandscape) {
  const maxIterations = 50;
  const expansionFactor = 1.05;

  for (let i = 0; i < maxIterations; i++) {
    let canExpand = true;

    // Check if expansion would cause overlap between clusters
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        if (ellipsesWouldOverlap(clusters[a], clusters[b], expansionFactor, ellipseMult, isLandscape)) {
          canExpand = false;
          break;
        }
      }
      if (!canExpand) break;
    }

    if (!canExpand) break;

    // Check if any cluster would exceed max radius
    if (clusters.some(c => c.radius * expansionFactor > maxRadius)) {
      break;
    }

    // Check if expansion would push clusters outside master canvas
    for (const cluster of clusters) {
      const newRadius = cluster.radius * expansionFactor;
      const ellipseExtent = newRadius * ellipseMult;

      let outOfBounds;
      if (isLandscape) {
        // Landscape: X-axis stretched
        outOfBounds = cluster.masterPos.x - ellipseExtent < 0 ||
                      cluster.masterPos.x + ellipseExtent > masterCanvas.width ||
                      cluster.masterPos.y - newRadius < 0 ||
                      cluster.masterPos.y + newRadius > masterCanvas.height;
      } else {
        // Portrait: Y-axis stretched
        outOfBounds = cluster.masterPos.x - newRadius < 0 ||
                      cluster.masterPos.x + newRadius > masterCanvas.width ||
                      cluster.masterPos.y - ellipseExtent < 0 ||
                      cluster.masterPos.y + ellipseExtent > masterCanvas.height;
      }

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
 * Calculate photo sizes based on master canvas area
 */
function calculatePhotoSizes(masterCanvas, config) {
  const masterArea = masterCanvas.width * masterCanvas.height;

  const heroArea = masterArea * config.heroSizeRatio;
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
    case 0: // Top edge
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.minY - halfH
      };
    case 1: // Right edge
      return {
        x: bbox.maxX + halfW,
        y: rng.range(bbox.minY, bbox.maxY)
      };
    case 2: // Bottom edge
      return {
        x: rng.range(bbox.minX, bbox.maxX),
        y: bbox.maxY + halfH
      };
    case 3: // Left edge
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
function isWithinClusterEllipse(x, y, cluster, ellipseMult, isLandscape) {
  const dx = x - cluster.masterPos.x;
  const dy = y - cluster.masterPos.y;
  const r = cluster.radius;

  let normalizedDist;
  if (isLandscape) {
    // Landscape: X-axis stretched
    normalizedDist = (dx * dx) / ((r * ellipseMult) * (r * ellipseMult)) + (dy * dy) / (r * r);
  } else {
    // Portrait: Y-axis stretched
    normalizedDist = (dx * dx) / (r * r) + (dy * dy) / ((r * ellipseMult) * (r * ellipseMult));
  }

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
  const mediumProb = isEarly ? config.mediumProbabilityEarly : config.mediumProbabilityLate;
  return rng.next() < mediumProb ? 'medium' : 'small';
}

/**
 * Try to place a photo using edge snapping
 */
function tryPlacePhoto(photo, width, height, sizeCategory, cluster, config, rng, isLandscape) {
  const bbox = getClusterBoundingBox(cluster.placedPhotos);

  for (let attempt = 0; attempt < config.placementAttempts; attempt++) {
    const edge = Math.floor(rng.next() * 4);
    const position = getRandomEdgePosition(bbox, edge, width, height, rng);

    if (!isWithinClusterEllipse(position.x, position.y, cluster, config.ellipseMult, isLandscape)) {
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

/**
 * Apply image spread - push photos away from cluster center
 */
function applyImageSpread(placements, clusters, spreadMult) {
  if (spreadMult === 1.0) return;

  for (const placement of placements) {
    if (placement.isHero) continue;

    const cluster = clusters.find(c => c.id === placement.clusterId);
    if (!cluster) continue;

    const dx = placement.x - cluster.masterPos.x;
    const dy = placement.y - cluster.masterPos.y;

    placement.x = cluster.masterPos.x + dx * spreadMult;
    placement.y = cluster.masterPos.y + dy * spreadMult;
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
  return true;
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
 * Calculate viewport based on map size multiplier
 */
function calculateViewport(masterCanvas, finalCanvas, mapSizeMult) {
  // Viewport size in master canvas coordinates
  // mapSizeMult = 1.0 -> viewport equals final canvas (at master scale)
  // mapSizeMult > 1.0 -> viewport is larger (zoomed out)
  // mapSizeMult < 1.0 -> viewport is smaller (zoomed in)

  const viewportWidth = finalCanvas.width * mapSizeMult * 2; // ×2 because master is 2× final
  const viewportHeight = finalCanvas.height * mapSizeMult * 2;

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

/**
 * Check for viewport overflow
 */
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

/**
 * Shift photo inward until fully visible in viewport
 */
function shiftIntoViewport(placement, viewport) {
  const halfW = placement.width / 2;
  const halfH = placement.height / 2;

  const minX = viewport.x + halfW;
  const maxX = viewport.x + viewport.width - halfW;
  const minY = viewport.y + halfH;
  const maxY = viewport.y + viewport.height - halfH;

  placement.x = clamp(placement.x, minX, maxX);
  placement.y = clamp(placement.y, minY, maxY);
}

/**
 * Handle photos extending beyond viewport bounds
 */
function handleViewportOverflow(placements, viewport, mode) {
  const result = [];
  const stats = { deleted: 0, cropped: 0, shifted: 0 };

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
        stats.cropped++;
        break;

      case 'delete':
        if (overflow.complete) {
          stats.deleted++;
        } else {
          placement.clipped = true;
          result.push(placement);
          stats.cropped++;
        }
        break;

      case 'shift':
        shiftIntoViewport(placement, viewport);
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
 * Edge Snap Zoom Layout Algorithm v3.1
 */
export function edgeSnapZoomLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const config = {
    // Master canvas scale
    masterScale: params.masterScale ?? 2,

    // Cluster sizing
    ellipseMult: params.ellipseMult ?? 2.17,
    photoCountExp: params.photoCountExp ?? 0.5,
    radiusMult: params.radiusMult ?? 1.0,
    maxRadiusPercent: params.maxRadiusPercent ?? 0.40,

    // Zoom
    mapSizeMult: params.mapSizeMult ?? 1.0,

    // Photo sizing
    heroSizeRatio: params.heroSizeRatio ?? 0.05,
    sizeStepRatio: params.sizeStepRatio ?? 0.25,

    // Placement
    mediumProbabilityEarly: params.mediumProbabilityEarly ?? 0.75,
    mediumProbabilityLate: params.mediumProbabilityLate ?? 0.25,
    placementAttempts: params.placementAttempts ?? 10,

    // Post-processing
    imageSpread: params.imageSpread ?? 1.0,
    rotationRange: params.rotationRange ?? 10,

    // Orientation
    orientation: params.orientation ?? 'portrait'

    // Edge overflow
    edgeOverflowMode: params.edgeOverflowMode ?? 'crop'
  };

  const placements = [];

  if (clusters.length === 0) return placements;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: SETUP MASTER CANVAS
  // ═══════════════════════════════════════════════════════════════

  const masterCanvas = {
    width: canvasSize.width * config.masterScale,
    height: canvasSize.height * config.masterScale
  };

  const finalCanvas = {
    width: canvasSize.width,
    height: canvasSize.height
  };

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: GEO TO MASTER CANVAS MAPPING
  // ═══════════════════════════════════════════════════════════════

  const mapRegion = mapClustersToMasterCanvas(clusters, masterCanvas);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: CLUSTER SIZING
  // ═══════════════════════════════════════════════════════════════

  const isLandscape = config.orientation === 'landscape';
  const minRadius = Math.min(masterCanvas.width, masterCanvas.height) * 0.05;
  const maxRadius = Math.min(masterCanvas.width, masterCanvas.height) * config.maxRadiusPercent;

  for (const cluster of clusters) {
    const baseRadius = Math.pow(cluster.photos.length, config.photoCountExp);
    cluster.radius = baseRadius * config.radiusMult * 50;
    cluster.radius = clamp(cluster.radius, minRadius, maxRadius);
  }

  // Expand clusters to fill available space
  if (clusters.length > 1) {
    expandClustersToFill(clusters, masterCanvas, config.ellipseMult, maxRadius, isLandscape);
  } else if (clusters.length === 1) {
    // For single cluster, use slightly less than maxRadius to leave margin
    const singleClusterMax = config.maxRadiusPercent * 0.875;  // ~35% when maxRadius is 40%
    if (isLandscape) {
      clusters[0].radius = Math.min(
        masterCanvas.width / config.ellipseMult * singleClusterMax,
        masterCanvas.height * singleClusterMax,
        maxRadius
      );
    } else {
      clusters[0].radius = Math.min(
        masterCanvas.width * singleClusterMax,
        masterCanvas.height / config.ellipseMult * singleClusterMax,
        maxRadius
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: CALCULATE PHOTO SIZES (relative to master canvas)
  // ═══════════════════════════════════════════════════════════════

  const photoSizes = calculatePhotoSizes(masterCanvas, config);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: PLACE HERO PHOTOS
  // ═══════════════════════════════════════════════════════════════

  for (const cluster of clusters) {
    const scored = cluster.photos.map(photo => ({
      photo,
      score: scorePhoto(photo, rng)
    }));
    scored.sort((a, b) => b.score - a.score);

    const heroPhoto = scored[0].photo;
    cluster.heroPhoto = heroPhoto;
    cluster.remainingPhotos = scored.slice(1).map(s => s.photo);

    const { width, height } = areaToDimensions(photoSizes.hero, heroPhoto);

    const heroPlacement = {
      photo: heroPhoto,
      x: cluster.masterPos.x,
      y: cluster.masterPos.y,
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
        photo, width, height, sizeCategory, cluster, config, rng, isLandscape
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
  // PHASE 9: CALCULATE VIEWPORT
  // ═══════════════════════════════════════════════════════════════

  const viewport = calculateViewport(masterCanvas, finalCanvas, config.mapSizeMult);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 10: HANDLE VIEWPORT OVERFLOW
  // ═══════════════════════════════════════════════════════════════

  const overflowResult = handleViewportOverflow(placements, viewport, config.edgeOverflowMode);
  const finalPlacements = overflowResult.placements;

  // ═══════════════════════════════════════════════════════════════
  // PHASE 11: SORT FOR DRAW ORDER
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
    x: c.masterPos.x,
    y: c.masterPos.y,
    radius: c.radius,
    ellipseMult: config.ellipseMult,
    isLandscape: isLandscape,
    photoCount: c.photos.length,
    placedCount: c.placedPhotos ? c.placedPhotos.length : 0
  }));

  finalPlacements.masterCanvas = masterCanvas;
  finalPlacements.viewport = viewport;
  finalPlacements.mapRegion = mapRegion;

  finalPlacements.stats = {
    totalPhotos: clusters.reduce((sum, c) => sum + c.photos.length, 0),
    placedPhotos: finalPlacements.length,
    skippedPlacement: totalSkipped,
    deletedOverlap,
    deletedOverflow: overflowResult.stats.deleted,
    croppedOverflow: overflowResult.stats.cropped,
    shiftedOverflow: overflowResult.stats.shifted
  };

  console.log(`Edge Snap Zoom v3.1: placed ${finalPlacements.length} photos`);
  console.log(`  Master canvas: ${masterCanvas.width}×${masterCanvas.height}`);
  console.log(`  Viewport: ${viewport.width.toFixed(0)}×${viewport.height.toFixed(0)} at (${viewport.x.toFixed(0)}, ${viewport.y.toFixed(0)})`);
  console.log(`  Scale: ${viewport.scaleX.toFixed(2)}`);
  console.log(`  Skipped (placement): ${totalSkipped}`);
  console.log(`  Deleted (overlap): ${deletedOverlap}`);
  console.log(`  Overflow: deleted=${overflowResult.stats.deleted}, cropped=${overflowResult.stats.cropped}, shifted=${overflowResult.stats.shifted}`);

  return finalPlacements;
}
