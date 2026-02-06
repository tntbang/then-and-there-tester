// Paint splatter background

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'splatter',
  name: 'Paint Splatter',
  category: 'decorative',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 'white' },
    { id: 'color1', name: 'Splatter 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Splatter 2', type: 'palette-color', default: 1 },
    { id: 'color3', name: 'Splatter 3', type: 'palette-color', default: 2 },
    { id: 'splatCount', name: 'Splat Count', type: 'number', default: 15, min: 3, max: 40, step: 1 },
    { id: 'splatSize', name: 'Splat Size', type: 'number', default: 40, min: 10, max: 100, step: 5 },
    { id: 'opacity', name: 'Opacity', type: 'number', default: 60, min: 15, max: 100, step: 5, suffix: '%' },
    { id: 'droplets', name: 'Droplets', type: 'boolean', default: true }
  ],
  render(ctx, width, height, params, palette, rng) {
    const bgColor = resolveColor(params.bgColor, palette);
    const colors = [
      resolveColor(params.color1, palette),
      resolveColor(params.color2, palette),
      resolveColor(params.color3, palette)
    ];
    const splatCount = params.splatCount || 15;
    const splatSize = params.splatSize || 40;
    const opacity = (params.opacity || 60) / 100;
    const droplets = params.droplets !== false;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < splatCount; i++) {
      const cx = rng.randomFloat(0, width);
      const cy = rng.randomFloat(0, height);
      const hex = rng.randomChoice(colors);
      const rgb = hexToRGB(hex);
      const size = splatSize * rng.randomFloat(0.4, 1.6);

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

      // Main splat — irregular blob using overlapping circles
      const blobCount = rng.randomInt(3, 7);
      for (let b = 0; b < blobCount; b++) {
        const bx = cx + rng.randomFloat(-size * 0.4, size * 0.4);
        const by = cy + rng.randomFloat(-size * 0.4, size * 0.4);
        const br = size * rng.randomFloat(0.2, 0.6);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // Droplets radiating outward
      if (droplets) {
        const dropCount = rng.randomInt(3, 8);
        for (let d = 0; d < dropCount; d++) {
          const angle = rng.randomFloat(0, Math.PI * 2);
          const dist = size * rng.randomFloat(0.6, 1.5);
          const dx = cx + Math.cos(angle) * dist;
          const dy = cy + Math.sin(angle) * dist;
          const dr = size * rng.randomFloat(0.05, 0.15);
          ctx.beginPath();
          ctx.arc(dx, dy, dr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
});
