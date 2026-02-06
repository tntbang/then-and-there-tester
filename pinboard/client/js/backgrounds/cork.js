// Cork board background — multi-layer noise texture

import { registerBackground } from './registry.js';
import { resolveColor, simplexNoise2D, addGrainOverlay } from './bgUtils.js';
import { hexToRGB, blendColors, adjustLightness } from '../color/utils.js';

registerBackground({
  id: 'cork',
  name: 'Cork Board',
  category: 'textures',
  schema: [
    { id: 'baseColor', name: 'Base Color', type: 'palette-color', default: 0 },
    { id: 'grainIntensity', name: 'Grain', type: 'number', default: 50, min: 10, max: 100, step: 5, suffix: '%' },
    { id: 'darkStreaks', name: 'Dark Streaks', type: 'number', default: 40, min: 0, max: 100, step: 5, suffix: '%' },
    { id: 'poreDetail', name: 'Pore Detail', type: 'number', default: 50, min: 0, max: 100, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette, rng, scale = 1) {
    const base = resolveColor(params.baseColor, palette);
    const grainIntensity = (params.grainIntensity || 50) / 100;
    const darkStreaks = (params.darkStreaks || 40) / 100;
    const poreDetail = (params.poreDetail || 50) / 100;

    // Generate cork-appropriate colors from base
    const corkBase = blendColors(base, '#b8845a', 0.6);
    const colors = [
      adjustLightness(corkBase, 10),
      corkBase,
      adjustLightness(corkBase, -10),
      adjustLightness(corkBase, -20)
    ];

    // Use a tile size for performance at large resolutions (scale tile cap with resolution)
    const tileSize = Math.min(Math.round(256 * scale), Math.min(width, height));
    const seed = rng.randomInt(0, 100000);

    // Draw tile
    const tile = document.createElement('canvas');
    tile.width = tileSize;
    tile.height = tileSize;
    const tCtx = tile.getContext('2d');

    const baseRgb = hexToRGB(colors[0]);
    tCtx.fillStyle = colors[0];
    tCtx.fillRect(0, 0, tileSize, tileSize);

    const imageData = tCtx.getImageData(0, 0, tileSize, tileSize);
    const data = imageData.data;

    // Scale noise frequency divisors so texture detail matches at all resolutions
    const s = scale;
    for (let y = 0; y < tileSize; y++) {
      for (let x = 0; x < tileSize; x++) {
        const i = (y * tileSize + x) * 4;

        let noise = 0;
        noise += simplexNoise2D(x / (50 * s), y / (50 * s), seed) * 0.5;
        noise += simplexNoise2D(x / (25 * s), y / (25 * s), seed + 1) * 0.25 * darkStreaks;
        noise += simplexNoise2D(x / (12 * s), y / (12 * s), seed + 2) * 0.15 * poreDetail;
        noise += simplexNoise2D(x / (6 * s), y / (6 * s), seed + 3) * 0.1 * poreDetail;

        const variation = (noise + 1) / 2;
        const colorIndex = Math.floor(variation * colors.length);
        const color = hexToRGB(colors[Math.min(colorIndex, colors.length - 1)]);

        const speckle = (rng.random() - 0.5) * 20 * grainIntensity;

        data[i] = Math.max(0, Math.min(255, color.r + noise * 30 + speckle));
        data[i + 1] = Math.max(0, Math.min(255, color.g + noise * 25 + speckle));
        data[i + 2] = Math.max(0, Math.min(255, color.b + noise * 20 + speckle));
        data[i + 3] = 255;
      }
    }

    tCtx.putImageData(imageData, 0, 0);
    addGrainOverlay(tCtx, tileSize, tileSize, 0.03 * grainIntensity, seed);

    // Tile across main canvas
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
});
