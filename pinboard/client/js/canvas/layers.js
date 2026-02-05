// Layer management for canvas rendering

/**
 * Layer configuration
 * Layers render from bottom (first) to top (last)
 */
const layers = [
  { id: 'background', name: 'Background', enabled: true, render: null },
  { id: 'photos', name: 'Photos', enabled: true, render: null },
  { id: 'overlay', name: 'Overlay', enabled: true, render: null }
];

/**
 * Register a render function for a layer
 * @param {string} layerId - Layer ID
 * @param {Function} renderFn - Render function (ctx, options) => void
 */
export function registerLayer(layerId, renderFn) {
  const layer = layers.find(l => l.id === layerId);
  if (layer) {
    layer.render = renderFn;
  }
}

/**
 * Enable or disable a layer
 * @param {string} layerId - Layer ID
 * @param {boolean} enabled - Whether layer is enabled
 */
export function setLayerEnabled(layerId, enabled) {
  const layer = layers.find(l => l.id === layerId);
  if (layer) {
    layer.enabled = enabled;
  }
}

/**
 * Get layer enabled state
 * @param {string} layerId - Layer ID
 * @returns {boolean} Whether layer is enabled
 */
export function isLayerEnabled(layerId) {
  const layer = layers.find(l => l.id === layerId);
  return layer ? layer.enabled : false;
}

/**
 * Render all enabled layers
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options passed to each layer
 */
export function renderLayers(ctx, options) {
  for (const layer of layers) {
    if (layer.enabled && layer.render) {
      ctx.save();
      try {
        layer.render(ctx, options);
      } catch (err) {
        console.error(`Error rendering layer ${layer.id}:`, err);
      }
      ctx.restore();
    }
  }
}

/**
 * Get list of all layers
 * @returns {Array<{id: string, name: string, enabled: boolean}>}
 */
export function getLayers() {
  return layers.map(l => ({
    id: l.id,
    name: l.name,
    enabled: l.enabled
  }));
}
