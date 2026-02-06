// Pinstripe background — thin lines on solid

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'pinstripe',
  name: 'Pin Stripe',
  category: 'stripes',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'lineColor', name: 'Line Color', type: 'palette-color', default: 1 },
    { id: 'lineWidth', name: 'Line Width', type: 'number', default: 1, min: 1, max: 4, step: 0.5, unit: 'px' },
    { id: 'spacing', name: 'Spacing', type: 'number', default: 12, min: 4, max: 40, step: 2, unit: 'px' },
    { id: 'angle', name: 'Angle', type: 'number', default: 0, min: 0, max: 180, step: 5, suffix: '°' }
  ],
  render(ctx, width, height, params, palette) {
    const bgColor = resolveColor(params.bgColor, palette);
    const lineColor = resolveColor(params.lineColor, palette);
    const lineW = params.lineWidth || 1;
    const spacing = params.spacing || 12;
    const angle = (params.angle ?? 0) * Math.PI / 180;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const diagonal = Math.sqrt(width * width + height * height);
    const count = Math.ceil(diagonal / spacing) + 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-angle);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineW;

    for (let i = -count; i < count; i++) {
      const x = i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, -diagonal);
      ctx.lineTo(x, diagonal);
      ctx.stroke();
    }

    ctx.restore();
  }
});
