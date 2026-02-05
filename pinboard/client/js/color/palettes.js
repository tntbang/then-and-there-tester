// Color harmony and variant palette generators

import {
  hexToHSL, hslToHex, shiftHue, adjustSaturation,
  adjustLightness, blendColors, getColorTemperature
} from './utils.js';

/**
 * Generate all palette options from extracted colors
 * @param {string[]} extractedColors - Raw extracted colors
 * @returns {Object[]} Array of palette objects
 */
export function generateAllPalettes(extractedColors) {
  if (!extractedColors || extractedColors.length === 0) {
    extractedColors = ['#e85d4c', '#e8944c', '#e8c84c', '#b8e84c', '#4ce885'];
  }

  const palettes = [];

  // Extracted palette (raw colors)
  palettes.push({
    name: 'Extracted',
    type: 'extraction',
    colors: extractedColors.slice(0, 5),
    utilities: generateUtilities(extractedColors.slice(0, 5))
  });

  // Get dominant hue for harmonies
  const dominantColor = extractedColors[0];
  const dominantHSL = hexToHSL(dominantColor);

  // Harmony palettes
  palettes.push(generateComplementary(dominantHSL));
  palettes.push(generateAnalogous(dominantHSL));
  palettes.push(generateTriadic(dominantHSL));
  palettes.push(generateSplitComplementary(dominantHSL));
  palettes.push(generateMonochromatic(dominantHSL));

  // Variant palettes
  palettes.push(generateMuted(extractedColors.slice(0, 5)));
  palettes.push(generateVintage(extractedColors.slice(0, 5)));
  palettes.push(generateValueStratified(extractedColors.slice(0, 5)));

  return palettes;
}

/**
 * Generate utility colors for a palette
 * @param {string[]} colors - Palette colors
 * @returns {{white: string, black: string, neutral: string}}
 */
export function generateUtilities(colors) {
  // Calculate average temperature of palette
  let avgTemp = 0;
  for (const color of colors) {
    avgTemp += getColorTemperature(color);
  }
  avgTemp /= colors.length;

  // Generate neutral based on temperature
  let neutral;
  if (avgTemp > 0.2) {
    // Warm palette - warm gray/beige
    neutral = '#9a9590';
  } else if (avgTemp < -0.2) {
    // Cool palette - cool gray
    neutral = '#858a90';
  } else {
    // Neutral - pure gray
    neutral = '#8a8a8a';
  }

  return {
    white: '#ffffff',
    black: '#000000',
    neutral
  };
}

/**
 * Generate complementary palette
 * @param {{h: number, s: number, l: number}} dominantHSL - Dominant color in HSL
 * @returns {Object} Palette object
 */
function generateComplementary(dominantHSL) {
  const { h, s, l } = dominantHSL;
  const complementH = (h + 180) % 360;

  const colors = [
    hslToHex(h, s, l),                           // Dominant
    hslToHex(complementH, s, l),                 // Complement
    hslToHex(h, Math.max(20, s - 20), l + 15),   // Tint of dominant
    hslToHex(complementH, Math.max(20, s - 20), l + 15), // Tint of complement
    hslToHex(h, Math.min(100, s + 10), Math.max(20, l - 15)) // Shade of dominant
  ];

  return {
    name: 'Complementary',
    type: 'complementary',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate analogous palette
 * @param {{h: number, s: number, l: number}} dominantHSL - Dominant color in HSL
 * @returns {Object} Palette object
 */
function generateAnalogous(dominantHSL) {
  const { h, s, l } = dominantHSL;

  const colors = [
    hslToHex((h - 60 + 360) % 360, s, l),
    hslToHex((h - 30 + 360) % 360, s, l),
    hslToHex(h, s, l),
    hslToHex((h + 30) % 360, s, l),
    hslToHex((h + 60) % 360, s, l)
  ];

  return {
    name: 'Analogous',
    type: 'analogous',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate triadic palette
 * @param {{h: number, s: number, l: number}} dominantHSL - Dominant color in HSL
 * @returns {Object} Palette object
 */
function generateTriadic(dominantHSL) {
  const { h, s, l } = dominantHSL;

  const colors = [
    hslToHex(h, s, l),                          // Primary
    hslToHex((h + 120) % 360, s, l),            // Secondary
    hslToHex((h + 240) % 360, s, l),            // Tertiary
    hslToHex(h, Math.max(20, s - 30), l + 20),  // Light tint
    hslToHex((h + 120) % 360, Math.max(20, s - 30), l + 20) // Light secondary
  ];

  return {
    name: 'Triadic',
    type: 'triadic',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate split-complementary palette
 * @param {{h: number, s: number, l: number}} dominantHSL - Dominant color in HSL
 * @returns {Object} Palette object
 */
function generateSplitComplementary(dominantHSL) {
  const { h, s, l } = dominantHSL;
  const split1 = (h + 150) % 360;
  const split2 = (h + 210) % 360;

  const colors = [
    hslToHex(h, s, l),                          // Dominant
    hslToHex(split1, s, l),                     // Split complement 1
    hslToHex(split2, s, l),                     // Split complement 2
    hslToHex(h, Math.max(20, s - 25), l + 18),  // Light dominant
    hslToHex(split1, Math.max(20, s - 25), l + 18) // Light split
  ];

  return {
    name: 'Split Complementary',
    type: 'split-complementary',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate monochromatic palette
 * @param {{h: number, s: number, l: number}} dominantHSL - Dominant color in HSL
 * @returns {Object} Palette object
 */
function generateMonochromatic(dominantHSL) {
  const { h, s } = dominantHSL;

  const colors = [
    hslToHex(h, s, 85),          // Lightest
    hslToHex(h, s, 65),          // Light
    hslToHex(h, s, 50),          // Medium
    hslToHex(h, s, 35),          // Dark
    hslToHex(h, s, 20)           // Darkest
  ];

  return {
    name: 'Monochromatic',
    type: 'monochromatic',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate muted variant
 * @param {string[]} baseColors - Base palette colors
 * @returns {Object} Palette object
 */
function generateMuted(baseColors) {
  const colors = baseColors.map(color => {
    // Reduce saturation by 30%
    let muted = adjustSaturation(color, -30);
    // Add slight warm undertone
    muted = blendColors(muted, '#f5e6d3', 0.1);
    return muted;
  });

  return {
    name: 'Muted',
    type: 'muted',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate vintage variant
 * @param {string[]} baseColors - Base palette colors
 * @returns {Object} Palette object
 */
function generateVintage(baseColors) {
  const colors = baseColors.map(color => {
    const hsl = hexToHSL(color);

    // Reduce saturation by 20%
    let s = Math.max(0, hsl.s - 20);

    // Warm shadows, cool highlights
    let l = hsl.l;
    if (l < 50) {
      // Shadows: add warmth
      return blendColors(hslToHex(hsl.h, s, l), '#8b7355', 0.15);
    } else {
      // Highlights: add slight cool tone
      return blendColors(hslToHex(hsl.h, s, l), '#e8e8f0', 0.1);
    }
  });

  return {
    name: 'Vintage',
    type: 'vintage',
    colors,
    utilities: generateUtilities(colors)
  };
}

/**
 * Generate value-stratified variant
 * Ensures: 1 light, 2 mid-tones, 1 dark, 1 accent
 * @param {string[]} baseColors - Base palette colors
 * @returns {Object} Palette object
 */
function generateValueStratified(baseColors) {
  // Sort by lightness
  const sorted = [...baseColors].map(c => ({
    hex: c,
    hsl: hexToHSL(c)
  })).sort((a, b) => b.hsl.l - a.hsl.l);

  const colors = [];

  // Light (high lightness, moderate saturation)
  colors.push(hslToHex(sorted[0].hsl.h, Math.min(60, sorted[0].hsl.s), 80));

  // Mid-tones
  const midIndex = Math.floor(sorted.length / 2);
  colors.push(hslToHex(sorted[midIndex].hsl.h, sorted[midIndex].hsl.s, 50));
  colors.push(hslToHex(sorted[Math.max(0, midIndex - 1)].hsl.h, sorted[Math.max(0, midIndex - 1)].hsl.s, 45));

  // Dark
  const darkest = sorted[sorted.length - 1];
  colors.push(hslToHex(darkest.hsl.h, darkest.hsl.s, 25));

  // Accent (most saturated, medium lightness)
  const mostSaturated = sorted.reduce((a, b) => a.hsl.s > b.hsl.s ? a : b);
  colors.push(hslToHex(mostSaturated.hsl.h, Math.min(100, mostSaturated.hsl.s + 10), 55));

  return {
    name: 'Value Stratified',
    type: 'value-stratified',
    colors,
    utilities: generateUtilities(colors)
  };
}
