// Photo utility functions for cropping and drawing

/**
 * Calculate crop rectangle to maintain aspect ratio centered on focal point
 * @param {number} sourceW - Source image width
 * @param {number} sourceH - Source image height
 * @param {number} targetAspect - Target aspect ratio (width/height)
 * @param {number} focalX - Focal point X (0-1)
 * @param {number} focalY - Focal point Y (0-1)
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function calculateCrop(sourceW, sourceH, targetAspect, focalX = 0.5, focalY = 0.5) {
  const sourceAspect = sourceW / sourceH;

  let cropW, cropH;

  if (sourceAspect > targetAspect) {
    // Source is wider than target - crop width
    cropH = sourceH;
    cropW = sourceH * targetAspect;
  } else {
    // Source is taller than target - crop height
    cropW = sourceW;
    cropH = sourceW / targetAspect;
  }

  // Position crop centered on focal point
  let cropX = (sourceW * focalX) - (cropW / 2);
  let cropY = (sourceH * focalY) - (cropH / 2);

  // Clamp to image bounds
  cropX = Math.max(0, Math.min(sourceW - cropW, cropX));
  cropY = Math.max(0, Math.min(sourceH - cropH, cropY));

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropW),
    height: Math.round(cropH)
  };
}

/**
 * Draw a photo with cropping
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {HTMLImageElement} img - Image element
 * @param {Object} sourceRect - Source rectangle {x, y, width, height}
 * @param {Object} destRect - Destination rectangle {x, y, width, height}
 */
export function drawPhoto(ctx, img, sourceRect, destRect) {
  ctx.drawImage(
    img,
    sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height,
    destRect.x, destRect.y, destRect.width, destRect.height
  );
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
export function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Load an image from URL
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Load multiple images
 * @param {Object[]} photos - Photo objects with id and originalPath
 * @returns {Promise<Object>} Map of photo ID to Image element
 */
export async function loadPhotoImages(photos) {
  const imageMap = {};

  await Promise.all(photos.map(async (photo) => {
    try {
      const img = await loadImage(`/uploads/${photo.originalPath}`);
      imageMap[photo.id] = img;
    } catch (err) {
      console.warn(`Failed to load photo ${photo.id}:`, err);
    }
  }));

  return imageMap;
}

/**
 * Draw framed photo with specified style
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Drawing options
 * @param {HTMLImageElement} options.img - Image to draw
 * @param {number} options.x - X position
 * @param {number} options.y - Y position
 * @param {number} options.width - Frame width
 * @param {number} options.height - Frame height
 * @param {string} options.frameStyle - Frame style name
 * @param {string} options.borderColor - Border color
 * @param {number} options.borderPct - Border size as percentage
 * @param {number} options.polaroidMult - Polaroid bottom multiplier
 * @param {number} options.cornerRadius - Corner radius percentage
 * @param {Object} options.focalPoint - Focal point {x, y}
 * @returns {{photoX: number, photoY: number, photoW: number, photoH: number}} Photo area
 */
export function drawFramedPhoto(ctx, options) {
  const {
    img, x, y, width, height, frameStyle = 'borderless',
    borderColor = '#ffffff', borderPct = 5,
    polaroidMult = 3, cornerRadius = 10,
    focalPoint = { x: 0.5, y: 0.5 }
  } = options;

  ctx.save();

  let photoX = x;
  let photoY = y;
  let photoW = width;
  let photoH = height;

  // Calculate border size
  const borderSize = Math.min(width, height) * (borderPct / 100);

  switch (frameStyle) {
    case 'bordered':
      // Draw border rectangle
      ctx.fillStyle = borderColor;
      ctx.fillRect(x, y, width, height);
      // Inset photo area
      photoX = x + borderSize;
      photoY = y + borderSize;
      photoW = width - borderSize * 2;
      photoH = height - borderSize * 2;
      break;

    case 'polaroid':
      // Draw polaroid frame
      const bottomBorder = borderSize * polaroidMult;
      ctx.fillStyle = borderColor;
      ctx.fillRect(x, y, width, height);
      // Inset photo area with larger bottom
      photoX = x + borderSize;
      photoY = y + borderSize;
      photoW = width - borderSize * 2;
      photoH = height - borderSize - bottomBorder;
      break;

    case 'rounded':
      // Create rounded clipping path
      const radius = Math.min(width, height) * (cornerRadius / 100);
      roundedRect(ctx, x, y, width, height, radius);
      ctx.clip();
      // Draw border if needed
      if (borderPct > 0) {
        ctx.fillStyle = borderColor;
        ctx.fill();
        photoX = x + borderSize;
        photoY = y + borderSize;
        photoW = width - borderSize * 2;
        photoH = height - borderSize * 2;
        // Re-clip for photo
        ctx.beginPath();
        roundedRect(ctx, photoX, photoY, photoW, photoH, Math.max(0, radius - borderSize));
        ctx.clip();
      }
      break;

    case 'circle':
      // Create circular clipping path
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const circleRadius = Math.min(width, height) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
      ctx.clip();
      // Draw border
      if (borderPct > 0) {
        ctx.fillStyle = borderColor;
        ctx.fill();
        // Smaller circle for photo
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius - borderSize, 0, Math.PI * 2);
        ctx.clip();
        photoX = x + borderSize;
        photoY = y + borderSize;
        photoW = width - borderSize * 2;
        photoH = height - borderSize * 2;
      }
      break;

    case 'borderless':
    default:
      // No frame, use full size
      break;
  }

  // Calculate crop rectangle based on focal point
  const targetAspect = photoW / photoH;
  const crop = calculateCrop(img.width, img.height, targetAspect, focalPoint.x, focalPoint.y);

  // Draw the photo
  drawPhoto(ctx, img, crop, { x: photoX, y: photoY, width: photoW, height: photoH });

  ctx.restore();

  return { photoX, photoY, photoW, photoH };
}
