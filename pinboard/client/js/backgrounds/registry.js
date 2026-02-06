// Background plugin registry

const backgrounds = {};

const CATEGORIES = ['basics', 'dots', 'stripes', 'textures', 'geometric', 'decorative'];

/**
 * Register a new background
 * @param {Object} config - Background configuration
 * @param {string} config.id - Unique identifier
 * @param {string} config.name - Display name
 * @param {string} config.category - Category ('basics', 'dots', 'stripes', 'textures', 'geometric', 'decorative')
 * @param {Array} config.schema - Parameter schema array
 * @param {Function} config.render - Render function (ctx, width, height, params, palette, rng)
 */
export function registerBackground(config) {
  if (!config.id || !config.name || !config.category || !config.render) {
    throw new Error('Background must have id, name, category, and render');
  }
  backgrounds[config.id] = config;
}

/**
 * Get a background by ID
 * @param {string} id - Background ID
 * @returns {Object|null} Background configuration or null
 */
export function getBackground(id) {
  return backgrounds[id] || null;
}

/**
 * List all registered backgrounds
 * @returns {Object[]} Array of background configurations
 */
export function listBackgrounds() {
  return Object.values(backgrounds);
}

/**
 * Get backgrounds filtered by category
 * @param {string} category - Category name
 * @returns {Object[]} Filtered backgrounds
 */
export function getBackgroundsByCategory(category) {
  return Object.values(backgrounds).filter(bg => bg.category === category);
}

/**
 * Get default parameter values from a background's schema
 * @param {string} id - Background ID
 * @returns {Object} Default parameter values
 */
export function getBackgroundDefaults(id) {
  const bg = backgrounds[id];
  if (!bg || !bg.schema) return {};

  const defaults = {};
  for (const param of bg.schema) {
    if (param.default !== undefined) {
      defaults[param.id] = param.default;
    }
  }
  return defaults;
}

/**
 * Get ordered list of categories
 * @returns {string[]} Category names
 */
export function getBackgroundCategories() {
  return [...CATEGORIES];
}
