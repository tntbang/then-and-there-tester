// Solid color background

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';

registerBackground({
  id: 'solid',
  name: 'Solid',
  category: 'basics',
  schema: [
    { id: 'bgColor', name: 'Color', type: 'palette-color', default: 0 }
  ],
  render(ctx, width, height, params, palette) {
    ctx.fillStyle = resolveColor(params.bgColor, palette);
    ctx.fillRect(0, 0, width, height);
  }
});
