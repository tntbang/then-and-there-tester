/**
 * gravityWells.js - Gravity Wells layout algorithm
 *
 * Photos start at random positions and are pulled toward
 * their cluster's pin location by simulated gravity.
 */

import { clamp, shuffleArray, mapRange } from '../utils.js';

/**
 * Calculate geographic bounds from clusters
 */
function calculateGeoBounds(clusters) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const cluster of clusters) {
    minLat = Math.min(minLat, cluster.bounds.south);
    maxLat = Math.max(maxLat, cluster.bounds.north);
    minLon = Math.min(minLon, cluster.bounds.west);
    maxLon = Math.max(maxLon, cluster.bounds.east);
  }

  const latPad = (maxLat - minLat) * 0.2 || 0.01;
  const lonPad = (maxLon - minLon) * 0.2 || 0.01;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad
  };
}

/**
 * Map geo coordinates to canvas
 */
function geoToCanvas(lat, lon, geoBounds, mapRect) {
  const x = mapRange(lon, geoBounds.minLon, geoBounds.maxLon, mapRect.x, mapRect.x + mapRect.width);
  const y = mapRange(lat, geoBounds.maxLat, geoBounds.minLat, mapRect.y, mapRect.y + mapRect.height);
  return { x, y };
}

/**
 * Gravity Wells Layout Algorithm
 */
export function gravityWellsLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    sizeVariation = 'slight',
    rotationRange = 10
  } = params;

  if (clusters.length === 0) return [];

  const geoBounds = calculateGeoBounds(clusters);

  // Calculate cluster wells (gravity centers)
  const wells = clusters.map(cluster => {
    const pos = geoToCanvas(cluster.centroid.lat, cluster.centroid.lon, geoBounds, mapRect);
    return {
      x: pos.x,
      y: pos.y,
      strength: cluster.photos.length
    };
  });

  // Allocate photos
  const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
  let remaining = maxPhotos;
  const selectedByCluster = [];

  for (const cluster of clusters) {
    const proportion = cluster.photos.length / totalPhotos;
    const allocation = Math.max(1, Math.round(proportion * maxPhotos));
    const count = Math.min(allocation, remaining, cluster.photos.length);
    remaining -= count;

    const shuffled = shuffleArray(cluster.photos, rng);
    selectedByCluster.push(shuffled.slice(0, count));
  }

  // Initialize particles at random positions
  const particles = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const selected = selectedByCluster[i];
    const well = wells[i];

    for (const photo of selected) {
      // Start at random position
      let x = rng.range(0, canvasSize.width);
      let y = rng.range(0, canvasSize.height);

      // Avoid starting inside map
      if (x > mapRect.x && x < mapRect.x + mapRect.width &&
          y > mapRect.y && y < mapRect.y + mapRect.height) {
        // Push outside
        if (rng.next() > 0.5) {
          x = rng.next() > 0.5 ? mapRect.x - 50 : mapRect.x + mapRect.width + 50;
        } else {
          y = rng.next() > 0.5 ? mapRect.y - 50 : mapRect.y + mapRect.height + 50;
        }
      }

      particles.push({
        photo,
        x,
        y,
        clusterId: cluster.id,
        wellX: well.x,
        wellY: well.y
      });
    }
  }

  // Simulate gravity for several iterations
  const iterations = 50;
  const pullStrength = 0.08;

  for (let iter = 0; iter < iterations; iter++) {
    for (const particle of particles) {
      // Pull toward well
      const dx = particle.wellX - particle.x;
      const dy = particle.wellY - particle.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      particle.x += (dx / dist) * Math.min(dist * pullStrength, 20);
      particle.y += (dy / dist) * Math.min(dist * pullStrength, 20);

      // Avoid map center
      if (particle.x > mapRect.x && particle.x < mapRect.x + mapRect.width &&
          particle.y > mapRect.y && particle.y < mapRect.y + mapRect.height) {
        // Push to nearest edge
        const toLeft = particle.x - mapRect.x;
        const toRight = mapRect.x + mapRect.width - particle.x;
        const toTop = particle.y - mapRect.y;
        const toBottom = mapRect.y + mapRect.height - particle.y;

        const minDist = Math.min(toLeft, toRight, toTop, toBottom);
        if (minDist === toLeft) particle.x = mapRect.x - 30;
        else if (minDist === toRight) particle.x = mapRect.x + mapRect.width + 30;
        else if (minDist === toTop) particle.y = mapRect.y - 30;
        else particle.y = mapRect.y + mapRect.height + 30;
      }
    }
  }

  // Create placements
  const placements = [];

  for (const particle of particles) {
    const photo = particle.photo;
    const baseSize = canvasSize.width * 0.08;
    const sizeMultiplier = sizeVariation === 'uniform' ? 1 :
      sizeVariation === 'slight' ? rng.range(0.85, 1.15) : rng.range(0.7, 1.3);

    const aspectRatio = photo.width / photo.height;
    const size = baseSize * sizeMultiplier;
    let photoWidth, photoHeight;

    if (aspectRatio > 1) {
      photoWidth = size;
      photoHeight = size / aspectRatio;
    } else {
      photoHeight = size;
      photoWidth = size * aspectRatio;
    }

    const x = clamp(particle.x, photoWidth / 2, canvasSize.width - photoWidth / 2);
    const y = clamp(particle.y, photoHeight / 2, canvasSize.height - photoHeight / 2);

    placements.push({
      photo,
      x,
      y,
      width: photoWidth,
      height: photoHeight,
      rotation: rng.range(-rotationRange, rotationRange),
      clusterId: particle.clusterId
    });
  }

  return placements;
}
