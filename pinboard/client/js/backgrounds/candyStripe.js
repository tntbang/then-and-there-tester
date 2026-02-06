// Candy stripe background — multi-color uneven stripes

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'candyStripe',
  name: 'Candy Stripe',
  category: 'stripes',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 1 },
    { id: 'color3', name: 'Color 3', type: 'palette-color', default: 2 },
    { id: 'width', name: 'Stripe Width', type: 'number', default: 20, min: 6, max: 60, step: 2 },
    { id: 'ratio', name: 'Width Ratio', type: 'number', default: 50, min: 20, max: 80, step: 5, suffix: '%' },
    { id: 'angle', name: 'Angle', type: 'number', default: 45, min: 0, max: 180, step: 5, suffix: '°' }
  ],
  render(ctx, width, height, params, palette) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const c3 = resolveColor(params.color3, palette);
    const stripeW = params.width || 20;
    const ratio = (params.ratio || 50) / 100;
    const angle = (params.angle ?? 45) * Math.PI / 180;

    // Three color repeating pattern: c1 (wide), c2 (narrow), c3 (narrow)
    const w1 = stripeW * ratio;
    const w2 = stripeW * (1 - ratio) / 2;
    const w3 = stripeW * (1 - ratio) / 2;
    const patternRepeat = stripeW;

    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    const diagonal = Math.sqrt(width * width + height * height);
    const count = Math.ceil(diagonal / patternRepeat) + 2;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-angle);

    for (let i = -count; i < count; i++) {
      const base = i * patternRepeat;
      // Color 2 stripe
      ctx.fillStyle = c2;
      ctx.fillRect(base + w1, -diagonal, w2, diagonal * 2);
      // Color 3 stripe
      ctx.fillStyle = c3;
      ctx.fillRect(base + w1 + w2, -diagonal, w3, diagonal * 2);
    }

    ctx.restore();
  }
});
