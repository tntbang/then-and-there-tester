/**
 * mapRegions.js - Map Regions layout algorithm
 *
 * Divides canvas into 8 regions around the central map.
 * Photos are assigned to regions based on their cluster's
 * geographic direction from center.
 */

import { clamp, lerp, shuffleArray } from '../utils.js';

/**
 * Define the 8 placement regions around the map
 */
function defineRegions(mapRect, canvasSize) {
  const { x, y, width, height } = mapRect;
  const cw = canvasSize.width;
  const ch = canvasSize.height;

  return {
    NW: { x: 0, y: 0, w: x, h: y },
    TOP: { x: x, y: 0, w: width, h: y },
    NE: { x: x + width, y: 0, w: cw - x - width, h: y },
    LEFT: { x: 0, y: y, w: x, h: height },
    RIGHT: { x: x + width, y: y, w: cw - x - width, h: height },
    SW: { x: 0, y: y + height, w: x, h: ch - y - height },
    BOTTOM: { x: x, y: y + height, w: width, h: ch - y - height },
    SE: { x: x + width, y: y + height, w: cw - x - width, h: ch - y - height }
  };
}

/**
 * Calculate geographic center from all clusters
 */
function calculateGeoCenter(clusters) {
  if (clusters.length === 0) {
    return { lat: 0, lon: 0 };
  }

  let totalLat = 0, totalLon = 0;
  for (const cluster of clusters) {
    totalLat += cluster.centroid.lat;
    totalLon += cluster.centroid.lon;
  }

  return {
    lat: totalLat / clusters.length,
    lon: totalLon / clusters.length
  };
}

/**
 * Assign a cluster to a region based on geographic direction
 */
function assignClusterToRegion(cluster, geoCenter, regionCounts) {
  const { lat, lon } = cluster.centroid;
  const north = lat > geoCenter.lat;
  const south = lat < geoCenter.lat;
  const east = lon > geoCenter.lon;
  const west = lon < geoCenter.lon;

  // Determine primary region
  let region;
  if (north && west) region = 'NW';
  else if (north && east) region = 'NE';
  else if (south && west) region = 'SW';
  else if (south && east) region = 'SE';
  else if (north) region = 'TOP';
  else if (south) region = 'BOTTOM';
  else if (west) region = 'LEFT';
  else if (east) region = 'RIGHT';
  else {
    // Exact center - assign to region with fewest photos
    const sorted = Object.entries(regionCounts).sort((a, b) => a[1] - b[1]);
    region = sorted[0][0];
  }

  return region;
}

/**
 * Allocate photo counts per cluster based on proportion
 */
function allocatePhotoCounts(clusters, maxPhotos) {
  const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
  const allocations = [];

  let allocated = 0;
  for (const cluster of clusters) {
    const proportion = cluster.photos.length / totalPhotos;
    let count = Math.round(proportion * maxPhotos);
    count = clamp(count, 1, Math.ceil(maxPhotos / 2));
    allocations.push(count);
    allocated += count;
  }

  // Adjust to match maxPhotos exactly
  while (allocated > maxPhotos) {
    // Remove from largest allocation
    const maxIdx = allocations.indexOf(Math.max(...allocations));
    if (allocations[maxIdx] > 1) {
      allocations[maxIdx]--;
      allocated--;
    } else {
      break;
    }
  }

  while (allocated < maxPhotos && clusters.length > 0) {
    // Add to smallest allocation
    const minIdx = allocations.indexOf(Math.min(...allocations));
    allocations[minIdx]++;
    allocated++;
  }

  return allocations;
}

/**
 * Calculate base photo size for a region
 */
function calculateBaseSize(region, photoCount, canvasSize) {
  const regionArea = region.w * region.h;
  const targetCoverage = 0.6;
  const totalPhotoArea = regionArea * targetCoverage;
  const areaPerPhoto = totalPhotoArea / Math.max(photoCount, 1);
  const baseSize = Math.sqrt(areaPerPhoto);

  const minSize = canvasSize.width * 0.05;
  const maxSize = canvasSize.width * 0.15;

  return clamp(baseSize, minSize, maxSize);
}

/**
 * Get size multiplier based on variation setting
 */
function getSizeMultiplier(variation, rng) {
  const roll = rng.next();

  switch (variation) {
    case 'uniform':
      return 1.0;

    case 'slight':
      // 70% medium, 20% small, 10% large
      if (roll < 0.2) return 0.8;
      if (roll < 0.9) return 1.0;
      return 1.2;

    case 'dramatic':
      // 50% medium, 30% small, 20% large
      if (roll < 0.3) return 0.7;
      if (roll < 0.8) return 1.0;
      return 1.3;

    default:
      return 1.0;
  }
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(r1, r2, tolerance = 0) {
  const expand = tolerance;
  return !(
    r1.x + r1.w / 2 + expand < r2.x - r2.w / 2 - expand ||
    r1.x - r1.w / 2 - expand > r2.x + r2.w / 2 + expand ||
    r1.y + r1.h / 2 + expand < r2.y - r2.h / 2 - expand ||
    r1.y - r1.h / 2 - expand > r2.y + r2.h / 2 + expand
  );
}

/**
 * Calculate overlap amount between two rectangles
 */
function calculateOverlap(r1, r2) {
  const overlapX = Math.max(0,
    Math.min(r1.x + r1.w / 2, r2.x + r2.w / 2) -
    Math.max(r1.x - r1.w / 2, r2.x - r2.w / 2)
  );
  const overlapY = Math.max(0,
    Math.min(r1.y + r1.h / 2, r2.y + r2.h / 2) -
    Math.max(r1.y - r1.h / 2, r2.y - r2.h / 2)
  );
  return overlapX * overlapY;
}

/**
 * Resolve overlap by shifting photo away
 */
function resolveOverlap(placement, existing, maxOverlapPercent, region) {
  const newRect = { x: placement.x, y: placement.y, w: placement.width, h: placement.height };

  for (const other of existing) {
    const otherRect = { x: other.x, y: other.y, w: other.width, h: other.height };

    if (rectsOverlap(newRect, otherRect)) {
      const overlap = calculateOverlap(newRect, otherRect);
      const maxAllowed = placement.width * placement.height * maxOverlapPercent;

      if (overlap > maxAllowed) {
        // Push away from other photo
        const dx = newRect.x - otherRect.x;
        const dy = newRect.y - otherRect.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const pushX = (dx / dist) * (placement.width * 0.5);
        const pushY = (dy / dist) * (placement.height * 0.5);

        newRect.x = clamp(newRect.x + pushX, region.x + placement.width / 2, region.x + region.w - placement.width / 2);
        newRect.y = clamp(newRect.y + pushY, region.y + placement.height / 2, region.y + region.h - placement.height / 2);
      }
    }
  }

  return { x: newRect.x, y: newRect.y };
}

/**
 * Map Regions Layout Algorithm
 */
export function mapRegionsLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    sizeVariation = 'slight',
    rotationRange = 10,
    overlapTolerance = 'none'
  } = params;

  if (clusters.length === 0) {
    console.log('No clusters to place');
    return [];
  }

  // Define regions
  const regions = defineRegions(mapRect, canvasSize);
  const regionNames = Object.keys(regions);

  // Calculate geographic center
  const geoCenter = calculateGeoCenter(clusters);

  // Track photos per region for balancing
  const regionCounts = {};
  regionNames.forEach(r => regionCounts[r] = 0);

  // Assign clusters to regions
  const clusterRegions = [];
  for (const cluster of clusters) {
    const region = assignClusterToRegion(cluster, geoCenter, regionCounts);
    clusterRegions.push(region);
    regionCounts[region] += cluster.photos.length;
  }

  console.log('Cluster region assignments:', clusterRegions);

  // Allocate photo counts
  const allocations = allocatePhotoCounts(clusters, maxPhotos);

  // Map center for orbital pull
  const mapCenter = {
    x: canvasSize.width / 2,
    y: canvasSize.height / 2
  };

  // Determine overlap tolerance
  let maxOverlapPercent = 0;
  if (overlapTolerance === 'slight') maxOverlapPercent = 0.2;
  else if (overlapTolerance === 'aggressive') maxOverlapPercent = 1.0;

  // Build placements
  const placements = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const regionName = clusterRegions[i];
    const region = regions[regionName];
    const allocation = allocations[i];

    // Select photos (shuffled)
    const shuffled = shuffleArray(cluster.photos, rng);
    const selected = shuffled.slice(0, allocation);

    // Calculate base size for this region
    const baseSize = calculateBaseSize(region, allocation, canvasSize);

    for (const photo of selected) {
      // Calculate photo dimensions maintaining aspect ratio
      const aspectRatio = photo.width / photo.height;
      const sizeMultiplier = getSizeMultiplier(sizeVariation, rng);
      const size = baseSize * sizeMultiplier;

      let photoWidth, photoHeight;
      if (aspectRatio > 1) {
        photoWidth = size;
        photoHeight = size / aspectRatio;
      } else {
        photoHeight = size;
        photoWidth = size * aspectRatio;
      }

      // Random position within region
      const margin = Math.max(photoWidth, photoHeight) / 2;
      let x = rng.range(region.x + margin, region.x + region.w - margin);
      let y = rng.range(region.y + margin, region.y + region.h - margin);

      // Apply orbital pull toward map center (15%)
      x = lerp(x, mapCenter.x, 0.15);
      y = lerp(y, mapCenter.y, 0.15);

      // Clamp to region bounds
      x = clamp(x, region.x + photoWidth / 2, region.x + region.w - photoWidth / 2);
      y = clamp(y, region.y + photoHeight / 2, region.y + region.h - photoHeight / 2);

      // Create placement
      const placement = {
        photo,
        x,
        y,
        width: photoWidth,
        height: photoHeight,
        rotation: rng.range(-rotationRange, rotationRange),
        clusterId: cluster.id
      };

      // Resolve overlaps if needed
      if (overlapTolerance !== 'aggressive') {
        const resolved = resolveOverlap(placement, placements, maxOverlapPercent, region);
        placement.x = resolved.x;
        placement.y = resolved.y;
      }

      placements.push(placement);
    }
  }

  console.log(`Created ${placements.length} placements`);
  return placements;
}
