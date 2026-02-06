// Halftone background — size-varying dots

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'halftone',
  name: 'Halftone',
  category: 'dots',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'dotColor', name: 'Dot Color', type: 'palette-color', default: 1 },
    { id: 'gridSize', name: 'Grid Size', type: 'number', default: 12, min: 4, max: 30, step: 1, unit: 'px' },
    { id: 'minDot', name: 'Min Dot', type: 'number', default: 2, min: 1, max: 10, step: 1, unit: 'px' },
    { id: 'maxDot', name: 'Max Dot', type: 'number', default: 10, min: 3, max: 25, step: 1, unit: 'px' },
    {
      id: 'direction', name: 'Direction', type: 'select', default: 'radial',
      options: [
        { value: 'radial', label: 'Radial' },
        { value: 'diagonal', label: 'Diagonal' },
        { value: 'linear', label: 'Linear' }
      ]
    }
  ],
  render(ctx, width, height, params, palette) {
    const bgColor = resolveColor(params.bgColor, palette);
    const dotColor = resolveColor(params.dotColor, palette);
    const gridSize = params.gridSize || 12;
    const minDot = params.minDot || 2;
    const maxDot = params.maxDot || 10;
    const direction = params.direction || 'radial';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = dotColor;
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let y = gridSize / 2; y < height; y += gridSize) {
      for (let x = gridSize / 2; x < width; x += gridSize) {
        let t;
        if (direction === 'radial') {
          const dx = x - cx;
          const dy = y - cy;
          t = Math.sqrt(dx * dx + dy * dy) / maxDist;
        } else if (direction === 'diagonal') {
          t = (x + y) / (width + height);
        } else {
          t = x / width;
        }

        const radius = minDot + (maxDot - minDot) * (1 - t);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, radius / 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
});
