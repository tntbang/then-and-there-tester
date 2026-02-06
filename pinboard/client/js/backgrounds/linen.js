// Linen background — fabric crosshatch texture

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'linen',
  name: 'Linen',
  category: 'textures',
  schema: [
    { id: 'bgColor', name: 'Color', type: 'palette-color', default: 0 },
    { id: 'intensity', name: 'Intensity', type: 'number', default: 40, min: 10, max: 80, step: 5, suffix: '%' },
    { id: 'threadSpacing', name: 'Thread Spacing', type: 'number', default: 4, min: 2, max: 10, step: 1 }
  ],
  render(ctx, width, height, params, palette, rng) {
    const bgColor = resolveColor(params.bgColor, palette);
    const intensity = (params.intensity || 40) / 100;
    const spacing = params.threadSpacing || 4;
    const rgb = hexToRGB(bgColor);

    // Fill base
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw crosshatch threads as semi-transparent lines
    const threadAlpha = intensity * 0.3;

    // Horizontal threads
    ctx.strokeStyle = `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, ${threadAlpha})`;
    ctx.lineWidth = 0.5;
    for (let y = 0; y < height; y += spacing) {
      const offset = (rng.random() - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + offset);
      ctx.lineTo(width, y + offset);
      ctx.stroke();
    }

    // Vertical threads
    ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 20)}, ${Math.min(255, rgb.g + 20)}, ${Math.min(255, rgb.b + 20)}, ${threadAlpha * 0.8})`;
    for (let x = 0; x < width; x += spacing) {
      const offset = (rng.random() - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x + offset, height);
      ctx.stroke();
    }

    // Subtle noise overlay for fabric texture
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (rng.random() - 0.5) * 12 * intensity;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  }
});
