// Confetti dots background — scattered random dots in 2 sizes, 3 colors

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'confetti',
  name: 'Confetti Dots',
  category: 'dots',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'mediumColor', name: 'Medium Dots', type: 'palette-color', default: 1 },
    { id: 'smallColor', name: 'Small Dots', type: 'palette-color', default: 2 },
    { id: 'density', name: 'Density', type: 'number', default: 80, min: 20, max: 200, step: 5 },
    { id: 'mediumSize', name: 'Medium Size', type: 'number', default: 8, min: 3, max: 20, step: 1 },
    { id: 'smallSize', name: 'Small Size', type: 'number', default: 4, min: 1, max: 10, step: 1 },
    { id: 'sizeVariation', name: 'Size Variation', type: 'number', default: 30, min: 0, max: 100, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette, rng) {
    const bgColor = resolveColor(params.bgColor, palette);
    const medColor = resolveColor(params.mediumColor, palette);
    const smColor = resolveColor(params.smallColor, palette);
    const density = params.density || 80;
    const medSize = params.mediumSize || 8;
    const smSize = params.smallSize || 4;
    const variation = (params.sizeVariation || 30) / 100;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Scale dot count with canvas area
    const area = width * height;
    const count = Math.round(density * (area / (400 * 400)));

    for (let i = 0; i < count; i++) {
      const x = rng.randomFloat(0, width);
      const y = rng.randomFloat(0, height);
      const isMedium = rng.random() > 0.5;
      const baseSize = isMedium ? medSize : smSize;
      const size = baseSize * (1 + (rng.random() - 0.5) * variation);

      ctx.fillStyle = isMedium ? medColor : smColor;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, size / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
});
