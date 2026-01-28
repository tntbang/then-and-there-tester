/**
 * spiral.js - Spiral layout algorithm
 *
 * Photos arranged in an expanding spiral from the center.
 * Cluster order determines position in spiral.
 * Good for single-location trips.
 */

import { clamp, shuffleArray } from '../utils.js';

/**
 * Spiral Layout Algorithm
 */
export function spiralLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    sizeVariation = 'slight',
    rotationRange = 10
  } = params;

  if (clusters.length === 0) return [];

  // Collect all photos in order by cluster
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

  // Calculate spiral parameters
  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;

  // Map takes center, so spiral should avoid it
  const innerRadius = Math.sqrt(mapRect.width * mapRect.width + mapRect.height * mapRect.height) / 2 + 50;
  const outerRadius = Math.min(canvasSize.width, canvasSize.height) / 2 - 50;

  const placements = [];

  for (let i = 0; i < allSelected.length; i++) {
    const { photo, clusterId } = allSelected[i];

    // Spiral position
    // Angle increases with each photo
    const angleStep = (2 * Math.PI) / Math.max(4, Math.floor(allSelected.length / 2));
    const angle = i * angleStep * 1.5; // 1.5 for more spacing

    // Radius increases as we go outward
    const t = i / (allSelected.length - 1 || 1);
    const radius = innerRadius + (outerRadius - innerRadius) * t;

    let x = centerX + Math.cos(angle) * radius;
    let y = centerY + Math.sin(angle) * radius;

    // Add jitter
    x += rng.range(-20, 20);
    y += rng.range(-20, 20);

    // Size - photos get slightly smaller as they go outward
    const baseSize = canvasSize.width * 0.09 * (1 - t * 0.3);
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

    x = clamp(x, photoWidth / 2, canvasSize.width - photoWidth / 2);
    y = clamp(y, photoHeight / 2, canvasSize.height - photoHeight / 2);

    // Rotation follows spiral direction
    const spiralRotation = (angle * 180 / Math.PI) % 360 - 180;
    const rotation = spiralRotation * 0.1 + rng.range(-rotationRange * 0.5, rotationRange * 0.5);

    placements.push({
      photo,
      x,
      y,
      width: photoWidth,
      height: photoHeight,
      rotation: clamp(rotation, -rotationRange, rotationRange),
      clusterId
    });
  }

  return placements;
}
