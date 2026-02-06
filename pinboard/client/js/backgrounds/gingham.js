// Gingham background — woven check pattern

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'gingham',
  name: 'Gingham',
  category: 'geometric',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 'white' },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 0 },
    { id: 'cellSize', name: 'Cell Size', type: 'number', default: 20, min: 8, max: 60, step: 2, unit: 'px' }
  ],
  render(ctx, width, height, params, palette) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const cellSize = params.cellSize || 20;
    const rgb2 = hexToRGB(c2);

    // Fill with light color
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    // Horizontal bands (semi-transparent)
    ctx.fillStyle = `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, 0.35)`;
    for (let y = 0; y < height; y += cellSize * 2) {
      ctx.fillRect(0, y, width, cellSize);
    }

    // Vertical bands (semi-transparent, blends with horizontal for darker squares)
    for (let x = 0; x < width; x += cellSize * 2) {
      ctx.fillRect(x, 0, cellSize, height);
    }
  }
});
