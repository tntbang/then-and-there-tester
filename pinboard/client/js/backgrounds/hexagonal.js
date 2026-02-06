// Hexagonal / Honeycomb background

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'hexagonal',
  name: 'Honeycomb',
  category: 'geometric',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'lineColor', name: 'Line Color', type: 'palette-color', default: 1 },
    { id: 'hexSize', name: 'Hex Size', type: 'number', default: 25, min: 10, max: 60, step: 2 },
    { id: 'lineWidth', name: 'Line Width', type: 'number', default: 2, min: 1, max: 5, step: 0.5 },
    { id: 'filled', name: 'Filled', type: 'boolean', default: false },
    { id: 'fillOpacity', name: 'Fill Opacity', type: 'number', default: 20, min: 5, max: 60, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette) {
    const bgColor = resolveColor(params.bgColor, palette);
    const lineHex = resolveColor(params.lineColor, palette);
    const rgb = hexToRGB(lineHex);
    const size = params.hexSize || 25;
    const lineW = params.lineWidth || 2;
    const filled = params.filled || false;
    const fillOpacity = (params.fillOpacity || 20) / 100;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const hexW = size * 2;
    const hexH = size * Math.sqrt(3);
    const cols = Math.ceil(width / (hexW * 0.75)) + 2;
    const rows = Math.ceil(height / hexH) + 2;

    function drawHex(cx, cy) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 6;
        const hx = cx + size * Math.cos(angle);
        const hy = cy + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    }

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * hexW * 0.75;
        const cy = row * hexH + (col % 2 ? hexH / 2 : 0);

        drawHex(cx, cy);

        if (filled) {
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
          ctx.fill();
        }

        ctx.strokeStyle = lineHex;
        ctx.lineWidth = lineW;
        ctx.stroke();
      }
    }
  }
});
