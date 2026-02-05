// K-means color extraction from photos

import { rgbToHex, hexToHSL, colorDistance, isNeutral } from './utils.js';

/**
 * Extract dominant colors from a set of photo thumbnails
 * @param {string[]} thumbnailUrls - Array of thumbnail URLs
 * @param {number} numColors - Number of colors to extract (default 10)
 * @returns {Promise<string[]>} Array of hex colors sorted by dominance
 */
export async function extractColors(thumbnailUrls, numColors = 10) {
  if (thumbnailUrls.length === 0) {
    return getDefaultColors(numColors);
  }

  const pixels = await samplePixelsFromImages(thumbnailUrls);

  if (pixels.length === 0) {
    return getDefaultColors(numColors);
  }

  const clusters = kMeans(pixels, numColors);

  // Sort by cluster size (most dominant first)
  clusters.sort((a, b) => b.count - a.count);

  return clusters.map(c => rgbToHex(c.center[0], c.center[1], c.center[2]));
}

/**
 * Sample pixels from multiple images
 * @param {string[]} urls - Image URLs
 * @param {number} samplesPerImage - Pixels to sample per image
 * @returns {Promise<number[][]>} Array of [r, g, b] pixels
 */
async function samplePixelsFromImages(urls, samplesPerImage = 1000) {
  const pixels = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (const url of urls) {
    try {
      const img = await loadImage(url);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const totalPixels = data.length / 4;

      // Sample random pixels
      const step = Math.max(1, Math.floor(totalPixels / samplesPerImage));
      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a > 128) {
          pixels.push([r, g, b]);
        }
      }
    } catch (err) {
      console.warn('Failed to sample image:', url, err);
    }
  }

  return pixels;
}

/**
 * Load an image from URL
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * K-means clustering algorithm
 * @param {number[][]} pixels - Array of [r, g, b] pixels
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Array<{center: number[], count: number}>} Cluster results
 */
function kMeans(pixels, k, maxIterations = 20) {
  if (pixels.length === 0) return [];
  if (pixels.length < k) k = pixels.length;

  // Initialize centers using k-means++
  let centers = initializeCenters(pixels, k);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest center
    const assignments = pixels.map(pixel => findNearestCenter(pixel, centers));

    // Calculate new centers
    const newCenters = [];
    const counts = [];

    for (let i = 0; i < k; i++) {
      const clusterPixels = pixels.filter((_, j) => assignments[j] === i);
      counts.push(clusterPixels.length);

      if (clusterPixels.length > 0) {
        const sum = [0, 0, 0];
        for (const pixel of clusterPixels) {
          sum[0] += pixel[0];
          sum[1] += pixel[1];
          sum[2] += pixel[2];
        }
        newCenters.push([
          sum[0] / clusterPixels.length,
          sum[1] / clusterPixels.length,
          sum[2] / clusterPixels.length
        ]);
      } else {
        // Keep old center if no pixels assigned
        newCenters.push(centers[i]);
      }
    }

    // Check for convergence
    let converged = true;
    for (let i = 0; i < k; i++) {
      const dist = euclideanDistance(centers[i], newCenters[i]);
      if (dist > 1) {
        converged = false;
        break;
      }
    }

    centers = newCenters;

    if (converged) break;
  }

  // Return centers with their counts
  const assignments = pixels.map(pixel => findNearestCenter(pixel, centers));
  return centers.map((center, i) => ({
    center,
    count: assignments.filter(a => a === i).length
  }));
}

/**
 * Initialize cluster centers using k-means++
 * @param {number[][]} pixels - Pixel data
 * @param {number} k - Number of centers
 * @returns {number[][]} Initial centers
 */
function initializeCenters(pixels, k) {
  const centers = [];

  // Pick first center randomly
  centers.push(pixels[Math.floor(Math.random() * pixels.length)].slice());

  // Pick remaining centers with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(pixel => {
      let minDist = Infinity;
      for (const center of centers) {
        const dist = euclideanDistance(pixel, center);
        if (dist < minDist) minDist = dist;
      }
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      target -= distances[j];
      if (target <= 0) {
        centers.push(pixels[j].slice());
        break;
      }
    }
  }

  return centers;
}

/**
 * Find nearest center index for a pixel
 * @param {number[]} pixel - RGB pixel
 * @param {number[][]} centers - Cluster centers
 * @returns {number} Index of nearest center
 */
function findNearestCenter(pixel, centers) {
  let minDist = Infinity;
  let nearest = 0;

  for (let i = 0; i < centers.length; i++) {
    const dist = euclideanDistance(pixel, centers[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }

  return nearest;
}

/**
 * Calculate Euclidean distance between two points
 * @param {number[]} a - First point
 * @param {number[]} b - Second point
 * @returns {number} Distance
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Categorize extracted colors
 * @param {string[]} colors - Array of hex colors
 * @returns {{dominant: string[], accent: string[], neutral: string[]}}
 */
export function categorizeColors(colors) {
  const dominant = [];
  const accent = [];
  const neutral = [];

  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    const hsl = hexToHSL(color);

    if (isNeutral(color)) {
      neutral.push(color);
    } else if (i < 3) {
      // Top 3 by count are dominant
      dominant.push(color);
    } else if (hsl.s > 30) {
      // High saturation colors are accents
      accent.push(color);
    } else {
      neutral.push(color);
    }
  }

  return { dominant, accent, neutral };
}

/**
 * Get default colors when no photos available
 * @param {number} count - Number of colors
 * @returns {string[]} Default color palette
 */
function getDefaultColors(count) {
  const defaults = [
    '#e85d4c', '#e8944c', '#e8c84c', '#b8e84c', '#4ce885',
    '#4ce8c8', '#4c94e8', '#5d4ce8', '#944ce8', '#e84cc8'
  ];
  return defaults.slice(0, count);
}
