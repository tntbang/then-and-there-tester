// Main canvas render orchestrator

import { getState, subscribe } from '../state.js';
import { getArrangement, getPhotoCount } from '../arrangements/registry.js';
import { registerLayer, renderLayers } from './layers.js';
import { getBackground, getBackgroundDefaults } from '../backgrounds/index.js';
import { createRNG } from '../utils/random.js';
import { loadPhotoImages } from './photoUtils.js';

// Canvas references
let canvas = null;
let ctx = null;
let containerEl = null;

// Cached data
let photoImages = {};

// Render state
let renderScheduled = false;
let lastRenderParams = null;
let lastOrientation = null;

// Constants
const IPHONE_ASPECT = 2.17; // iPhone standard aspect ratio

/**
 * Initialize the renderer
 * @param {HTMLCanvasElement} canvasEl - Canvas element
 * @param {HTMLElement} container - Container element
 */
export function initRenderer(canvasEl, container) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  containerEl = container;
  lastOrientation = null;

  // Register layer renderers
  registerLayer('background', renderBackground);
  registerLayer('photos', renderPhotos);

  // Subscribe to state changes
  subscribe(scheduleRender);

  // Handle window resize
  window.addEventListener('resize', handleResize);

  // Initial size setup
  handleResize();
}

/**
 * Handle container resize
 */
function handleResize() {
  if (!containerEl || !canvas) return;

  const state = getState();
  const isPortrait = state.globalParams.orientation === 'portrait';
  const aspectRatio = state.globalParams.aspectRatio || IPHONE_ASPECT;

  // Get container dimensions with padding
  const containerRect = containerEl.getBoundingClientRect();
  const maxWidth = containerRect.width - 48;
  const maxHeight = containerRect.height - 48;

  // Calculate canvas size to fit container
  let width, height;

  if (isPortrait) {
    // Portrait: height / width = aspectRatio
    if (maxHeight / maxWidth > aspectRatio) {
      // Container is taller - fit to width
      width = maxWidth;
      height = width * aspectRatio;
    } else {
      // Container is wider - fit to height
      height = maxHeight;
      width = height / aspectRatio;
    }
  } else {
    // Landscape: width / height = aspectRatio
    if (maxWidth / maxHeight > aspectRatio) {
      // Container is wider - fit to height
      height = maxHeight;
      width = height * aspectRatio;
    } else {
      // Container is taller - fit to width
      width = maxWidth;
      height = width / aspectRatio;
    }
  }

  // Apply device pixel ratio for sharp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale context for DPR
  ctx.scale(dpr, dpr);

  // Store actual dimensions for rendering
  canvas.displayWidth = width;
  canvas.displayHeight = height;

  scheduleRender();
}

/**
 * Schedule a render on next animation frame
 */
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;

  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

/**
 * Main render function
 */
async function render() {
  if (!canvas || !ctx) return;

  const state = getState();

  // Check if orientation changed - need to resize canvas
  if (lastOrientation !== state.globalParams.orientation) {
    lastOrientation = state.globalParams.orientation;
    handleResize();
    return; // handleResize calls scheduleRender, which will call render() again
  }

  // Check if we need to reload images
  const currentPhotoIds = state.photos.map(p => p.id).join(',');
  if (lastRenderParams?.photoIds !== currentPhotoIds) {
    photoImages = await loadPhotoImages(state.photos);
  }

  lastRenderParams = {
    photoIds: currentPhotoIds
  };

  // Clear canvas
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // Get board dimensions
  const boardWidth = canvas.displayWidth;
  const boardHeight = canvas.displayHeight;

  // Get ordered photos
  const orderedPhotos = getOrderedPhotos(state);

  // Render all layers
  const renderOptions = {
    boardWidth,
    boardHeight,
    photos: orderedPhotos,
    photoImages,
    globalParams: state.globalParams,
    arrangementParams: state.arrangementParams,
    palette: state.palette,
    arrangement: getArrangement(state.arrangementId)
  };

  renderLayers(ctx, renderOptions);
}

/**
 * Get photos in their display order
 * @param {Object} state - Application state
 * @returns {Array} Ordered photo objects
 */
function getOrderedPhotos(state) {
  const photoMap = new Map(state.photos.map(p => [p.id, p]));
  return state.photoOrder.map(id => photoMap.get(id)).filter(Boolean);
}

/**
 * Render background layer using the background plugin system
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options
 */
function renderBackground(ctx, options) {
  const { boardWidth, boardHeight, globalParams, palette } = options;

  const state = getState();
  const bgId = state.backgroundId || 'solid';
  const bg = getBackground(bgId);

  if (!bg) {
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, boardWidth, boardHeight);
    return;
  }

  // Merge stored params with defaults
  const defaults = getBackgroundDefaults(bgId);
  const params = { ...defaults, ...state.backgroundParams };

  // Create seeded RNG for deterministic rendering
  const seed = globalParams?.seed || 12345;
  const rng = createRNG(seed);

  bg.render(ctx, boardWidth, boardHeight, params, palette, rng);
}

/**
 * Render photos layer
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options
 */
function renderPhotos(ctx, options) {
  const { arrangement, photos, photoImages, arrangementParams, globalParams, palette, boardWidth, boardHeight } = options;

  if (!arrangement || !arrangement.render) {
    return;
  }

  // Check photo count
  const requiredCount = getPhotoCount(arrangement.schema, arrangementParams);
  if (photos.length < requiredCount) {
    // Draw placeholder message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Need ${requiredCount - photos.length} more photo${requiredCount - photos.length > 1 ? 's' : ''}`,
      boardWidth / 2,
      boardHeight / 2
    );
    return;
  }

  // Call arrangement render function
  const result = arrangement.render(ctx, {
    photos,
    params: arrangementParams,
    globalParams,
    palette,
    boardWidth,
    boardHeight,
    photoImages
  });

  if (result?.error) {
    // Draw error message
    ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(result.error, boardWidth / 2, boardHeight / 2);
  }
}

/**
 * Resolution presets (short side in pixels)
 */
const EXPORT_RESOLUTIONS = {
  preview: 400,
  hd: 1290,
  '2k': 2000,
  '4k': 3000
};

/**
 * Render at specified resolution for export
 * @param {string} resolution - Resolution preset key
 * @returns {HTMLCanvasElement} Rendered canvas
 */
export async function renderForExport(resolution = '2k') {
  const state = getState();

  const exportCanvas = document.createElement('canvas');
  const isPortrait = state.globalParams.orientation === 'portrait';
  const aspectRatio = state.globalParams.aspectRatio || IPHONE_ASPECT;

  // Get short side from resolution preset
  const shortSide = EXPORT_RESOLUTIONS[resolution] || EXPORT_RESOLUTIONS['2k'];

  let width, height;
  if (isPortrait) {
    width = shortSide;
    height = Math.round(shortSide * aspectRatio);
  } else {
    height = shortSide;
    width = Math.round(shortSide * aspectRatio);
  }

  exportCanvas.width = width;
  exportCanvas.height = height;

  const exportCtx = exportCanvas.getContext('2d');

  // Get ordered photos
  const orderedPhotos = getOrderedPhotos(state);

  // Render all layers
  const renderOptions = {
    boardWidth: width,
    boardHeight: height,
    photos: orderedPhotos,
    photoImages,
    globalParams: state.globalParams,
    arrangementParams: state.arrangementParams,
    palette: state.palette,
    arrangement: getArrangement(state.arrangementId)
  };

  renderLayers(exportCtx, renderOptions);

  return exportCanvas;
}

/**
 * Force a re-render
 */
export function forceRender() {
  lastRenderParams = null;
  scheduleRender();
}
