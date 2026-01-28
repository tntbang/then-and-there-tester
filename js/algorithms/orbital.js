/**
 * orbital.js - Orbital layout algorithm
 *
 * Photos orbit their cluster's center at varying distances.
 * Distance from center represents importance.
 */

import { clamp, shuffleArray, mapRange } from '../utils.js';

/**
 * Calculate where a cluster's pin should appear on the canvas
 * Maps geographic coordinates to canvas coordinates
 */
function geoToCanvas(lat, lon, geoBounds, mapRect) {
  const x = mapRange(lon, geoBounds.minLon, geoBounds.maxLon, mapRect.x, mapRect.x + mapRect.width);
  const y = mapRange(lat, geoBounds.maxLat, geoBounds.minLat, mapRect.y, mapRect.y + mapRect.height);
  return { x, y };
}

/**
 * Calculate geographic bounds from clusters with padding
 */
function calculateGeoBounds(clusters, padding = 0.2) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const cluster of clusters) {
    minLat = Math.min(minLat, cluster.bounds.south);
    maxLat = Math.max(maxLat, cluster.bounds.north);
    minLon = Math.min(minLon, cluster.bounds.west);
    maxLon = Math.max(maxLon, cluster.bounds.east);
  }

  // Add padding
  const latPad = (maxLat - minLat) * padding || 0.01;
  const lonPad = (maxLon - minLon) * padding || 0.01;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad
  };
}

/**
 * Orbital Layout Algorithm
 */
export function orbitalLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    photoSize = 100,
    orbitRadius = 100,
    sizeVariation = 'slight',
    rotationRange = 10
  } = params;

  if (clusters.length === 0) return [];

  const geoBounds = calculateGeoBounds(clusters);
  const placements = [];

  // Size multiplier from param (100 = 1.0)
  const sizeMultiplierBase = photoSize / 100;
  // Orbit multiplier from param (100 = 1.0)
  const orbitMultiplier = orbitRadius / 100;

  // Allocate photos proportionally
  const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
  let remaining = maxPhotos;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const proportion = cluster.photos.length / totalPhotos;
    const allocation = Math.max(1, Math.round(proportion * maxPhotos));
    const count = Math.min(allocation, remaining, cluster.photos.length);
    remaining -= count;

    // Get cluster center on canvas
    const pinPos = geoToCanvas(cluster.centroid.lat, cluster.centroid.lon, geoBounds, mapRect);

    // Select and shuffle photos
    const shuffled = shuffleArray(cluster.photos, rng);
    const selected = shuffled.slice(0, count);

    // Calculate orbital radius - distance to nearest edge or other cluster
    const distToEdges = [
      pinPos.x,
      canvasSize.width - pinPos.x,
      pinPos.y,
      canvasSize.height - pinPos.y
    ];
    const baseMaxRadius = Math.min(...distToEdges) * 0.8;
    const maxRadius = baseMaxRadius * orbitMultiplier;

    // Place photos in orbits
    for (let j = 0; j < selected.length; j++) {
      const photo = selected[j];

      // Orbital position - first photo closest to center
      const angleOffset = rng.range(0, Math.PI * 2); // Random starting angle per cluster
      const angle = angleOffset + (j / Math.max(selected.length, 1)) * Math.PI * 2;

      // Inner photos orbit closer, outer photos orbit further
      const orbitFraction = j / Math.max(selected.length - 1, 1);
      const minOrbit = maxRadius * 0.2;
      const orbit = minOrbit + (maxRadius - minOrbit) * orbitFraction;

      // Add some jitter
      const jitterAngle = rng.range(-0.3, 0.3);
      const jitterRadius = rng.range(-orbit * 0.15, orbit * 0.15);

      let x = pinPos.x + Math.cos(angle + jitterAngle) * (orbit + jitterRadius);
      let y = pinPos.y + Math.sin(angle + jitterAngle) * (orbit + jitterRadius);

      // Calculate size - inner photos are larger
      const baseSizePx = canvasSize.width * 0.08 * sizeMultiplierBase;
      const distanceScale = 1 - orbitFraction * 0.3; // Inner = 1.0, outer = 0.7

      let sizeVariationMultiplier = 1;
      if (sizeVariation === 'slight') {
        sizeVariationMultiplier = rng.range(0.85, 1.15);
      } else if (sizeVariation === 'dramatic') {
        sizeVariationMultiplier = rng.range(0.7, 1.3);
      }

      const size = baseSizePx * distanceScale * sizeVariationMultiplier;

      const aspectRatio = photo.width / photo.height;
      let photoWidth, photoHeight;

      if (aspectRatio > 1) {
        photoWidth = size;
        photoHeight = size / aspectRatio;
      } else {
        photoHeight = size;
        photoWidth = size * aspectRatio;
      }

      // Clamp to canvas bounds
      x = clamp(x, photoWidth / 2 + 10, canvasSize.width - photoWidth / 2 - 10);
      y = clamp(y, photoHeight / 2 + 10, canvasSize.height - photoHeight / 2 - 10);

      placements.push({
        photo,
        x,
        y,
        width: photoWidth,
        height: photoHeight,
        rotation: rng.range(-rotationRange, rotationRange),
        clusterId: cluster.id
      });
    }
  }

  return placements;
}
