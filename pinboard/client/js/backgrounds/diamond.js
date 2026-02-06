// Diamond / Argyle background with optional stitch lines

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'diamond',
  name: 'Argyle',
  category: 'geometric',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 1 },
    { id: 'lineColor', name: 'Stitch Color', type: 'palette-color', default: 'white' },
    { id: 'cellSize', name: 'Diamond Size', type: 'number', default: 40, min: 15, max: 80, step: 5, unit: 'px' },
    { id: 'showLines', name: 'Show Stitches', type: 'boolean', default: true }
  ],
  render(ctx, width, height, params, palette, rng, scale = 1) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const lineColor = resolveColor(params.lineColor, palette);
    const cellSize = params.cellSize || 40;
    const showLines = params.showLines !== false;

    const halfW = cellSize;
    const halfH = cellSize * 1.5;

    // Fill background
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    // Draw diamonds
    ctx.fillStyle = c2;
    const cols = Math.ceil(width / halfW) + 2;
    const rows = Math.ceil(height / halfH) + 2;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * halfW + (row % 2 ? halfW / 2 : 0);
        const cy = row * halfH;

        ctx.beginPath();
        ctx.moveTo(cx, cy - halfH / 2);
        ctx.lineTo(cx + halfW / 2, cy);
        ctx.lineTo(cx, cy + halfH / 2);
        ctx.lineTo(cx - halfW / 2, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw stitch lines
    if (showLines) {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1 * scale;
      ctx.setLineDash([4 * scale, 4 * scale]);

      // Diagonal lines going both directions
      const diagonal = Math.sqrt(width * width + height * height);
      const spacing = halfW;

      ctx.save();
      ctx.translate(width / 2, height / 2);

      // Forward diagonals
      ctx.rotate(Math.atan2(halfH, halfW));
      const count = Math.ceil(diagonal / spacing) + 2;
      for (let i = -count; i < count; i++) {
        const x = i * spacing;
        ctx.beginPath();
        ctx.moveTo(x, -diagonal);
        ctx.lineTo(x, diagonal);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.atan2(halfH, halfW));
      for (let i = -count; i < count; i++) {
        const x = i * spacing;
        ctx.beginPath();
        ctx.moveTo(x, -diagonal);
        ctx.lineTo(x, diagonal);
        ctx.stroke();
      }
      ctx.restore();

      ctx.setLineDash([]);
    }
  }
});
