/**
 * clustering.js - DBSCAN clustering algorithm for geographic grouping
 */

import { haversineKm } from './utils.js';

const UNVISITED = 0;
const VISITED = 1;
const NOISE = 2;

/**
 * Find all photos within epsilon km of a given photo
 */
function regionQuery(photos, photoIndex, epsilon) {
  const neighbors = [];
  const p = photos[photoIndex];

  for (let i = 0; i < photos.length; i++) {
    if (i === photoIndex) continue;

    const q = photos[i];
    const distance = haversineKm(p.lat, p.lon, q.lat, q.lon);

    if (distance <= epsilon) {
      neighbors.push(i);
    }
  }

  return neighbors;
}

/**
 * Calculate geographic bounding box span in km
 */
function calculateSpan(photos) {
  if (photos.length === 0) return 0;

  const lats = photos.map(p => p.lat);
  const lons = photos.map(p => p.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Calculate approximate span in km
  const latSpan = haversineKm(minLat, minLon, maxLat, minLon);
  const lonSpan = haversineKm(minLat, minLon, minLat, maxLon);

  return Math.max(latSpan, lonSpan);
}

/**
 * Calculate adaptive epsilon based on geographic span
 */
function calculateAdaptiveEpsilon(photos) {
  const span = calculateSpan(photos);

  if (span < 1) {
    return 0.1; // Very local photos (within 1km)
  } else if (span < 50) {
    return 1.0; // City/regional scale
  } else {
    return 5.0; // Multi-city or country scale
  }
}

/**
 * Calculate cluster centroid and bounds
 */
function calculateClusterStats(clusterPhotos) {
  if (clusterPhotos.length === 0) {
    return { centroid: { lat: 0, lon: 0 }, bounds: { north: 0, south: 0, east: 0, west: 0 } };
  }

  const lats = clusterPhotos.map(p => p.lat);
  const lons = clusterPhotos.map(p => p.lon);

  return {
    centroid: {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length
    },
    bounds: {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lons),
      west: Math.min(...lons)
    }
  };
}

/**
 * DBSCAN clustering algorithm
 *
 * @param {Photo[]} allPhotos - All photos (will filter to those with GPS)
 * @param {number} epsilon - Distance threshold in km
 * @param {number} minPoints - Minimum photos to form a cluster
 * @param {boolean} adaptive - Whether to auto-calculate epsilon based on span
 * @returns {Cluster[]} Array of clusters
 */
export function clusterPhotos(allPhotos, epsilon, minPoints, adaptive = true) {
  // Filter to only photos with location
  const photos = allPhotos.filter(p => p.hasLocation);

  if (photos.length === 0) {
    console.log('No photos with GPS data to cluster');
    return [];
  }

  console.log(`Clustering ${photos.length} photos with GPS data`);

  // Calculate effective epsilon
  let effectiveEpsilon = epsilon;
  if (adaptive) {
    effectiveEpsilon = calculateAdaptiveEpsilon(photos);
    console.log(`Adaptive epsilon: ${effectiveEpsilon.toFixed(2)} km (span-based)`);
  } else {
    console.log(`Fixed epsilon: ${epsilon} km`);
  }

  // Initialize state
  const state = new Array(photos.length).fill(UNVISITED);
  const clusterAssignment = new Array(photos.length).fill(-1);
  let currentCluster = 0;

  // DBSCAN algorithm
  for (let i = 0; i < photos.length; i++) {
    if (state[i] !== UNVISITED) continue;

    state[i] = VISITED;
    const neighbors = regionQuery(photos, i, effectiveEpsilon);

    if (neighbors.length < minPoints - 1) {
      // Mark as noise (will become single-photo cluster later)
      state[i] = NOISE;
    } else {
      // Create new cluster
      clusterAssignment[i] = currentCluster;

      // Process neighbors
      const queue = [...neighbors];
      while (queue.length > 0) {
        const j = queue.shift();

        if (state[j] === UNVISITED) {
          state[j] = VISITED;
          const newNeighbors = regionQuery(photos, j, effectiveEpsilon);

          if (newNeighbors.length >= minPoints - 1) {
            // Add new neighbors to queue
            for (const n of newNeighbors) {
              if (state[n] === UNVISITED) {
                queue.push(n);
              }
            }
          }
        }

        // Add to cluster if not already assigned
        if (clusterAssignment[j] === -1) {
          clusterAssignment[j] = currentCluster;
        }
      }

      currentCluster++;
    }
  }

  // Build cluster objects
  const clusterMap = new Map();

  // First, add clustered photos
  for (let i = 0; i < photos.length; i++) {
    if (clusterAssignment[i] >= 0) {
      if (!clusterMap.has(clusterAssignment[i])) {
        clusterMap.set(clusterAssignment[i], []);
      }
      clusterMap.get(clusterAssignment[i]).push(photos[i]);
    }
  }

  // Then, create single-photo clusters for noise points
  for (let i = 0; i < photos.length; i++) {
    if (state[i] === NOISE) {
      clusterMap.set(currentCluster, [photos[i]]);
      currentCluster++;
    }
  }

  // Convert to cluster array with stats
  const clusters = [];
  for (const [id, clusterPhotos] of clusterMap) {
    const stats = calculateClusterStats(clusterPhotos);
    clusters.push({
      id: clusters.length,
      photos: clusterPhotos,
      ...stats
    });
  }

  // Sort by photo count (descending)
  clusters.sort((a, b) => b.photos.length - a.photos.length);

  // Re-assign sequential IDs after sorting
  clusters.forEach((c, i) => c.id = i);

  console.log(`Created ${clusters.length} clusters:`);
  clusters.forEach(c => {
    console.log(`  Cluster ${c.id}: ${c.photos.length} photos, centroid: (${c.centroid.lat.toFixed(4)}, ${c.centroid.lon.toFixed(4)})`);
  });

  return clusters;
}
