// Graph paper background — grid lines with major/minor

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'graphPaper',
  name: 'Graph Paper',
  category: 'geometric',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 'white' },
    { id: 'lineColor', name: 'Line Color', type: 'palette-color', default: 0 },
    { id: 'cellSize', name: 'Cell Size', type: 'number', default: 20, min: 8, max: 50, step: 2, unit: 'px' },
    { id: 'lineWidth', name: 'Line Width', type: 'number', default: 1, min: 0.5, max: 3, step: 0.5, unit: 'px' },
    { id: 'opacity', name: 'Opacity', type: 'number', default: 30, min: 5, max: 80, step: 5, suffix: '%' },
    { id: 'majorEvery', name: 'Major Every', type: 'number', default: 5, min: 0, max: 10, step: 1 }
  ],
  render(ctx, width, height, params, palette) {
    const bgColor = resolveColor(params.bgColor, palette);
    const lineHex = resolveColor(params.lineColor, palette);
    const rgb = hexToRGB(lineHex);
    const cellSize = params.cellSize || 20;
    const lineW = params.lineWidth || 1;
    const opacity = (params.opacity || 30) / 100;
    const majorEvery = params.majorEvery || 5;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Minor grid lines
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    ctx.lineWidth = lineW;

    for (let x = 0; x <= width; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Major grid lines (thicker)
    if (majorEvery > 0) {
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, opacity * 2)})`;
      ctx.lineWidth = lineW * 2;
      const majorSize = cellSize * majorEvery;

      for (let x = 0; x <= width; x += majorSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += majorSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }
});
