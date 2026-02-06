// Paper background — paper variants (smooth, kraft, watercolor, cardstock)

import { registerBackground } from './registry.js';
import { resolveColor, simplexNoise2D, addGrainOverlay } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'paper',
  name: 'Paper',
  category: 'textures',
  schema: [
    { id: 'bgColor', name: 'Color', type: 'palette-color', default: 'white' },
    {
      id: 'paperType', name: 'Paper Type', type: 'select', default: 'smooth',
      options: [
        { value: 'smooth', label: 'Smooth' },
        { value: 'kraft', label: 'Kraft' },
        { value: 'watercolor', label: 'Watercolor' },
        { value: 'cardstock', label: 'Cardstock' }
      ]
    },
    { id: 'grainAmount', name: 'Grain', type: 'number', default: 30, min: 0, max: 100, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette, rng, scale = 1) {
    const bgColor = resolveColor(params.bgColor, palette);
    const paperType = params.paperType || 'smooth';
    const grainAmount = (params.grainAmount || 30) / 100;
    const rgb = hexToRGB(bgColor);
    const seed = rng.randomInt(0, 100000);
    const s = scale; // Scale noise frequencies for resolution independence

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let variation = 0;

        switch (paperType) {
          case 'smooth':
            // Very subtle noise
            variation = simplexNoise2D(x / (80 * s), y / (80 * s), seed) * 8 * grainAmount;
            break;
          case 'kraft':
            // Rougher, directional grain
            variation = simplexNoise2D(x / (30 * s), y / (60 * s), seed) * 15 * grainAmount;
            variation += simplexNoise2D(x / (10 * s), y / (20 * s), seed + 1) * 8 * grainAmount;
            break;
          case 'watercolor':
            // Soft blotchy texture
            variation = simplexNoise2D(x / (60 * s), y / (60 * s), seed) * 20 * grainAmount;
            variation += simplexNoise2D(x / (20 * s), y / (20 * s), seed + 1) * 10 * grainAmount;
            break;
          case 'cardstock':
            // Fine, uniform grain
            variation = simplexNoise2D(x / (15 * s), y / (15 * s), seed) * 6 * grainAmount;
            variation += (rng.random() - 0.5) * 4 * grainAmount;
            break;
        }

        data[i] = Math.max(0, Math.min(255, rgb.r + variation));
        data[i + 1] = Math.max(0, Math.min(255, rgb.g + variation));
        data[i + 2] = Math.max(0, Math.min(255, rgb.b + variation));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
});
