// Scattered shapes background — stars, hearts, Xs, circles

import { registerBackground } from './registry.js';
import { resolveColor } from './bgUtils.js';
import { hexToRGB } from '../color/utils.js';

function drawStar(ctx, cx, cy, size) {
  const spikes = 5;
  const outerR = size;
  const innerR = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHeart(ctx, cx, cy, size) {
  const s = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.7);
  ctx.bezierCurveTo(cx - s, cy, cx - s, cy - s * 0.7, cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s, cy - s * 0.7, cx + s, cy, cx, cy + s * 0.7);
  ctx.closePath();
}

function drawX(ctx, cx, cy, size) {
  const s = size * 0.7;
  const w = size * 0.2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-w / 2, -s, w, s * 2);
  ctx.fillRect(-s, -w / 2, s * 2, w);
  ctx.restore();
}

function drawCircle(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.6, 0, Math.PI * 2);
  ctx.closePath();
}

registerBackground({
  id: 'scatteredShapes',
  name: 'Scattered Shapes',
  category: 'decorative',
  schema: [
    { id: 'bgColor', name: 'Background', type: 'palette-color', default: 0 },
    { id: 'shapeColor1', name: 'Shape Color 1', type: 'palette-color', default: 1 },
    { id: 'shapeColor2', name: 'Shape Color 2', type: 'palette-color', default: 2 },
    { id: 'density', name: 'Density', type: 'number', default: 40, min: 10, max: 100, step: 5 },
    { id: 'shapeSize', name: 'Shape Size', type: 'number', default: 12, min: 5, max: 30, step: 1, unit: 'px' },
    {
      id: 'shapeType', name: 'Shape', type: 'select', default: 'stars',
      options: [
        { value: 'stars', label: 'Stars' },
        { value: 'hearts', label: 'Hearts' },
        { value: 'xs', label: 'Xs' },
        { value: 'circles', label: 'Circles' }
      ]
    },
    { id: 'opacity', name: 'Opacity', type: 'number', default: 60, min: 10, max: 100, step: 5, suffix: '%' }
  ],
  render(ctx, width, height, params, palette, rng) {
    const bgColor = resolveColor(params.bgColor, palette);
    const sc1 = resolveColor(params.shapeColor1, palette);
    const sc2 = resolveColor(params.shapeColor2, palette);
    const density = params.density || 40;
    const shapeSize = params.shapeSize || 12;
    const shapeType = params.shapeType || 'stars';
    const opacity = (params.opacity || 60) / 100;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const area = width * height;
    const count = Math.round(density * (area / (400 * 400)));
    const colors = [sc1, sc2];

    const drawFns = {
      stars: drawStar,
      hearts: drawHeart,
      xs: drawX,
      circles: drawCircle
    };
    const drawFn = drawFns[shapeType] || drawStar;

    for (let i = 0; i < count; i++) {
      const x = rng.randomFloat(0, width);
      const y = rng.randomFloat(0, height);
      const size = shapeSize * rng.randomFloat(0.6, 1.4);
      const rotation = rng.randomFloat(0, Math.PI * 2);
      const hex = rng.randomChoice(colors);
      const rgb = hexToRGB(hex);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.translate(-x, -y);

      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;

      if (shapeType === 'xs') {
        drawX(ctx, x, y, size);
      } else {
        drawFn(ctx, x, y, size);
        ctx.fill();
      }

      ctx.restore();
    }
  }
});
