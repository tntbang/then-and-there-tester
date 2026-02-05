// Seeded random number generator using mulberry32 algorithm

/**
 * Create a seeded random number generator
 * @param {number} seed - Initial seed value
 * @returns {Object} RNG object with random methods
 */
export function createRNG(seed) {
  let state = seed >>> 0; // Convert to unsigned 32-bit integer

  /**
   * Mulberry32 PRNG - generates next random value
   * @returns {number} Random number between 0 and 1
   */
  function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in range [min, max] inclusive
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer
   */
  function randomInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  /**
   * Pick random element from array
   * @param {Array} array - Array to pick from
   * @returns {*} Random element
   */
  function randomChoice(array) {
    if (array.length === 0) return undefined;
    return array[Math.floor(random() * array.length)];
  }

  /**
   * Pick random index based on weights
   * @param {number[]} weights - Array of weights (will be normalized)
   * @returns {number} Selected index
   */
  function randomWeighted(weights) {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total === 0) return 0;

    let r = random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /**
   * Shuffle array in place using Fisher-Yates
   * @param {Array} array - Array to shuffle
   * @returns {Array} Same array, shuffled
   */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Generate random float in range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random float
   */
  function randomFloat(min, max) {
    return min + random() * (max - min);
  }

  /**
   * Reset the RNG with a new seed
   * @param {number} newSeed - New seed value
   */
  function setSeed(newSeed) {
    state = newSeed >>> 0;
  }

  return {
    random,
    randomInt,
    randomChoice,
    randomWeighted,
    shuffle,
    randomFloat,
    setSeed
  };
}

/**
 * Normalize an array of weights to sum to 1
 * @param {number[]} weights - Array of weights
 * @returns {number[]} Normalized weights
 */
export function normalizeWeights(weights) {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total === 0) return weights.map(() => 1 / weights.length);
  return weights.map(w => Math.max(0, w) / total);
}
