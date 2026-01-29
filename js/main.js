/**
 * main.js - Wire everything together, handle UI interactions
 * Edge Snap v3 / v3.1 (Zoom) Layout Algorithm
 */

import { initPhotoLoader, getPhotos, clearPhotos, loadSamplePhotos } from './photoLoader.js';
import { clusterPhotos } from './clustering.js';
import { initMap, renderMapSnapshot, setMapStyle, MAP_STYLES } from './mapRenderer.js';
import { renderCollage, renderCollageWithViewport, saveAsPng } from './collageRenderer.js';
import { runAlgorithm } from './algorithms/index.js';
import { SeededRandom } from './utils.js';

// Application state
const state = {
  photos: [],
  clusters: [],
  config: {
    algorithm: 'edgeSnapZoom',  // Use v3.1 with viewport zoom by default
    canvas: {
      aspectRatio: 2.17,
      width: 1000,
      height: 2170
    },
    clustering: {
      epsilon: 1.0,
      minPoints: 2,
      adaptive: true
    },
    layout: {
      mapStyle: 'cartodb_voyager',
      // Edge Snap v3/v3.1 params
      ellipseMult: 2.17,
      photoCountExp: 0.5,
      radiusMult: 1.0,
      maxRadiusPercent: 0.40,  // 40% of smaller canvas dimension
      mapSizeMult: 1.0,
      heroSizeRatio: 0.05,  // 5% for v3.1 (relative to master canvas)
      sizeStepRatio: 0.25,
      mediumProbabilityEarly: 0.85,
      mediumProbabilityLate: 0.40,
      placementAttempts: 40,
      imageSpread: 0.85,
      rotationRange: 0,
      edgeOverflowMode: 'crop',
      masterScale: 2  // v3.1: master canvas is 2× final output
    },
    seed: 4821
  },
  debug: {
    showClusters: false,
    showEllipses: false,
    showBboxes: false,
    showPins: false,
    showBounds: false,
    showViewport: false  // v3.1: show viewport debug overlay
  },
  mapImage: null,
  lastPlacements: null  // Store for viewport-based rendering
};

// DOM elements
let canvas, statusBar;

/**
 * Get current canvas size from config
 */
function getCanvasSize() {
  return {
    width: state.config.canvas.width,
    height: state.config.canvas.height
  };
}

/**
 * Update canvas dimensions based on aspect ratio
 */
function updateCanvasDimensions() {
  const baseWidth = 1000;
  const aspectRatio = state.config.canvas.aspectRatio;

  state.config.canvas.width = baseWidth;
  state.config.canvas.height = Math.round(baseWidth * aspectRatio);

  if (canvas) {
    canvas.width = state.config.canvas.width;
    canvas.height = state.config.canvas.height;
  }
}

/**
 * Update status bar message
 */
function setStatus(message) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
  }
  console.log('Status:', message);
}

/**
 * Re-run clustering when clustering parameters change
 */
function runClustering() {
  if (state.photos.length === 0) {
    state.clusters = [];
    return;
  }

  const { epsilon, minPoints, adaptive } = state.config.clustering;
  state.clusters = clusterPhotos(state.photos, epsilon, minPoints, adaptive);

  setStatus(`Clustered into ${state.clusters.length} groups`);
}

/**
 * Render the map based on current clusters
 * For v3.1: renders at max viewport size so zooming out still shows the map
 */
async function renderMap() {
  if (state.clusters.length === 0) {
    state.mapImage = null;
    return;
  }

  const canvasSize = getCanvasSize();
  const { algorithm, layout } = state.config;
  setStatus('Rendering map...');

  try {
    if (algorithm === 'edgeSnapZoom') {
      // v3.1: Render map at max viewport size (to support full zoom-out)
      // When mapSizeMult = 2.0 (max), viewport is 4× final canvas size
      // Map must be large enough to cover this viewport
      const masterScale = layout.masterScale || 2;
      const maxMapSizeMult = 2.0;  // Match the max value of the mapSizeMult slider
      const mapScale = masterScale * maxMapSizeMult;
      state.mapImage = await renderMapSnapshot(
        state.clusters,
        canvasSize.width * mapScale,
        canvasSize.height * mapScale,
        0.1  // Less padding - the viewport handles the zoom
      );
    } else {
      // v3: Render at final canvas size with zoom affecting padding
      const zoomMult = layout.mapSizeMult;
      state.mapImage = await renderMapSnapshot(
        state.clusters,
        canvasSize.width,
        canvasSize.height,
        0.3,
        zoomMult
      );
    }
    setStatus('Map rendered');
  } catch (e) {
    console.error('Map render error:', e);
    state.mapImage = null;
    setStatus('Map render failed');
  }
}

/**
 * Run the layout algorithm and render collage
 */
function renderLayout() {
  if (!canvas) return;

  const { algorithm, layout, seed } = state.config;
  const canvasSize = getCanvasSize();
  const mapRect = { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height };
  const rng = new SeededRandom(seed);

  // Get photos with location
  const photosWithLocation = state.photos.filter(p => p.hasLocation);

  if (photosWithLocation.length === 0 && state.photos.length > 0) {
    setStatus('No photos with GPS data');
    return;
  }

  // Run algorithm with Edge Snap v3/v3.1 parameters
  const placements = runAlgorithm(
    algorithm,
    photosWithLocation,
    state.clusters,
    {
      // Edge Snap v3/v3.1 params
      ellipseMult: layout.ellipseMult,
      photoCountExp: layout.photoCountExp,
      radiusMult: layout.radiusMult,
      maxRadiusPercent: layout.maxRadiusPercent,
      mapSizeMult: layout.mapSizeMult,
      heroSizeRatio: layout.heroSizeRatio,
      sizeStepRatio: layout.sizeStepRatio,
      mediumProbabilityEarly: layout.mediumProbabilityEarly,
      mediumProbabilityLate: layout.mediumProbabilityLate,
      placementAttempts: layout.placementAttempts,
      imageSpread: layout.imageSpread,
      rotationRange: layout.rotationRange,
      edgeOverflowMode: layout.edgeOverflowMode,
      masterScale: layout.masterScale  // v3.1 only
    },
    canvasSize,
    mapRect,
    rng
  );

  // Store placements for potential re-rendering
  state.lastPlacements = placements;

  // Check if using v3.1 viewport-based rendering
  if (algorithm === 'edgeSnapZoom' && placements.viewport) {
    // Map is rendered at maxMapSizeMult × masterScale × finalCanvas
    // Need to translate viewport coords (in master canvas space) to map image coords
    const maxMapSizeMult = 2.0;
    const mapToMasterRatio = maxMapSizeMult;  // Map is maxMapSizeMult× larger than master

    renderCollageWithViewport(
      canvas,
      state.mapImage,
      placements,
      placements.viewport,
      state.debug,
      mapToMasterRatio
    );
    setStatus(`Rendered ${placements.length} photos with Edge Snap Zoom v3.1`);
  } else {
    // Standard v3 rendering
    renderCollage(
      canvas,
      state.mapImage,
      placements,
      mapRect,
      state.debug,
      state.clusters
    );
    if (placements.length > 0) {
      setStatus(`Rendered ${placements.length} photos with Edge Snap v3`);
    }
  }

  // Update placement stats
  const statsEl = document.getElementById('placementStats');
  if (statsEl && placements.stats) {
    const s = placements.stats;
    statsEl.textContent = `Placed: ${s.placedPhotos}/${s.totalPhotos} | Skip: ${s.skippedPlacement} | Del: ${s.deletedOverlap + s.deletedOverflow}`;
  }
}

/**
 * Full regenerate pipeline
 */
async function regenerate() {
  runClustering();
  await renderMap();
  renderLayout();
}

/**
 * Handle photos loaded callback
 */
async function onPhotosLoaded(photos) {
  state.photos = photos;
  const canvasSize = getCanvasSize();

  if (photos.length === 0) {
    setStatus('Ready — drop photos to begin');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }
    return;
  }

  const withGPS = photos.filter(p => p.hasLocation).length;
  setStatus(`Loaded ${photos.length} photos (${withGPS} with GPS)`);

  if (withGPS === 0) {
    setStatus('No photos with GPS data — add geotagged photos');
    return;
  }

  await regenerate();
}

/**
 * Export configuration as JSON
 */
function exportConfig() {
  const config = {
    exportedAt: new Date().toISOString(),
    photoCount: state.photos.length,
    clusterCount: state.clusters.length,
    algorithm: state.config.algorithm,
    canvas: state.config.canvas,
    clustering: state.config.clustering,
    layout: state.config.layout,
    seed: state.config.seed
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `collage-config-${state.config.seed}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);

  setStatus('Config exported');
}

/**
 * Set up all UI event listeners
 */
function setupEventListeners() {
  // Canvas aspect ratio
  const aspectRatioSlider = document.getElementById('aspectRatio');
  const aspectRatioValue = document.getElementById('aspectRatioValue');
  aspectRatioSlider?.addEventListener('input', async (e) => {
    state.config.canvas.aspectRatio = parseFloat(e.target.value);
    aspectRatioValue.textContent = e.target.value;
    updateCanvasDimensions();
    await regenerate();
  });

  // Map style
  const mapStyleSelect = document.getElementById('mapStyle');
  mapStyleSelect?.addEventListener('change', async (e) => {
    state.config.layout.mapStyle = e.target.value;
    setMapStyle(e.target.value);
    await renderMap();
    renderLayout();
  });

  // Map size multiplier (controls zoom level - re-renders map)
  const mapSizeMultSlider = document.getElementById('mapSizeMult');
  const mapSizeMultValue = document.getElementById('mapSizeMultValue');
  mapSizeMultSlider?.addEventListener('input', async (e) => {
    state.config.layout.mapSizeMult = parseFloat(e.target.value);
    mapSizeMultValue.textContent = e.target.value;
    await renderMap();
    renderLayout();
  });

  // Clustering controls
  const epsilonSlider = document.getElementById('epsilon');
  const epsilonValue = document.getElementById('epsilonValue');
  epsilonSlider?.addEventListener('input', async (e) => {
    state.config.clustering.epsilon = parseFloat(e.target.value);
    epsilonValue.textContent = e.target.value;
    await regenerate();
  });

  const minPointsSlider = document.getElementById('minPoints');
  const minPointsValue = document.getElementById('minPointsValue');
  minPointsSlider?.addEventListener('input', async (e) => {
    state.config.clustering.minPoints = parseInt(e.target.value);
    minPointsValue.textContent = e.target.value;
    await regenerate();
  });

  const adaptiveCheckbox = document.getElementById('adaptive');
  adaptiveCheckbox?.addEventListener('change', async (e) => {
    state.config.clustering.adaptive = e.target.checked;
    await regenerate();
  });

  // Cluster sizing controls
  const ellipseMultSlider = document.getElementById('ellipseMult');
  const ellipseMultValue = document.getElementById('ellipseMultValue');
  ellipseMultSlider?.addEventListener('input', (e) => {
    state.config.layout.ellipseMult = parseFloat(e.target.value);
    ellipseMultValue.textContent = e.target.value;
    renderLayout();
  });

  const photoCountExpSlider = document.getElementById('photoCountExp');
  const photoCountExpValue = document.getElementById('photoCountExpValue');
  photoCountExpSlider?.addEventListener('input', (e) => {
    state.config.layout.photoCountExp = parseFloat(e.target.value);
    photoCountExpValue.textContent = e.target.value;
    renderLayout();
  });

  const radiusMultSlider = document.getElementById('radiusMult');
  const radiusMultValue = document.getElementById('radiusMultValue');
  radiusMultSlider?.addEventListener('input', (e) => {
    state.config.layout.radiusMult = parseFloat(e.target.value);
    radiusMultValue.textContent = e.target.value;
    renderLayout();
  });

  const maxRadiusSlider = document.getElementById('maxRadius');
  const maxRadiusValue = document.getElementById('maxRadiusValue');
  maxRadiusSlider?.addEventListener('input', (e) => {
    state.config.layout.maxRadiusPercent = parseInt(e.target.value) / 100;
    maxRadiusValue.textContent = e.target.value;
    renderLayout();
  });

  // Photo sizing controls
  const heroSizeSlider = document.getElementById('heroSize');
  const heroSizeValue = document.getElementById('heroSizeValue');
  heroSizeSlider?.addEventListener('input', (e) => {
    state.config.layout.heroSizeRatio = parseInt(e.target.value) / 100;
    heroSizeValue.textContent = e.target.value;
    renderLayout();
  });

  const sizeStepSlider = document.getElementById('sizeStep');
  const sizeStepValue = document.getElementById('sizeStepValue');
  sizeStepSlider?.addEventListener('input', (e) => {
    state.config.layout.sizeStepRatio = parseFloat(e.target.value);
    sizeStepValue.textContent = e.target.value;
    renderLayout();
  });

  // Size probability controls
  const earlyMediumSlider = document.getElementById('earlyMedium');
  const earlyMediumValue = document.getElementById('earlyMediumValue');
  earlyMediumSlider?.addEventListener('input', (e) => {
    state.config.layout.mediumProbabilityEarly = parseInt(e.target.value) / 100;
    earlyMediumValue.textContent = e.target.value;
    renderLayout();
  });

  const lateMediumSlider = document.getElementById('lateMedium');
  const lateMediumValue = document.getElementById('lateMediumValue');
  lateMediumSlider?.addEventListener('input', (e) => {
    state.config.layout.mediumProbabilityLate = parseInt(e.target.value) / 100;
    lateMediumValue.textContent = e.target.value;
    renderLayout();
  });

  const attemptsSlider = document.getElementById('attempts');
  const attemptsValue = document.getElementById('attemptsValue');
  attemptsSlider?.addEventListener('input', (e) => {
    state.config.layout.placementAttempts = parseInt(e.target.value);
    attemptsValue.textContent = e.target.value;
    renderLayout();
  });

  // Post-processing controls
  const spreadSlider = document.getElementById('spread');
  const spreadValue = document.getElementById('spreadValue');
  spreadSlider?.addEventListener('input', (e) => {
    state.config.layout.imageSpread = parseFloat(e.target.value);
    spreadValue.textContent = e.target.value;
    renderLayout();
  });

  const rotationSlider = document.getElementById('rotation');
  const rotationValue = document.getElementById('rotationValue');
  rotationSlider?.addEventListener('input', (e) => {
    state.config.layout.rotationRange = parseInt(e.target.value);
    rotationValue.textContent = e.target.value + '°';
    renderLayout();
  });

  // Edge overflow mode
  const overflowModeSelect = document.getElementById('overflowMode');
  overflowModeSelect?.addEventListener('change', (e) => {
    state.config.layout.edgeOverflowMode = e.target.value;
    renderLayout();
  });

  // Debug controls
  const debugClusters = document.getElementById('debugClusters');
  debugClusters?.addEventListener('change', (e) => {
    state.debug.showClusters = e.target.checked;
    renderLayout();
  });

  const debugEllipses = document.getElementById('debugEllipses');
  debugEllipses?.addEventListener('change', (e) => {
    state.debug.showEllipses = e.target.checked;
    renderLayout();
  });

  const debugBboxes = document.getElementById('debugBboxes');
  debugBboxes?.addEventListener('change', (e) => {
    state.debug.showBboxes = e.target.checked;
    renderLayout();
  });

  const debugPins = document.getElementById('debugPins');
  debugPins?.addEventListener('change', (e) => {
    state.debug.showPins = e.target.checked;
    renderLayout();
  });

  const debugBounds = document.getElementById('debugBounds');
  debugBounds?.addEventListener('change', (e) => {
    state.debug.showBounds = e.target.checked;
    renderLayout();
  });

  const debugViewport = document.getElementById('debugViewport');
  debugViewport?.addEventListener('change', (e) => {
    state.debug.showViewport = e.target.checked;
    renderLayout();
  });

  // Algorithm selector
  const algorithmSelect = document.getElementById('algorithmSelect');
  algorithmSelect?.addEventListener('change', async (e) => {
    state.config.algorithm = e.target.value;
    await regenerate();
  });

  // Seed controls
  const seedInput = document.getElementById('seed');
  seedInput?.addEventListener('change', (e) => {
    state.config.seed = parseInt(e.target.value) || 1;
    renderLayout();
  });

  const randomSeedBtn = document.getElementById('randomSeed');
  randomSeedBtn?.addEventListener('click', () => {
    state.config.seed = Math.floor(Math.random() * 10000);
    seedInput.value = state.config.seed;
    renderLayout();
  });

  // Action buttons
  const regenerateBtn = document.getElementById('regenerate');
  regenerateBtn?.addEventListener('click', async () => {
    await regenerate();
  });

  const savePngBtn = document.getElementById('savePng');
  savePngBtn?.addEventListener('click', () => {
    if (canvas) {
      saveAsPng(canvas, `collage-${state.config.seed}.png`);
      setStatus('PNG saved');
    }
  });

  const exportConfigBtn = document.getElementById('exportConfig');
  exportConfigBtn?.addEventListener('click', exportConfig);

  // Load sample photos button
  const loadSamplePhotosBtn = document.getElementById('loadSamplePhotos');
  loadSamplePhotosBtn?.addEventListener('click', async () => {
    setStatus('Loading sample photos...');
    try {
      await loadSamplePhotos();
    } catch (e) {
      console.error('Failed to load sample photos:', e);
      setStatus('Failed to load sample photos');
    }
  });
}

/**
 * Initialize the application
 */
function init() {
  console.log('Initializing Then & There Edge Snap v3.1 (Zoom)');

  // Get DOM elements
  canvas = document.getElementById('collageCanvas');
  statusBar = document.getElementById('status');

  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  // Set initial canvas dimensions
  updateCanvasDimensions();

  // Initialize modules
  initPhotoLoader('dropZone', onPhotosLoaded);
  initMap('mapContainer');

  // Set up event listeners
  setupEventListeners();

  // Initial canvas state
  const canvasSize = getCanvasSize();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
  ctx.fillStyle = '#555';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Drop photos to begin', canvasSize.width / 2, canvasSize.height / 2);

  setStatus('Ready — drop photos to begin');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
