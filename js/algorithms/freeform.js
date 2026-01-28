/**
 * freeform.js - Freeform layout algorithm
 *
 * Completely random initial positions (avoiding map).
 * Runs collision detection/resolution iterations.
 * Most chaotic/organic result.
 */

import { clamp, shuffleArray } from '../utils.js';

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(r1, r2) {
  return !(
    r1.x + r1.w / 2 < r2.x - r2.w / 2 ||
    r1.x - r1.w / 2 > r2.x + r2.w / 2 ||
    r1.y + r1.h / 2 < r2.y - r2.h / 2 ||
    r1.y - r1.h / 2 > r2.y + r2.h / 2
  );
}

/**
 * Check if point is inside map area
 */
function insideMap(x, y, mapRect, margin = 0) {
  return (
    x > mapRect.x - margin &&
    x < mapRect.x + mapRect.width + margin &&
    y > mapRect.y - margin &&
    y < mapRect.y + mapRect.height + margin
  );
}

/**
 * Freeform Layout Algorithm
 */
export function freeformLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    sizeVariation = 'slight',
    rotationRange = 10
  } = params;

  if (clusters.length === 0) return [];

  // Collect all photos
  const allSelected = [];
  const totalPhotos = clusters.reduce((sum, c) => sum + c.photos.length, 0);
  let remaining = maxPhotos;

  for (const cluster of clusters) {
    const proportion = cluster.photos.length / totalPhotos;
    const allocation = Math.max(1, Math.round(proportion * maxPhotos));
    const count = Math.min(allocation, remaining, cluster.photos.length);
    remaining -= count;

    const shuffled = shuffleArray(cluster.photos, rng);
    for (let i = 0; i < count; i++) {
      allSelected.push({ photo: shuffled[i], clusterId: cluster.id });
    }
  }

  // Shuffle all photos together for true randomness
  const shuffledAll = shuffleArray(allSelected, rng);

  // Initialize particles at random positions
  const particles = [];

  for (const { photo, clusterId } of shuffledAll) {
    // Size
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

    // Random position outside map
    let x, y;
    let attempts = 0;
    do {
      x = rng.range(photoWidth / 2, canvasSize.width - photoWidth / 2);
      y = rng.range(photoHeight / 2, canvasSize.height - photoHeight / 2);
      attempts++;
    } while (insideMap(x, y, mapRect, 30) && attempts < 50);

    particles.push({
      photo,
      x,
      y,
      width: photoWidth,
      height: photoHeight,
      vx: 0,
      vy: 0,
      clusterId
    });
  }

  // Collision resolution iterations
  const iterations = 30;
  const pushStrength = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      const r1 = { x: p1.x, y: p1.y, w: p1.width, h: p1.height };

      // Push away from map
      if (insideMap(p1.x, p1.y, mapRect)) {
        const mapCenterX = mapRect.x + mapRect.width / 2;
        const mapCenterY = mapRect.y + mapRect.height / 2;
        const dx = p1.x - mapCenterX;
        const dy = p1.y - mapCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        p1.vx += (dx / dist) * 10;
        p1.vy += (dy / dist) * 10;
      }

      // Push away from other particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const r2 = { x: p2.x, y: p2.y, w: p2.width, h: p2.height };

        if (rectsOverlap(r1, r2)) {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const push = pushStrength * (1 - iter / iterations);

          p1.vx += (dx / dist) * push * 20;
          p1.vy += (dy / dist) * push * 20;
          p2.vx -= (dx / dist) * push * 20;
          p2.vy -= (dy / dist) * push * 20;
        }
      }
    }

    // Apply velocities with damping
    for (const p of particles) {
      p.x += p.vx * 0.3;
      p.y += p.vy * 0.3;
      p.vx *= 0.8;
      p.vy *= 0.8;

      // Keep in bounds
      p.x = clamp(p.x, p.width / 2, canvasSize.width - p.width / 2);
      p.y = clamp(p.y, p.height / 2, canvasSize.height - p.height / 2);
    }
  }

  // Create placements
  const placements = particles.map(p => ({
    photo: p.photo,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    rotation: rng.range(-rotationRange, rotationRange),
    clusterId: p.clusterId
  }));

  return placements;
}
