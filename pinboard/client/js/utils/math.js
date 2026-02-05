// Geometry and math helper utilities

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 * @param {number} value - Value to map
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number} Mapped value
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} Distance
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
export function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Check if a point is inside a rectangle
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} rx - Rectangle X
 * @param {number} ry - Rectangle Y
 * @param {number} rw - Rectangle width
 * @param {number} rh - Rectangle height
 * @returns {boolean} True if point is inside
 */
export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Calculate rectangle that fits inside container while maintaining aspect ratio
 * @param {number} containerWidth - Container width
 * @param {number} containerHeight - Container height
 * @param {number} contentAspect - Content aspect ratio (width/height)
 * @returns {{x: number, y: number, width: number, height: number}} Fitted rectangle
 */
export function fitRect(containerWidth, containerHeight, contentAspect) {
  const containerAspect = containerWidth / containerHeight;

  let width, height;
  if (contentAspect > containerAspect) {
    // Content is wider than container
    width = containerWidth;
    height = containerWidth / contentAspect;
  } else {
    // Content is taller than container
    height = containerHeight;
    width = containerHeight * contentAspect;
  }

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height
  };
}

/**
 * Calculate rectangle that fills container while maintaining aspect ratio (cover)
 * @param {number} containerWidth - Container width
 * @param {number} containerHeight - Container height
 * @param {number} contentAspect - Content aspect ratio (width/height)
 * @returns {{x: number, y: number, width: number, height: number}} Cover rectangle
 */
export function coverRect(containerWidth, containerHeight, contentAspect) {
  const containerAspect = containerWidth / containerHeight;

  let width, height;
  if (contentAspect > containerAspect) {
    // Content is wider than container
    height = containerHeight;
    width = containerHeight * contentAspect;
  } else {
    // Content is taller than container
    width = containerWidth;
    height = containerWidth / contentAspect;
  }

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height
  };
}

/**
 * Round a number to specified decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded value
 */
export function roundTo(value, decimals) {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
