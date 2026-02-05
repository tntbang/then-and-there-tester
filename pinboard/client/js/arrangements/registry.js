// Arrangement plugin registry

const arrangements = {};

/**
 * Register a new arrangement
 * @param {Object} config - Arrangement configuration
 * @param {string} config.id - Unique identifier
 * @param {string} config.name - Display name
 * @param {Object} config.schema - Parameter schema
 * @param {Function} config.render - Render function
 */
export function registerArrangement(config) {
  if (!config.id || !config.name || !config.schema || !config.render) {
    throw new Error('Arrangement must have id, name, schema, and render');
  }
  arrangements[config.id] = config;
}

/**
 * Get an arrangement by ID
 * @param {string} id - Arrangement ID
 * @returns {Object|null} Arrangement configuration or null if not found
 */
export function getArrangement(id) {
  return arrangements[id] || null;
}

/**
 * List all registered arrangements
 * @returns {Object[]} Array of arrangement configurations
 */
export function listArrangements() {
  return Object.values(arrangements);
}

/**
 * Get default parameter values from a schema
 * @param {Object} schema - Arrangement schema
 * @returns {Object} Default parameter values
 */
export function getDefaultParams(schema) {
  const defaults = {};

  function processParams(params, prefix = '') {
    for (const param of params) {
      const key = prefix ? `${prefix}.${param.id}` : param.id;

      if (param.type === 'group' && param.params) {
        processParams(param.params, param.id);
      } else if (param.default !== undefined) {
        defaults[param.id] = param.default;
      }
    }
  }

  if (schema.params) {
    processParams(schema.params);
  }

  return defaults;
}

/**
 * Calculate required photo count from schema
 * @param {Object} schema - Arrangement schema
 * @param {Object} params - Current parameter values
 * @returns {number} Required photo count
 */
export function getPhotoCount(schema, params) {
  if (typeof schema.photoCount === 'number') {
    return schema.photoCount;
  }

  if (schema.photoCount && typeof schema.photoCount.compute === 'function') {
    return schema.photoCount.compute(params);
  }

  return 1;
}
