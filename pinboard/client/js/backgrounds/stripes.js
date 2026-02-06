// Stripes background — even stripes with configurable angle

import { registerBackground } from './registry.js';
import { resolveColor, createTileable, fillWithPattern } from './bgUtils.js';

registerBackground({
  id: 'stripes',
  name: 'Stripes',
  category: 'stripes',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 1 },
    { id: 'width', name: 'Stripe Width', type: 'number', default: 20, min: 4, max: 60, step: 2, unit: 'px' },
    { id: 'angle', name: 'Angle', type: 'number', default: 45, min: 0, max: 180, step: 5, suffix: '°' }
  ],
  render(ctx, width, height, params, palette) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const stripeW = params.width || 20;
    const angle = (params.angle ?? 45) * Math.PI / 180;

    // Fill background with color1
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    // Draw stripes at angle
    const patternRepeat = stripeW * 2;
    const diagonal = Math.sqrt(width * width + height * height);
    const stripeCount = Math.ceil(diagonal / patternRepeat) + 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-angle);
    ctx.fillStyle = c2;

    for (let i = -stripeCount; i < stripeCount; i++) {
      const x = i * patternRepeat;
      ctx.fillRect(x, -diagonal, stripeW, diagonal * 2);
    }

    ctx.restore();
  }
});
