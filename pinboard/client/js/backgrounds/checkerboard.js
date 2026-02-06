// Checkerboard background

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'checkerboard',
  name: 'Checkerboard',
  category: 'geometric',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 1 },
    { id: 'cellSize', name: 'Cell Size', type: 'number', default: 30, min: 8, max: 80, step: 2, unit: 'px' }
  ],
  render(ctx, width, height, params, palette) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const cellSize = params.cellSize || 30;

    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = c2;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if ((row + col) % 2 === 1) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
  }
});
