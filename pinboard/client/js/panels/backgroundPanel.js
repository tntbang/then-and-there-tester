// Background panel UI — gallery picker and per-background parameter controls

import { getState, setState, setBackgroundParam, subscribe } from '../state.js';
import {
  listBackgrounds,
  getBackgroundsByCategory,
  getBackgroundCategories,
  getBackgroundDefaults,
  getBackground
} from '../backgrounds/index.js';
import { resolveColor } from '../backgrounds/bgUtils.js';
import { createRNG } from '../utils/random.js';

let containerEl = null;
let galleryEl = null;
let paramsEl = null;
let thumbnailCanvases = new Map(); // bgId -> canvas element

const THUMB_SIZE = 48;

/**
 * Initialize the background panel
 * @param {HTMLElement} container - Container element to mount into
 */
export function initBackgroundPanel(container) {
  containerEl = container;

  galleryEl = document.createElement('div');
  galleryEl.className = 'bg-gallery-container';
  containerEl.appendChild(galleryEl);

  paramsEl = document.createElement('div');
  paramsEl.className = 'bg-params';
  containerEl.appendChild(paramsEl);

  renderGallery();
  renderParams();

  // Subscribe to state changes
  subscribe((state) => {
    updateSelectedThumbnail();
    renderParams();
  });

  // Re-render thumbnails when palette changes (debounced)
  let paletteDebounce = null;
  let lastPalette = getState().palette;
  subscribe((state) => {
    if (state.palette !== lastPalette) {
      lastPalette = state.palette;
      clearTimeout(paletteDebounce);
      paletteDebounce = setTimeout(() => renderThumbnails(), 100);
    }
  });
}

/**
 * Render the gallery grid grouped by category
 */
function renderGallery() {
  galleryEl.innerHTML = '';

  const categories = getBackgroundCategories();

  for (const category of categories) {
    const backgrounds = getBackgroundsByCategory(category);
    if (backgrounds.length === 0) continue;

    // Category header
    const header = document.createElement('div');
    header.className = 'bg-category-header';
    header.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    galleryEl.appendChild(header);

    // Thumbnail grid
    const grid = document.createElement('div');
    grid.className = 'bg-gallery';

    for (const bg of backgrounds) {
      const thumb = createThumbnail(bg);
      grid.appendChild(thumb);
    }

    galleryEl.appendChild(grid);
  }
}

/**
 * Create a thumbnail element for a background
 * @param {Object} bg - Background config
 * @returns {HTMLElement} Thumbnail element
 */
function createThumbnail(bg) {
  const wrapper = document.createElement('div');
  wrapper.className = 'bg-thumbnail';
  wrapper.dataset.bgId = bg.id;

  const state = getState();
  if (state.backgroundId === bg.id) {
    wrapper.classList.add('selected');
  }

  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  wrapper.appendChild(canvas);

  const label = document.createElement('div');
  label.className = 'bg-thumbnail-label';
  label.textContent = bg.name;
  wrapper.appendChild(label);

  thumbnailCanvases.set(bg.id, canvas);
  renderThumbnail(bg, canvas);

  wrapper.addEventListener('click', () => {
    const defaults = getBackgroundDefaults(bg.id);
    setState({ backgroundId: bg.id, backgroundParams: defaults });
  });

  return wrapper;
}

/**
 * Render a single thumbnail canvas
 * @param {Object} bg - Background config
 * @param {HTMLCanvasElement} canvas - Thumbnail canvas
 */
function renderThumbnail(bg, canvas) {
  const ctx = canvas.getContext('2d');
  const state = getState();
  const defaults = getBackgroundDefaults(bg.id);
  const rng = createRNG(12345);

  try {
    bg.render(ctx, THUMB_SIZE, THUMB_SIZE, defaults, state.palette, rng);
  } catch (err) {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  }
}

/**
 * Re-render all thumbnails (e.g., when palette changes)
 */
function renderThumbnails() {
  const backgrounds = listBackgrounds();
  for (const bg of backgrounds) {
    const canvas = thumbnailCanvases.get(bg.id);
    if (canvas) {
      renderThumbnail(bg, canvas);
    }
  }
}

/**
 * Update the selected thumbnail highlight
 */
function updateSelectedThumbnail() {
  const state = getState();
  const allThumbs = containerEl.querySelectorAll('.bg-thumbnail');
  allThumbs.forEach(thumb => {
    thumb.classList.toggle('selected', thumb.dataset.bgId === state.backgroundId);
  });
}

/**
 * Render parameter controls for the currently selected background
 */
function renderParams() {
  const state = getState();
  const bg = getBackground(state.backgroundId);

  if (!bg || !bg.schema || bg.schema.length === 0) {
    paramsEl.innerHTML = '';
    paramsEl.style.display = 'none';
    return;
  }

  paramsEl.style.display = '';
  paramsEl.innerHTML = '';

  for (const param of bg.schema) {
    const group = document.createElement('div');
    group.className = 'bg-param-group';

    const label = document.createElement('label');
    label.textContent = param.name;
    group.appendChild(label);

    const control = createBgParamControl(param);
    group.appendChild(control);

    paramsEl.appendChild(group);
  }
}

/**
 * Create a control element for a background parameter
 * @param {Object} param - Parameter definition
 * @returns {HTMLElement} Control element
 */
function createBgParamControl(param) {
  const state = getState();
  const value = state.backgroundParams[param.id] ?? param.default;

  switch (param.type) {
    case 'number':
      return createNumberControl(param, value);
    case 'boolean':
      return createBooleanControl(param, value);
    case 'palette-color':
      return createPaletteColorControl(param, value);
    case 'select':
      return createSelectControl(param, value);
    default:
      const span = document.createElement('span');
      span.textContent = String(value);
      return span;
  }
}

/**
 * Number slider control
 */
function createNumberControl(param, value) {
  const container = document.createElement('div');
  container.className = 'bg-param-slider';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = param.min ?? 0;
  slider.max = param.max ?? 100;
  slider.step = param.step ?? 1;
  slider.value = value;

  const display = document.createElement('span');
  display.className = 'bg-param-value';
  display.textContent = value + (param.suffix || '');

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    display.textContent = v + (param.suffix || '');
    setBackgroundParam(param.id, v);
  });

  container.appendChild(slider);
  container.appendChild(display);
  return container;
}

/**
 * Boolean toggle control
 */
function createBooleanControl(param, value) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'bg-param-toggle';
  input.checked = value;

  input.addEventListener('change', () => {
    setBackgroundParam(param.id, input.checked);
  });

  return input;
}

/**
 * Palette color picker control
 */
function createPaletteColorControl(param, value) {
  const state = getState();
  const palette = state.palette;

  const container = document.createElement('div');
  container.className = 'color-picker';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'color-picker-btn';

  const swatch = document.createElement('span');
  swatch.className = 'color-picker-swatch';
  swatch.style.background = resolveColor(value, palette);

  const label = document.createElement('span');
  label.textContent = getColorLabel(value);

  btn.appendChild(swatch);
  btn.appendChild(label);

  const dropdown = document.createElement('div');
  dropdown.className = 'color-picker-dropdown';

  // Palette colors
  const paletteOptions = document.createElement('div');
  paletteOptions.className = 'color-picker-options';

  for (let i = 0; i < 5; i++) {
    const option = document.createElement('div');
    option.className = 'color-picker-option';
    if (value === i) option.classList.add('selected');
    option.style.background = palette?.colors?.[i] || '#888';
    option.dataset.value = i;
    option.title = `Color ${i + 1}`;
    paletteOptions.appendChild(option);
  }
  dropdown.appendChild(paletteOptions);

  const divider = document.createElement('div');
  divider.className = 'color-picker-divider';
  dropdown.appendChild(divider);

  // Utility colors
  const utilities = document.createElement('div');
  utilities.className = 'color-picker-utilities';

  const utilityColors = [
    { value: 'white', color: '#ffffff', label: 'White' },
    { value: 'black', color: '#000000', label: 'Black' },
    { value: 'neutral', color: palette?.utilities?.neutral || '#888', label: 'Neutral' }
  ];

  for (const util of utilityColors) {
    const option = document.createElement('div');
    option.className = 'color-picker-option';
    if (value === util.value) option.classList.add('selected');
    option.style.background = util.color;
    option.dataset.value = util.value;
    option.title = util.label;
    utilities.appendChild(option);
  }
  dropdown.appendChild(utilities);

  container.appendChild(btn);
  container.appendChild(dropdown);

  btn.addEventListener('click', () => {
    dropdown.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  dropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.color-picker-option');
    if (!option) return;

    const newValue = isNaN(option.dataset.value) ?
      option.dataset.value :
      parseInt(option.dataset.value, 10);

    setBackgroundParam(param.id, newValue);

    swatch.style.background = resolveColor(newValue, getState().palette);
    label.textContent = getColorLabel(newValue);

    dropdown.querySelectorAll('.color-picker-option').forEach(o =>
      o.classList.remove('selected')
    );
    option.classList.add('selected');
    dropdown.classList.remove('active');
  });

  return container;
}

/**
 * Select dropdown control
 */
function createSelectControl(param, value) {
  const select = document.createElement('select');

  for (const opt of param.options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    setBackgroundParam(param.id, select.value);
  });

  return select;
}

/**
 * Get display label for a color reference
 */
function getColorLabel(ref) {
  if (typeof ref === 'number') return `Color ${ref + 1}`;
  if (ref === 'white') return 'White';
  if (ref === 'black') return 'Black';
  if (ref === 'neutral') return 'Neutral';
  return String(ref);
}
