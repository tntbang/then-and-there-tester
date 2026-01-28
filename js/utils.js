/**
 * utils.js - Shared utility functions
 */

/**
 * Seeded random number generator for reproducible results
 */
export class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  // Returns float between 0 and 1
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  // Returns float between min and max
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Returns integer between min and max (inclusive)
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between a and b
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Shuffle an array using Fisher-Yates with seeded random
 */
export function shuffleArray(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Convert degrees to radians
 */
export function toRad(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Haversine distance calculation in kilometers
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Euclidean distance between two points
 */
export function dist(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
