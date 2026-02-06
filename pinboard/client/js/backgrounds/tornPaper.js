// Torn paper background — jagged tear revealing under-layer

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'tornPaper',
  name: 'Torn Paper',
  category: 'decorative',
  schema: [
    { id: 'topColor', name: 'Top Layer', type: 'palette-color', default: 'white' },
    { id: 'bottomColor', name: 'Under Layer', type: 'palette-color', default: 0 },
    { id: 'tearWidth', name: 'Tear Width', type: 'number', default: 30, min: 10, max: 80, step: 5 },
    { id: 'roughness', name: 'Roughness', type: 'number', default: 50, min: 10, max: 100, step: 5, suffix: '%' },
    {
      id: 'tearSide', name: 'Tear Side', type: 'select', default: 'bottom',
      options: [
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' }
      ]
    },
    { id: 'showShadow', name: 'Paper Shadow', type: 'boolean', default: true }
  ],
  render(ctx, width, height, params, palette, rng) {
    const topColor = resolveColor(params.topColor, palette);
    const bottomColor = resolveColor(params.bottomColor, palette);
    const tearWidth = params.tearWidth || 30;
    const roughness = (params.roughness || 50) / 100;
    const tearSide = params.tearSide || 'bottom';
    const showShadow = params.showShadow !== false;

    // Fill with under layer
    ctx.fillStyle = bottomColor;
    ctx.fillRect(0, 0, width, height);

    // Generate jagged tear path
    const isHorizontal = tearSide === 'top' || tearSide === 'bottom';
    const maxDim = isHorizontal ? width : height;
    const points = [];
    const step = 3;

    for (let i = 0; i <= maxDim; i += step) {
      const jag = (rng.random() - 0.5) * tearWidth * roughness;
      points.push(jag);
    }

    // Draw top layer with torn edge
    ctx.beginPath();

    if (tearSide === 'bottom') {
      const baseY = height - tearWidth;
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, baseY);
      for (let i = points.length - 1; i >= 0; i--) {
        ctx.lineTo(i * step, baseY + points[i]);
      }
      ctx.closePath();
    } else if (tearSide === 'top') {
      const baseY = tearWidth;
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(i * step, baseY + points[i]);
      }
      ctx.lineTo(width, baseY);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
    } else if (tearSide === 'right') {
      const baseX = width - tearWidth;
      ctx.moveTo(0, 0);
      ctx.lineTo(baseX, 0);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(baseX + points[i], i * step);
      }
      ctx.lineTo(baseX, height);
      ctx.lineTo(0, height);
      ctx.closePath();
    } else {
      const baseX = tearWidth;
      ctx.moveTo(width, 0);
      ctx.lineTo(baseX, 0);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(baseX + points[i], i * step);
      }
      ctx.lineTo(baseX, height);
      ctx.lineTo(width, height);
      ctx.closePath();
    }

    // Shadow under the torn edge
    if (showShadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = tearSide === 'left' ? -3 : tearSide === 'right' ? 3 : 0;
      ctx.shadowOffsetY = tearSide === 'top' ? -3 : tearSide === 'bottom' ? 3 : 0;
      ctx.fillStyle = topColor;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = topColor;
      ctx.fill();
    }
  }
});
