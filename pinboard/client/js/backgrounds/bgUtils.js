// Shared rendering utilities for background modules

import { hexToRGB } from '../color/utils.js';
import { createRNG } from '../utils/random.js';

/**
 * Resolve a palette color reference to a hex string
 * @param {number|string} ref - Palette index or utility name ('white', 'black', 'neutral')
 * @param {Object} palette - Palette object with colors array and utilities
 * @returns {string} Hex color string
 */
export function resolveColor(ref, palette) {
  if (typeof ref === 'number' && palette?.colors?.[ref]) {
    return palette.colors[ref];
  }
  if (ref === 'white') return '#ffffff';
  if (ref === 'black') return '#000000';
  if (ref === 'neutral') return palette?.utilities?.neutral || '#888888';
  return palette?.colors?.[0] || '#888888';
}

/**
 * Create a tileable offscreen canvas
 * @param {number} width - Tile width
 * @param {number} height - Tile height
 * @param {Function} renderFn - Function(ctx, width, height) that draws onto the tile
 * @returns {HTMLCanvasElement} The tile canvas
 */
export function createTileable(width, height, renderFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  renderFn(ctx, width, height);
  return canvas;
}

/**
 * Fill a canvas area with a repeating pattern from a tile
 * @param {CanvasRenderingContext2D} ctx - Target canvas context
 * @param {HTMLCanvasElement} tileCanvas - Tile to repeat
 * @param {number} width - Fill area width
 * @param {number} height - Fill area height
 */
export function fillWithPattern(ctx, tileCanvas, width, height) {
  const pattern = ctx.createPattern(tileCanvas, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Simple 2D noise function (simplex-like)
 * Ported from textures.js
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} seed - Seed value
 * @returns {number} Noise value (-1 to 1)
 */
export function simplexNoise2D(x, y, seed) {
  const dot = (gx, gy, dx, dy) => gx * dx + gy * dy;

  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const fracX = x - floorX;
  const fracY = y - floorY;

  // Smoothstep
  const smoothX = fracX * fracX * (3 - 2 * fracX);
  const smoothY = fracY * fracY * (3 - 2 * fracY);

  // Hash function for gradients
  const hash = (ix, iy) => {
    const h = (ix * 374761393 + iy * 668265263 + seed * 1013904223) % 2147483647;
    return h;
  };

  // Gradient vectors
  const grad = (h) => {
    const angle = (h % 360) * Math.PI / 180;
    return [Math.cos(angle), Math.sin(angle)];
  };

  const g00 = grad(hash(floorX, floorY));
  const g10 = grad(hash(floorX + 1, floorY));
  const g01 = grad(hash(floorX, floorY + 1));
  const g11 = grad(hash(floorX + 1, floorY + 1));

  const n00 = dot(g00[0], g00[1], fracX, fracY);
  const n10 = dot(g10[0], g10[1], fracX - 1, fracY);
  const n01 = dot(g01[0], g01[1], fracX, fracY - 1);
  const n11 = dot(g11[0], g11[1], fracX - 1, fracY - 1);

  const nx0 = n00 * (1 - smoothX) + n10 * smoothX;
  const nx1 = n01 * (1 - smoothX) + n11 * smoothX;

  return nx0 * (1 - smoothY) + nx1 * smoothY;
}

/**
 * Add subtle grain overlay to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} intensity - Grain intensity (0-1)
 * @param {number} seed - Random seed
 */
export function addGrainOverlay(ctx, width, height, intensity, seed) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const rng = createRNG(seed + 999);

  for (let i = 0; i < data.length; i += 4) {
    const grain = (rng.random() - 0.5) * 255 * intensity;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }

  ctx.putImageData(imageData, 0, 0);
}
