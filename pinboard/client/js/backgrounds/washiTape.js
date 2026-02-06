// Washi tape background — decorative semi-transparent bands

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

registerBackground({
  id: 'washiTape',
  name: 'Washi Tape',
  category: 'decorative',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 'white' },
    { id: 'tapeColor1', name: 'Tape Color 1', type: 'palette-color', default: 0 },
    { id: 'tapeColor2', name: 'Tape Color 2', type: 'palette-color', default: 1 },
    { id: 'tapeColor3', name: 'Tape Color 3', type: 'palette-color', default: 2 },
    { id: 'tapeCount', name: 'Tape Count', type: 'number', default: 5, min: 2, max: 12, step: 1 },
    { id: 'tapeWidth', name: 'Tape Width', type: 'number', default: 40, min: 15, max: 80, step: 5, unit: 'px' },
    { id: 'opacity', name: 'Opacity', type: 'number', default: 40, min: 10, max: 70, step: 5, suffix: '%' },
    { id: 'maxAngle', name: 'Max Angle', type: 'number', default: 15, min: 0, max: 45, step: 5, suffix: '°' }
  ],
  render(ctx, width, height, params, palette, rng, scale = 1) {
    const bgColor = resolveColor(params.bgColor, palette);
    const colors = [
      resolveColor(params.tapeColor1, palette),
      resolveColor(params.tapeColor2, palette),
      resolveColor(params.tapeColor3, palette)
    ];
    const tapeCount = params.tapeCount || 5;
    const tapeWidth = params.tapeWidth || 40;
    const opacity = (params.opacity || 40) / 100;
    const maxAngle = (params.maxAngle || 15) * Math.PI / 180;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const diagonal = Math.sqrt(width * width + height * height);

    for (let i = 0; i < tapeCount; i++) {
      const hex = rng.randomChoice(colors);
      const rgb = hexToRGB(hex);
      const angle = rng.randomFloat(-maxAngle, maxAngle);
      const yPos = rng.randomFloat(-tapeWidth, height + tapeWidth);

      ctx.save();
      ctx.translate(width / 2, yPos);
      ctx.rotate(angle);

      // Semi-transparent tape band
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      ctx.fillRect(-diagonal, -tapeWidth / 2, diagonal * 2, tapeWidth);

      // Subtle edge lines for tape look
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.5})`;
      ctx.lineWidth = 0.5 * scale;
      ctx.beginPath();
      ctx.moveTo(-diagonal, -tapeWidth / 2);
      ctx.lineTo(diagonal, -tapeWidth / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-diagonal, tapeWidth / 2);
      ctx.lineTo(diagonal, tapeWidth / 2);
      ctx.stroke();

      ctx.restore();
    }
  }
});
