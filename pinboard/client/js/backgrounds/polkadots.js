// Polka dots background

import { registerBackground } from './registry.js';
import { resolveColor, createTileable, fillWithPattern } from './bgUtils.js';

registerBackground({
  id: 'polkadots',
  name: 'Polka Dots',
  category: 'dots',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'dotColor', name: 'Dot Color', type: 'palette-color', default: 1 },
    { id: 'dotSize', name: 'Dot Size', type: 'number', default: 20, min: 5, max: 50, step: 1, unit: 'px' },
    { id: 'spacing', name: 'Spacing', type: 'number', default: 25, min: 10, max: 60, step: 1, unit: 'px' }
  ],
  render(ctx, width, height, params, palette) {
    const bgColor = resolveColor(params.bgColor, palette);
    const dotColor = resolveColor(params.dotColor, palette);
    const dotSize = params.dotSize || 20;
    const spacing = params.spacing || 25;

    const patternRepeat = dotSize + spacing;
    const repeatCount = Math.max(2, Math.min(8, Math.ceil(128 / patternRepeat)));
    const tileSize = patternRepeat * repeatCount;

    const tile = createTileable(tileSize, tileSize, (tCtx) => {
      tCtx.fillStyle = bgColor;
      tCtx.fillRect(0, 0, tileSize, tileSize);

      tCtx.fillStyle = dotColor;
      const radius = dotSize / 2;

      for (let y = 0; y < repeatCount; y++) {
        for (let x = 0; x < repeatCount; x++) {
          const cx = x * patternRepeat + patternRepeat / 2;
          const cy = y * patternRepeat + patternRepeat / 2;
          tCtx.beginPath();
          tCtx.arc(cx, cy, radius, 0, Math.PI * 2);
          tCtx.fill();
        }
      }
    });

    fillWithPattern(ctx, tile, width, height);
  }
});
