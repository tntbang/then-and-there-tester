// Chevron background — zigzag pattern

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'chevron',
  name: 'Chevron',
  category: 'stripes',
  schema: [
    { id: 'color1', name: 'Color 1', type: 'palette-color', default: 0 },
    { id: 'color2', name: 'Color 2', type: 'palette-color', default: 1 },
    { id: 'width', name: 'Band Width', type: 'number', default: 24, min: 8, max: 60, step: 2 },
    { id: 'amplitude', name: 'Amplitude', type: 'number', default: 20, min: 5, max: 60, step: 2 },
    { id: 'horizontal', name: 'Horizontal', type: 'boolean', default: false }
  ],
  render(ctx, width, height, params, palette) {
    const c1 = resolveColor(params.color1, palette);
    const c2 = resolveColor(params.color2, palette);
    const bandW = params.width || 24;
    const amp = params.amplitude || 20;
    const horizontal = params.horizontal || false;

    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, width, height);

    const patternRepeat = bandW * 2;
    const maxDim = horizontal ? width : height;
    const crossDim = horizontal ? height : width;
    const bandCount = Math.ceil(maxDim / patternRepeat) + 2;

    ctx.fillStyle = c2;

    for (let i = -1; i < bandCount; i++) {
      const base = i * patternRepeat;

      ctx.beginPath();
      if (horizontal) {
        // Horizontal chevrons (zigzag left-right)
        for (let y = 0; y <= crossDim; y += amp * 2) {
          ctx.moveTo(base, y);
          ctx.lineTo(base + amp, y + amp);
          ctx.lineTo(base, y + amp * 2);
          ctx.lineTo(base + bandW, y + amp * 2);
          ctx.lineTo(base + bandW + amp, y + amp);
          ctx.lineTo(base + bandW, y);
          ctx.closePath();
        }
      } else {
        // Vertical chevrons (zigzag up-down)
        for (let x = 0; x <= crossDim; x += amp * 2) {
          ctx.moveTo(x, base);
          ctx.lineTo(x + amp, base + amp);
          ctx.lineTo(x + amp * 2, base);
          ctx.lineTo(x + amp * 2, base + bandW);
          ctx.lineTo(x + amp, base + bandW + amp);
          ctx.lineTo(x, base + bandW);
          ctx.closePath();
        }
      }
      ctx.fill();
    }
  }
});
