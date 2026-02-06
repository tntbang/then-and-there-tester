// Bubbles background — overlapping transparent circles

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'bubbles',
  name: 'Bubbles',
  category: 'dots',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 1 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 2 },
    { id: 'density', name: 'Density', type: 'number', default: 30, min: 5, max: 80, step: 1 },
    { id: 'minSize', name: 'Min Size', type: 'number', default: 10, min: 5, max: 50, step: 1 },
    { id: 'maxSize', name: 'Max Size', type: 'number', default: 60, min: 20, max: 150, step: 5 },
    { id: 'opacity', name: 'Opacity', type: 'number', default: 30, min: 5, max: 80, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette, rng) {
    const bgColor = resolveColor(params.bgColor, palette);
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const density = params.density || 30;
    const minSize = params.minSize || 10;
    const maxSize = params.maxSize || 60;
    const opacity = (params.opacity || 30) / 100;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const area = width * height;
    const count = Math.round(density * (area / (400 * 400)));
    const colors = [c1, c2];

    for (let i = 0; i < count; i++) {
      const x = rng.randomFloat(0, width);
      const y = rng.randomFloat(0, height);
      const radius = rng.randomFloat(minSize, maxSize);
      const hex = rng.randomChoice(colors);
      const rgb = hexToRGB(hex);

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
});
