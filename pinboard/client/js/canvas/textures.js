// Procedural texture generators

import { hexToRGB, blendColors, adjustLightness } from '../color/utils.js';
import { createRNG } from '../utils/random.js';

/**
 * Generate a polkadot texture
 * @param {number} size - Texture size in pixels
 * @param {Object} options - Texture options
 * @param {string} options.backgroundColor - Background hex color
 * @param {string} options.dotColor - Dot hex color
 * @param {number} options.dotSize - Dot radius as percentage of spacing
 * @param {number} options.spacing - Distance between dot centers
 * @param {number} options.seed - Random seed for slight variations
 * @returns {HTMLCanvasElement} Texture canvas
 */
export function generatePolkadots(size, options = {}) {
  const {
    backgroundColor = '#ffffff',
    dotColor = '#000000',
    dotSize = 20,
    spacing = 25,
    seed = 12345
  } = options;

  // Calculate tile size as multiple of pattern repeat for seamless tiling
  const patternRepeat = dotSize + spacing;
  const repeatCount = Math.max(2, Math.min(8, Math.ceil(128 / patternRepeat)));
  const tileSize = patternRepeat * repeatCount;

  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, tileSize, tileSize);

  // Draw dots in grid pattern
  ctx.fillStyle = dotColor;
  const radius = dotSize / 2;

  for (let y = 0; y < repeatCount; y++) {
    for (let x = 0; x < repeatCount; x++) {
      const cx = (x * patternRepeat) + (patternRepeat / 2);
      const cy = (y * patternRepeat) + (patternRepeat / 2);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}

/**
 * Generate a striped texture
 * @param {number} size - Texture size in pixels
 * @param {Object} options - Texture options
 * @param {string} options.color1 - First stripe color
 * @param {string} options.color2 - Second stripe color
 * @param {number} options.stripeWidth - Width of each stripe
 * @param {string} options.direction - 'horizontal' | 'vertical' | 'diagonal'
 * @returns {HTMLCanvasElement} Texture canvas
 */
export function generateStripes(size, options = {}) {
  const {
    color1 = '#ffffff',
    color2 = '#000000',
    stripeWidth = 20,
    direction = 'diagonal'
  } = options;

  // Pattern repeat is two stripes (one of each color)
  const patternRepeat = stripeWidth * 2;
  const repeatCount = Math.max(2, Math.min(8, Math.ceil(128 / patternRepeat)));
  const tileSize = patternRepeat * repeatCount;

  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');

  // Fill with first color
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, tileSize, tileSize);

  ctx.fillStyle = color2;

  if (direction === 'diagonal') {
    // Draw diagonal stripes
    const diagonal = tileSize * Math.sqrt(2);
    const stripeCount = Math.ceil(diagonal / patternRepeat) + 2;

    ctx.save();
    ctx.translate(tileSize / 2, tileSize / 2);
    ctx.rotate(-Math.PI / 4);

    for (let i = -stripeCount; i < stripeCount; i++) {
      const x = i * patternRepeat;
      ctx.fillRect(x, -diagonal, stripeWidth, diagonal * 2);
    }

    ctx.restore();
  } else if (direction === 'horizontal') {
    for (let y = 0; y < tileSize; y += patternRepeat) {
      ctx.fillRect(0, y, tileSize, stripeWidth);
    }
  } else if (direction === 'vertical') {
    for (let x = 0; x < tileSize; x += patternRepeat) {
      ctx.fillRect(x, 0, stripeWidth, tileSize);
    }
  }

  return canvas;
}

/**
 * Generate a cork texture
 * @param {number} size - Texture size in pixels
 * @param {Object} options - Texture options
 * @param {string[]} options.colors - Array of brown/tan colors from palette
 * @param {number} options.seed - Random seed
 * @returns {HTMLCanvasElement} Texture canvas
 */
export function generateCork(size, options = {}) {
  const {
    colors = ['#c4956a', '#d4a574', '#b8845a', '#a87444'],
    seed = 12345
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const rng = createRNG(seed);

  // Base color
  const baseColor = colors[0] || '#c4956a';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Generate noise pattern
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Simple Perlin-like noise using multiple octaves
      let noise = 0;
      noise += simplexNoise2D(x / 50, y / 50, seed) * 0.5;
      noise += simplexNoise2D(x / 25, y / 25, seed + 1) * 0.25;
      noise += simplexNoise2D(x / 12, y / 12, seed + 2) * 0.15;
      noise += simplexNoise2D(x / 6, y / 6, seed + 3) * 0.1;

      // Map noise to color variation
      const variation = (noise + 1) / 2; // 0 to 1
      const colorIndex = Math.floor(variation * colors.length);
      const color = hexToRGB(colors[Math.min(colorIndex, colors.length - 1)]);

      // Add slight random speckle
      const speckle = (rng.random() - 0.5) * 20;

      data[i] = Math.max(0, Math.min(255, color.r + noise * 30 + speckle));
      data[i + 1] = Math.max(0, Math.min(255, color.g + noise * 25 + speckle));
      data[i + 2] = Math.max(0, Math.min(255, color.b + noise * 20 + speckle));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Add subtle grain overlay
  addGrainOverlay(ctx, size, 0.03, seed);

  return canvas;
}

/**
 * Simple 2D noise function (simplex-like)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} seed - Seed value
 * @returns {number} Noise value (-1 to 1)
 */
function simplexNoise2D(x, y, seed) {
  // Simple hash-based noise
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
 * @param {number} size - Canvas size
 * @param {number} intensity - Grain intensity (0-1)
 * @param {number} seed - Random seed
 */
function addGrainOverlay(ctx, size, intensity, seed) {
  const imageData = ctx.getImageData(0, 0, size, size);
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

/**
 * Generate cork-appropriate colors from a palette
 * @param {Object} palette - Color palette object
 * @returns {string[]} Array of brown/tan colors
 */
export function getCorkColors(palette) {
  if (!palette || !palette.colors) {
    return ['#c4956a', '#d4a574', '#b8845a', '#a87444'];
  }

  // Find warmest colors and adjust toward brown
  const browns = palette.colors.map(color => {
    // Blend toward a cork brown
    return blendColors(color, '#b8845a', 0.6);
  });

  // Add some lighter and darker variants
  return [
    adjustLightness(browns[0], 10),
    browns[0],
    adjustLightness(browns[0], -10),
    adjustLightness(browns[0], -20)
  ];
}
