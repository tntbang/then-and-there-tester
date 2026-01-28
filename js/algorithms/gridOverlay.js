/**
 * gridOverlay.js - Grid Overlay layout algorithm
 *
 * Overlays an invisible grid on the canvas.
 * Assigns grid cells to clusters based on proximity.
 * Places photos in their assigned cells.
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
 * Grid Overlay Layout Algorithm
 */
export function gridOverlayLayout(photos, clusters, params, canvasSize, mapRect, rng) {
  const {
    maxPhotos = 20,
    sizeVariation = 'slight',
    rotationRange = 10
  } = params;

  if (clusters.length === 0) return [];

  const geoBounds = calculateGeoBounds(clusters);

  // Calculate cluster positions on canvas
  const clusterPositions = clusters.map(cluster =>
    geoToCanvas(cluster.centroid.lat, cluster.centroid.lon, geoBounds, mapRect)
  );

  // Create grid (excluding map area)
  const gridSize = 5; // 5x5 grid
  const cellWidth = canvasSize.width / gridSize;
  const cellHeight = canvasSize.height / gridSize;

  // Find cells that don't overlap with map
  const availableCells = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellX = col * cellWidth;
      const cellY = row * cellHeight;

      // Check if cell overlaps with map
      const overlapsMap =
        cellX < mapRect.x + mapRect.width &&
        cellX + cellWidth > mapRect.x &&
        cellY < mapRect.y + mapRect.height &&
        cellY + cellHeight > mapRect.y;

      if (!overlapsMap) {
        const centerX = cellX + cellWidth / 2;
        const centerY = cellY + cellHeight / 2;

        // Find nearest cluster
        let nearestCluster = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < clusterPositions.length; i++) {
          const pos = clusterPositions[i];
          const dist = Math.sqrt(
            Math.pow(centerX - pos.x, 2) +
            Math.pow(centerY - pos.y, 2)
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestCluster = i;
          }
        }

        availableCells.push({
          row, col,
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight,
          clusterId: nearestCluster
        });
      }
    }
  }

  // Allocate photos proportionally
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

  // Place photos in cells
  const placements = [];
  const usedCells = new Set();

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const selected = selectedByCluster[i];

    // Get cells for this cluster
    const clusterCells = availableCells.filter(c => c.clusterId === i && !usedCells.has(`${c.row},${c.col}`));

    for (let j = 0; j < selected.length; j++) {
      const photo = selected[j];

      // Pick a cell (or random position if no cells left)
      let x, y;
      if (j < clusterCells.length) {
        const cell = clusterCells[j];
        usedCells.add(`${cell.row},${cell.col}`);

        // Center in cell with jitter
        x = cell.x + cell.width / 2 + rng.range(-cell.width * 0.2, cell.width * 0.2);
        y = cell.y + cell.height / 2 + rng.range(-cell.height * 0.2, cell.height * 0.2);
      } else {
        // Random position outside map
        do {
          x = rng.range(0, canvasSize.width);
          y = rng.range(0, canvasSize.height);
        } while (
          x > mapRect.x && x < mapRect.x + mapRect.width &&
          y > mapRect.y && y < mapRect.y + mapRect.height
        );
      }

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

      x = clamp(x, photoWidth / 2, canvasSize.width - photoWidth / 2);
      y = clamp(y, photoHeight / 2, canvasSize.height - photoHeight / 2);

      placements.push({
        photo,
        x,
        y,
        width: photoWidth,
        height: photoHeight,
        rotation: rng.range(-rotationRange * 0.5, rotationRange * 0.5), // Less rotation for grid
        clusterId: cluster.id
      });
    }
  }

  return placements;
}
