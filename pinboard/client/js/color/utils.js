// Color math utility functions

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color (with or without #)
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
export function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

/**
 * Convert RGB to hex color
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color with #
 */
export function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Convert hex color to HSL
 * @param {string} hex - Hex color
 * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s: 0-100, l: 0-100)
 */
export function hexToHSL(hex) {
  const { r, g, b } = hexToRGB(hex);
  return rgbToHSL(r, g, b);
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{h: number, s: number, l: number}} HSL values
 */
export function rgbToHSL(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color
 */
export function hslToHex(h, s, l) {
  const { r, g, b } = hslToRGB(h, s, l);
  return rgbToHex(r, g, b);
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
export function hslToRGB(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Adjust color saturation
 * @param {string} hex - Hex color
 * @param {number} amount - Amount to adjust (-100 to 100)
 * @returns {string} Adjusted hex color
 */
export function adjustSaturation(hex, amount) {
  const hsl = hexToHSL(hex);
  hsl.s = Math.max(0, Math.min(100, hsl.s + amount));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Adjust color lightness
 * @param {string} hex - Hex color
 * @param {number} amount - Amount to adjust (-100 to 100)
 * @returns {string} Adjusted hex color
 */
export function adjustLightness(hex, amount) {
  const hsl = hexToHSL(hex);
  hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Shift hue by degrees
 * @param {string} hex - Hex color
 * @param {number} degrees - Degrees to shift
 * @returns {string} Shifted hex color
 */
export function shiftHue(hex, degrees) {
  const hsl = hexToHSL(hex);
  hsl.h = (hsl.h + degrees + 360) % 360;
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

/**
 * Get contrasting text color (black or white)
 * @param {string} hex - Background hex color
 * @returns {string} '#000000' or '#ffffff'
 */
export function getContrastColor(hex) {
  const { r, g, b } = hexToRGB(hex);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Blend two colors
 * @param {string} hex1 - First hex color
 * @param {string} hex2 - Second hex color
 * @param {number} ratio - Blend ratio (0 = all hex1, 1 = all hex2)
 * @returns {string} Blended hex color
 */
export function blendColors(hex1, hex2, ratio) {
  const c1 = hexToRGB(hex1);
  const c2 = hexToRGB(hex2);

  return rgbToHex(
    c1.r + (c2.r - c1.r) * ratio,
    c1.g + (c2.g - c1.g) * ratio,
    c1.b + (c2.b - c1.b) * ratio
  );
}

/**
 * Get color temperature (warm/cool score)
 * @param {string} hex - Hex color
 * @returns {number} Temperature score (-1 = cool, 1 = warm)
 */
export function getColorTemperature(hex) {
  const { r, g, b } = hexToRGB(hex);
  // Simple heuristic: more red/yellow = warm, more blue = cool
  const warm = (r + g * 0.5) / 255;
  const cool = b / 255;
  return warm - cool;
}

/**
 * Calculate color distance (Euclidean in RGB space)
 * @param {string} hex1 - First hex color
 * @param {string} hex2 - Second hex color
 * @returns {number} Distance value
 */
export function colorDistance(hex1, hex2) {
  const c1 = hexToRGB(hex1);
  const c2 = hexToRGB(hex2);
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Check if color is considered neutral (low saturation)
 * @param {string} hex - Hex color
 * @param {number} threshold - Saturation threshold (default 15)
 * @returns {boolean} True if neutral
 */
export function isNeutral(hex, threshold = 15) {
  const { s } = hexToHSL(hex);
  return s < threshold;
}
