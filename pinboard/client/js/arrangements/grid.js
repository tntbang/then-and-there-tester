// Grid arrangement implementation

import { registerArrangement, getPhotoCount } from './registry.js';
import { createRNG } from '../utils/random.js';

const FRAME_STYLES = ['borderless', 'bordered', 'polaroid', 'rounded', 'roundedBorderless', 'circle'];

export const gridSchema = {
  name: 'Grid',
  id: 'grid',
  photoCount: {
    type: 'computed',
    compute: (params) => (params.cols || 3) * (params.rows || 3)
  },
  params: [
    {
      id: 'cols',
      name: 'Columns',
      type: 'number',
      default: 3,
      min: 1,
      max: 10,
      step: 1
    },
    {
      id: 'rows',
      name: 'Rows',
      type: 'number',
      default: 7,
      min: 1,
      max: 10,
      step: 1
    },
    {
      id: 'photoSizePct',
      name: 'Photo Size %',
      type: 'number',
      default: 22,
      min: 5,
      max: 50,
      step: 1,
      suffix: '%'
    },
    {
      id: 'linkedSpacing',
      name: 'Link Spacing',
      type: 'boolean',
      default: true,
      description: 'Use same margin for horizontal and vertical'
    },
    {
      id: 'rotationMax',
      name: 'Rotation Range',
      type: 'number',
      default: 0,
      min: 0,
      max: 45,
      step: 1,
      suffix: '°'
    },
    {
      id: 'rotationPivot',
      name: 'Rotation Pivot',
      type: 'select',
      default: 'pin',
      options: [
        { value: 'pin', label: 'Pin Point' },
        { value: 'center', label: 'Center' }
      ],
      condition: 'rotationMax'
    },
    {
      id: 'frameStyles',
      name: 'Frame Styles',
      type: 'group',
      params: [
        {
          id: 'borderlessWeight',
          name: 'Borderless',
          type: 'weight',
          default: 1
        },
        {
          id: 'borderedWeight',
          name: 'Bordered',
          type: 'weight',
          default: 0
        },
        {
          id: 'polaroidWeight',
          name: 'Polaroid',
          type: 'weight',
          default: 0
        },
        {
          id: 'roundedWeight',
          name: 'Rounded',
          type: 'weight',
          default: 0
        },
        {
          id: 'roundedBorderlessWeight',
          name: 'Rounded Borderless',
          type: 'weight',
          default: 0
        },
        {
          id: 'circleWeight',
          name: 'Circle',
          type: 'weight',
          default: 0
        }
      ]
    },
    {
      id: 'borderPct',
      name: 'Border Size %',
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      step: 1,
      condition: { anyOf: ['borderedWeight', 'polaroidWeight', 'roundedWeight'] }
    },
    {
      id: 'polaroidMult',
      name: 'Polaroid Bottom Multiplier',
      type: 'number',
      default: 3.5,
      min: 2,
      max: 5,
      step: 0.5,
      condition: 'polaroidWeight'
    },
    {
      id: 'cornerRadius',
      name: 'Corner Radius %',
      type: 'number',
      default: 35,
      min: 5,
      max: 50,
      step: 5,
      condition: { anyOf: ['roundedWeight', 'roundedBorderlessWeight'] }
    },
    {
      id: 'borderColor',
      name: 'Border Color',
      type: 'palette-color',
      default: 'white'
    }
  ]
};

/**
 * Calculate grid layout positions
 * @param {number} boardWidth - Board width in pixels
 * @param {number} boardHeight - Board height in pixels
 * @param {Object} params - Arrangement parameters
 * @returns {{positions: Array, photoSize: number, error: string|null}}
 */
function calculateGridLayout(boardWidth, boardHeight, params) {
  const { cols, rows, photoSizePct, linkedSpacing } = params;

  if (cols < 1 || rows < 1) {
    return { positions: [], photoSize: 0, error: 'Columns and rows must be at least 1' };
  }

  // Photo size is based on percentage of smaller board dimension
  const minDimension = Math.min(boardWidth, boardHeight);
  const photoSize = minDimension * (photoSizePct / 100);

  // Calculate total space needed for photos
  const totalPhotoWidth = cols * photoSize;
  const totalPhotoHeight = rows * photoSize;

  // Check if photos fit
  if (totalPhotoWidth > boardWidth || totalPhotoHeight > boardHeight) {
    return { positions: [], photoSize: 0, error: 'Photos too large to fit on board' };
  }

  // Calculate gaps
  let hGap = (boardWidth - totalPhotoWidth) / (cols + 1);
  let vGap = (boardHeight - totalPhotoHeight) / (rows + 1);

  let hOffset, vOffset;

  if (linkedSpacing) {
    // Use the smaller gap for both, center the layout
    const gap = Math.min(hGap, vGap);
    hOffset = (boardWidth - (cols * photoSize + (cols - 1) * gap)) / 2;
    vOffset = (boardHeight - (rows * photoSize + (rows - 1) * gap)) / 2;
    hGap = gap;
    vGap = gap;
  } else {
    hOffset = hGap;
    vOffset = vGap;
  }

  // Generate positions
  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: hOffset + col * (photoSize + (linkedSpacing ? Math.min(hGap, vGap) : hGap)),
        y: vOffset + row * (photoSize + (linkedSpacing ? Math.min(hGap, vGap) : vGap)),
        size: photoSize
      });
    }
  }

  return { positions, photoSize, error: null };
}

/**
 * Assign frame styles to photos based on weights
 * @param {number} count - Number of photos
 * @param {Object} params - Parameters containing weights
 * @param {Object} rng - Seeded RNG instance
 * @returns {string[]} Array of frame style names
 */
function assignFrameStyles(count, params, rng) {
  const weights = [
    params.borderlessWeight || 0,
    params.borderedWeight || 0,
    params.polaroidWeight || 0,
    params.roundedWeight || 0,
    params.roundedBorderlessWeight || 0,
    params.circleWeight || 0
  ];

  // If all weights are 0, default to borderless
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return Array(count).fill('borderless');
  }

  return Array(count).fill(null).map(() => {
    const index = rng.randomWeighted(weights);
    return FRAME_STYLES[index];
  });
}

/**
 * Render the grid arrangement
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options
 * @param {Array} options.photos - Ordered photo objects
 * @param {Object} options.params - Arrangement parameters
 * @param {Object} options.globalParams - Global parameters
 * @param {Object} options.palette - Selected color palette
 * @param {number} options.boardWidth - Board width
 * @param {number} options.boardHeight - Board height
 * @param {Object} options.photoImages - Map of photo ID to loaded Image objects
 * @returns {{error: string|null}}
 */
function renderGrid(ctx, options) {
  const { photos, params, globalParams, palette, boardWidth, boardHeight, photoImages } = options;

  const requiredCount = getPhotoCount(gridSchema, params);
  if (photos.length < requiredCount) {
    return { error: `Need ${requiredCount} photos, have ${photos.length}` };
  }

  const layout = calculateGridLayout(boardWidth, boardHeight, params);
  if (layout.error) {
    return { error: layout.error };
  }

  const rng = createRNG(globalParams.seed);
  const frameStyles = assignFrameStyles(layout.positions.length, params, rng);

  // Generate per-photo rotation data
  const rotationMax = params.rotationMax || 0;
  const rotations = layout.positions.map(() => ({
    angle: rotationMax > 0 ? rng.randomFloat(-rotationMax, rotationMax) * (Math.PI / 180) : 0,
    pinX: rng.randomFloat(0.4, 0.6),
    pinY: rng.randomFloat(0.03, 0.10)
  }));

  // Get border color from palette
  const borderColor = getBorderColor(params.borderColor, palette);

  // Draw each photo
  for (let i = 0; i < layout.positions.length && i < photos.length; i++) {
    const pos = layout.positions[i];
    const photo = photos[i];
    const frameStyle = frameStyles[i];
    const img = photoImages[photo.id];

    if (!img) continue;

    drawFramedPhoto(ctx, {
      img,
      x: pos.x,
      y: pos.y,
      size: pos.size,
      frameStyle,
      borderColor,
      borderPct: params.borderPct || 5,
      polaroidMult: params.polaroidMult || 3,
      cornerRadius: params.cornerRadius || 10,
      focalPoint: photo.focalPoint || { x: 0.5, y: 0.5 },
      rotation: rotations[i].angle,
      rotationPivot: params.rotationPivot || 'pin',
      pivotPoint: { x: rotations[i].pinX, y: rotations[i].pinY },
      globalParams
    });
  }

  return { error: null };
}

/**
 * Get the actual color value from palette reference
 * @param {string|number} colorRef - Color reference (index or utility name)
 * @param {Object} palette - Palette object
 * @returns {string} Hex color value
 */
function getBorderColor(colorRef, palette) {
  if (!palette) return '#ffffff';

  if (typeof colorRef === 'number' && palette.colors && palette.colors[colorRef]) {
    return palette.colors[colorRef];
  }

  if (colorRef === 'white') return palette.utilities?.white || '#ffffff';
  if (colorRef === 'black') return palette.utilities?.black || '#000000';
  if (colorRef === 'neutral') return palette.utilities?.neutral || '#888888';

  return palette.colors?.[0] || '#ffffff';
}

/**
 * Draw a photo with its frame
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Drawing options
 */
function drawFramedPhoto(ctx, options) {
  const {
    img, x, y, size, frameStyle, borderColor,
    borderPct, polaroidMult, cornerRadius, focalPoint,
    rotation = 0, rotationPivot = 'center', pivotPoint = { x: 0.5, y: 0.5 },
    globalParams = {}
  } = options;

  ctx.save();

  // Apply rotation transform
  if (rotation !== 0) {
    let pivotX, pivotY;
    if (rotationPivot === 'pin') {
      pivotX = x + size * pivotPoint.x;
      pivotY = y + size * pivotPoint.y;
    } else {
      pivotX = x + size / 2;
      pivotY = y + size / 2;
    }
    ctx.translate(pivotX, pivotY);
    ctx.rotate(rotation);
    ctx.translate(-pivotX, -pivotY);
  }

  // Shadow setup
  const shadowEnabled = globalParams.shadowEnabled !== false;
  const borderSize = size * (borderPct / 100);

  function applyShadow() {
    if (shadowEnabled) {
      const opacity = (globalParams.shadowOpacity || 35) / 100;
      ctx.shadowColor = `rgba(0, 0, 0, ${opacity})`;
      ctx.shadowBlur = globalParams.shadowBlur || 8;
      ctx.shadowOffsetX = globalParams.shadowOffsetX || 3;
      ctx.shadowOffsetY = globalParams.shadowOffsetY || 4;
    }
  }

  function clearShadow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  let photoX = x;
  let photoY = y;
  let photoW = size;
  let photoH = size;

  switch (frameStyle) {
    case 'bordered':
      // Draw border rectangle with shadow
      applyShadow();
      ctx.fillStyle = borderColor;
      ctx.fillRect(x, y, size, size);
      clearShadow();
      // Inset photo area
      photoX = x + borderSize;
      photoY = y + borderSize;
      photoW = size - borderSize * 2;
      photoH = size - borderSize * 2;
      break;

    case 'polaroid': {
      // Draw polaroid frame with shadow
      const bottomBorder = borderSize * polaroidMult;
      applyShadow();
      ctx.fillStyle = borderColor;
      ctx.fillRect(x, y, size, size);
      clearShadow();
      // Inset photo area with larger bottom
      photoX = x + borderSize;
      photoY = y + borderSize;
      photoW = size - borderSize * 2;
      photoH = size - borderSize - bottomBorder;
      break;
    }

    case 'rounded': {
      // Draw shadow-casting rounded rect before clipping
      const radius = size * (cornerRadius / 100);
      applyShadow();
      ctx.beginPath();
      roundedRect(ctx, x, y, size, size, radius);
      ctx.fillStyle = borderColor;
      ctx.fill();
      clearShadow();
      // Now clip to rounded rect
      ctx.beginPath();
      roundedRect(ctx, x, y, size, size, radius);
      ctx.clip();
      // Draw border fill (already drawn above for shadow, but re-fill inside clip for clean edges)
      ctx.fillStyle = borderColor;
      ctx.fillRect(x, y, size, size);
      if (borderSize > 0) {
        photoX = x + borderSize;
        photoY = y + borderSize;
        photoW = size - borderSize * 2;
        photoH = size - borderSize * 2;
        // Re-clip for photo inset
        ctx.beginPath();
        roundedRect(ctx, photoX, photoY, photoW, photoH, Math.max(0, radius - borderSize));
        ctx.clip();
      }
      break;
    }

    case 'roundedBorderless': {
      // Draw shadow-casting rounded rect before clipping
      const rbRadius = size * (cornerRadius / 100);
      applyShadow();
      ctx.beginPath();
      roundedRect(ctx, x, y, size, size, rbRadius);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill();
      clearShadow();
      // Now clip to rounded rect
      ctx.beginPath();
      roundedRect(ctx, x, y, size, size, rbRadius);
      ctx.clip();
      // Photo fills entire area
      photoX = x;
      photoY = y;
      photoW = size;
      photoH = size;
      break;
    }

    case 'circle': {
      // Draw shadow-casting circle before clipping
      const circleRadius = size / 2;
      applyShadow();
      ctx.beginPath();
      ctx.arc(x + circleRadius, y + circleRadius, circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = borderSize > 0 ? borderColor : 'rgba(0,0,0,1)';
      ctx.fill();
      clearShadow();
      // Now clip to circle
      ctx.beginPath();
      ctx.arc(x + circleRadius, y + circleRadius, circleRadius, 0, Math.PI * 2);
      ctx.clip();
      // Draw border
      if (borderSize > 0) {
        ctx.fillStyle = borderColor;
        ctx.fillRect(x, y, size, size);
        // Smaller circle clip for photo
        ctx.beginPath();
        ctx.arc(x + circleRadius, y + circleRadius, circleRadius - borderSize, 0, Math.PI * 2);
        ctx.clip();
        photoX = x + borderSize;
        photoY = y + borderSize;
        photoW = size - borderSize * 2;
        photoH = size - borderSize * 2;
      }
      break;
    }

    case 'borderless':
    default:
      // Draw shadow-casting rect, then photo covers it
      applyShadow();
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(x, y, size, size);
      clearShadow();
      break;
  }

  // Calculate crop rectangle based on focal point
  const crop = calculateCrop(img.width, img.height, photoW / photoH, focalPoint.x, focalPoint.y);

  // Draw the photo (shadow already cleared)
  ctx.drawImage(
    img,
    crop.x, crop.y, crop.width, crop.height,
    photoX, photoY, photoW, photoH
  );

  ctx.restore();
}

/**
 * Calculate crop rectangle to maintain aspect ratio centered on focal point
 * @param {number} sourceW - Source image width
 * @param {number} sourceH - Source image height
 * @param {number} targetAspect - Target aspect ratio (width/height)
 * @param {number} focalX - Focal point X (0-1)
 * @param {number} focalY - Focal point Y (0-1)
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function calculateCrop(sourceW, sourceH, targetAspect, focalX, focalY) {
  const sourceAspect = sourceW / sourceH;

  let cropW, cropH;

  if (sourceAspect > targetAspect) {
    // Source is wider - crop width
    cropH = sourceH;
    cropW = sourceH * targetAspect;
  } else {
    // Source is taller - crop height
    cropW = sourceW;
    cropH = sourceW / targetAspect;
  }

  // Position crop centered on focal point
  let cropX = (sourceW * focalX) - (cropW / 2);
  let cropY = (sourceH * focalY) - (cropH / 2);

  // Clamp to image bounds
  cropX = Math.max(0, Math.min(sourceW - cropW, cropX));
  cropY = Math.max(0, Math.min(sourceH - cropH, cropY));

  return { x: cropX, y: cropY, width: cropW, height: cropH };
}

/**
 * Draw a rounded rectangle path
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 */
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Register the grid arrangement
registerArrangement({
  id: 'grid',
  name: 'Grid',
  schema: gridSchema,
  render: renderGrid
});

export default gridSchema;
