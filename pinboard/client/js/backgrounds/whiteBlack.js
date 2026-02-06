// White and Black backgrounds

import { registerBackground } from './registry.js';

registerBackground({
  id: 'white',
  name: 'White',
  category: 'basics',
  schema: [],
  render(ctx, width, height) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
});

registerBackground({
  id: 'black',
  name: 'Black',
  category: 'basics',
  schema: [],
  render(ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
});
