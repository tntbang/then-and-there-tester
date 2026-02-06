// Palette selection modal

import { getState, setState, subscribe } from '../state.js';
import { extractColors } from '../color/extraction.js';
import { generateAllPalettes } from '../color/palettes.js';


let modal = null;
let optionsContainer = null;
let palettePreview = null;
let changePaletteBtn = null;
let regenerateBtn = null;
let closeBtn = null;

// Extraction state
let isExtracting = false;
let extractionDebounceTimer = null;

/**
 * Initialize the palette modal
 */
export function initPaletteModal() {
  modal = document.getElementById('paletteModal');
  optionsContainer = document.getElementById('paletteOptions');
  palettePreview = document.getElementById('palettePreview');
  changePaletteBtn = document.getElementById('changePaletteBtn');
  regenerateBtn = document.getElementById('regeneratePalettes');
  closeBtn = document.getElementById('closePaletteModal');

  setupEventHandlers();

  // Subscribe to photo changes for auto-extraction
  subscribe(handleStateChange);

  // Initial palette generation
  generateInitialPalettes();
}

/**
 * Setup event handlers
 */
function setupEventHandlers() {
  changePaletteBtn.addEventListener('click', openModal);

  closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  regenerateBtn.addEventListener('click', regeneratePalettes);

  // Keyboard handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/**
 * Open the palette modal
 */
function openModal() {
  renderPaletteOptions();
  modal.classList.add('active');
}

/**
 * Close the palette modal
 */
function closeModal() {
  modal.classList.remove('active');
}

/**
 * Generate initial palettes
 */
async function generateInitialPalettes() {
  const state = getState();

  if (state.photos.length > 0) {
    await extractAndGeneratePalettes();
  } else {
    // Use default colors
    const palettes = generateAllPalettes([]);
    setState({
      availablePalettes: palettes,
      palette: palettes[0]
    });
    updatePalettePreview();
  }
}

/**
 * Regenerate palettes from current photos
 */
async function regeneratePalettes() {
  regenerateBtn.classList.add('loading');

  try {
    await extractAndGeneratePalettes();
    renderPaletteOptions();
  } finally {
    regenerateBtn.classList.remove('loading');
  }
}

/**
 * Extract colors and generate palettes
 */
async function extractAndGeneratePalettes() {
  if (isExtracting) return;
  isExtracting = true;

  try {
    const state = getState();
    const thumbnailUrls = state.photos.map(p => `/uploads/${p.thumbnailPath}`);

    // Extract colors
    const extractedColors = await extractColors(thumbnailUrls);

    // Generate all palette variants
    const palettes = generateAllPalettes(extractedColors);

    // Try to keep same palette type if one was selected
    let newPalette = palettes[0];
    if (state.palette) {
      const sameType = palettes.find(p => p.type === state.palette.type);
      if (sameType) {
        newPalette = sameType;
      }
    }

    setState({
      availablePalettes: palettes,
      palette: newPalette
    });

    updatePalettePreview();
  } finally {
    isExtracting = false;
  }
}

/**
 * Render palette options in the modal
 */
function renderPaletteOptions() {
  const state = getState();
  const palettes = state.availablePalettes;
  const selectedPalette = state.palette;

  optionsContainer.innerHTML = '';

  // Group palettes by type
  const groups = {
    'Extracted': palettes.filter(p => p.type === 'extraction'),
    'Harmonies': palettes.filter(p =>
      ['complementary', 'analogous', 'triadic', 'split-complementary', 'monochromatic'].includes(p.type)
    ),
    'Variants': palettes.filter(p =>
      ['muted', 'vintage', 'value-stratified'].includes(p.type)
    )
  };

  for (const [groupName, groupPalettes] of Object.entries(groups)) {
    if (groupPalettes.length === 0) continue;

    const title = document.createElement('div');
    title.className = 'palette-section-title';
    title.textContent = groupName;
    optionsContainer.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'palette-grid';

    for (const palette of groupPalettes) {
      const option = createPaletteOption(palette, palette === selectedPalette);
      grid.appendChild(option);
    }

    optionsContainer.appendChild(grid);
  }
}

/**
 * Create a palette option element
 * @param {Object} palette - Palette object
 * @param {boolean} isSelected - Whether this palette is selected
 * @returns {HTMLElement}
 */
function createPaletteOption(palette, isSelected) {
  const option = document.createElement('div');
  option.className = 'palette-option';
  if (isSelected) option.classList.add('selected');

  const name = document.createElement('div');
  name.className = 'palette-option-name';
  name.textContent = palette.name;
  option.appendChild(name);

  const colors = document.createElement('div');
  colors.className = 'palette-option-colors';

  for (const color of palette.colors) {
    const swatch = document.createElement('div');
    swatch.className = 'palette-option-swatch';
    swatch.style.background = color;
    colors.appendChild(swatch);
  }

  option.appendChild(colors);

  option.addEventListener('click', () => {
    selectPalette(palette);
    closeModal();
  });

  return option;
}

/**
 * Select a palette
 * @param {Object} palette - Palette to select
 */
function selectPalette(palette) {
  setState({ palette });
  updatePalettePreview();
}

/**
 * Update the palette preview in the sidebar
 */
function updatePalettePreview() {
  const state = getState();
  const palette = state.palette;

  if (!palette || !palettePreview) return;

  const colorsContainer = palettePreview.querySelector('.palette-colors');
  if (!colorsContainer) return;

  colorsContainer.innerHTML = '';

  for (const color of palette.colors) {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = color;
    colorsContainer.appendChild(swatch);
  }
}

/**
 * Handle state changes - trigger extraction when photos change
 */
let lastPhotoIds = '';

function handleStateChange(state) {
  const currentPhotoIds = state.photos.map(p => p.id).join(',');

  if (currentPhotoIds !== lastPhotoIds) {
    lastPhotoIds = currentPhotoIds;

    // Debounce extraction
    if (extractionDebounceTimer) {
      clearTimeout(extractionDebounceTimer);
    }

    extractionDebounceTimer = setTimeout(() => {
      extractAndGeneratePalettes();
    }, 500);
  }
}
