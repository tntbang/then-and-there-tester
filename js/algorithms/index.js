/**
 * algorithms/index.js - Algorithm registry and common interface
 */

import { mapRegionsLayout } from './mapRegions.js';
import { orbitalLayout } from './orbital.js';
import { anchoredScatterLayout } from './anchoredScatter.js';
import { edgeSnapLayout } from './edgeSnap.js';
import { edgeSnapZoomLayout } from './edgeSnapZoom.js';
import { gravityWellsLayout } from './gravityWells.js';
import { gridOverlayLayout } from './gridOverlay.js';
import { spiralLayout } from './spiral.js';
import { freeformLayout } from './freeform.js';

/**
 * Registry of all available algorithms
 */
export const algorithms = {
  mapRegions: {
    name: 'Map Regions',
    description: 'Photos placed in 8 regions around map based on geographic direction',
    fn: mapRegionsLayout
  },
  orbital: {
    name: 'Orbital',
    description: 'Photos orbit their cluster pin at varying distances',
    fn: orbitalLayout
  },
  anchoredScatter: {
    name: 'Anchored Scatter',
    description: 'Hero photo on pin, others scatter nearby',
    fn: anchoredScatterLayout
  },
  edgeSnap: {
    name: 'Edge Snap v3',
    description: 'Portrait elliptical clusters with edge-snapping placement',
    fn: edgeSnapLayout
  },
  edgeSnapZoom: {
    name: 'Edge Snap Zoom v3.1',
    description: 'Master canvas with viewport zoom - map and photos scale together',
    fn: edgeSnapZoomLayout
  },
  gravityWells: {
    name: 'Gravity Wells',
    description: 'Photos pulled toward cluster pins by gravity simulation',
    fn: gravityWellsLayout
  },
  gridOverlay: {
    name: 'Grid Overlay',
    description: 'Photos placed in grid cells assigned to clusters',
    fn: gridOverlayLayout
  },
  spiral: {
    name: 'Spiral',
    description: 'Photos arranged in expanding spiral from center',
    fn: spiralLayout
  },
  freeform: {
    name: 'Freeform',
    description: 'Random positions with collision resolution',
    fn: freeformLayout
  }
};

/**
 * Run a specific algorithm by name
 *
 * @param {string} name - Algorithm name
 * @param {Photo[]} photos - All photos with location
 * @param {Cluster[]} clusters - Clustering result
 * @param {object} params - Layout parameters from UI
 * @param {object} canvasSize - { width, height }
 * @param {object} mapRect - { x, y, width, height }
 * @param {SeededRandom} rng - Seeded random instance
 * @returns {Placement[]} Array of photo placements
 */
export function runAlgorithm(name, photos, clusters, params, canvasSize, mapRect, rng) {
  const algorithm = algorithms[name];

  if (!algorithm) {
    console.error('Unknown algorithm:', name);
    return [];
  }

  console.log(`Running algorithm: ${algorithm.name}`);
  return algorithm.fn(photos, clusters, params, canvasSize, mapRect, rng);
}

/**
 * Get list of algorithm names for UI
 */
export function getAlgorithmNames() {
  return Object.keys(algorithms);
}

/**
 * Get algorithm info by name
 */
export function getAlgorithmInfo(name) {
  return algorithms[name] || null;
}
