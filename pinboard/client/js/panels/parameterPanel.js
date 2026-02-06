// Parameter panel UI - global and arrangement parameters

import { getState, setState, setGlobalParam, setArrangementParam, subscribe } from '../state.js';
import { getArrangement, listArrangements, getDefaultParams } from '../arrangements/registry.js';
import { updatePhotoCount } from './photoPanel.js';
import { clearTextureCache } from '../canvas/renderer.js';

let globalParamsEl = null;
let arrangementParamsEl = null;
let arrangementSelect = null;
let orientationBtns = null;
let seedInput = null;
let pinboardStyleSelect = null;

/**
 * Initialize the parameter panel
 */
export function initParameterPanel() {
  globalParamsEl = document.getElementById('globalParams');
  arrangementParamsEl = document.getElementById('arrangementParams');
  arrangementSelect = document.getElementById('arrangementSelect');
  pinboardStyleSelect = document.getElementById('pinboardStyle');
  seedInput = document.getElementById('seedInput');

  setupGlobalParams();
  setupArrangementSelect();
  loadArrangementParams();

  // Subscribe to state changes for conditional param updates
  subscribe(handleStateChange);
}

/**
 * Setup global parameter controls
 */
function setupGlobalParams() {
  // Orientation toggle
  orientationBtns = document.querySelectorAll('.toggle-group .toggle-btn');
  orientationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      const state = getState();
      const prevOrientation = state.globalParams.orientation;

      // Only act if orientation actually changed
      if (value !== prevOrientation) {
        setGlobalParam('orientation', value);

        // Swap cols/rows for grid arrangement
        if (state.arrangementId === 'grid') {
          const { cols, rows } = state.arrangementParams;
          if (cols !== undefined && rows !== undefined) {
            setArrangementParam('cols', rows);
            setArrangementParam('rows', cols);
            loadArrangementParams();
            updatePhotoCount();
          }
        }
      }

      orientationBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Seed controls
  seedInput.addEventListener('change', () => {
    const value = parseInt(seedInput.value, 10) || 0;
    setGlobalParam('seed', value);
    clearTextureCache();
  });

  document.getElementById('seedDown').addEventListener('click', () => {
    const current = parseInt(seedInput.value, 10) || 0;
    seedInput.value = Math.max(0, current - 1);
    setGlobalParam('seed', parseInt(seedInput.value, 10));
    clearTextureCache();
  });

  document.getElementById('seedUp').addEventListener('click', () => {
    const current = parseInt(seedInput.value, 10) || 0;
    seedInput.value = current + 1;
    setGlobalParam('seed', parseInt(seedInput.value, 10));
    clearTextureCache();
  });

  document.getElementById('seedRandom').addEventListener('click', () => {
    const newSeed = Math.floor(Math.random() * 100000);
    seedInput.value = newSeed;
    setGlobalParam('seed', newSeed);
    clearTextureCache();
  });

  // Pinboard style
  pinboardStyleSelect.addEventListener('change', () => {
    setGlobalParam('pinboardStyle', pinboardStyleSelect.value);
    clearTextureCache();
  });
}

/**
 * Setup arrangement selector
 */
function setupArrangementSelect() {
  // Populate with available arrangements
  const arrangements = listArrangements();
  arrangementSelect.innerHTML = '';

  for (const arr of arrangements) {
    const option = document.createElement('option');
    option.value = arr.id;
    option.textContent = arr.name;
    arrangementSelect.appendChild(option);
  }

  arrangementSelect.addEventListener('change', () => {
    const arrangementId = arrangementSelect.value;
    const arrangement = getArrangement(arrangementId);

    if (arrangement) {
      const defaults = getDefaultParams(arrangement.schema);
      setState({
        arrangementId,
        arrangementParams: defaults
      });
      loadArrangementParams();
      updatePhotoCount();
    }
  });

  // Set initial arrangement
  const state = getState();
  arrangementSelect.value = state.arrangementId;
}

/**
 * Load and render arrangement parameters
 */
function loadArrangementParams() {
  const state = getState();
  const arrangement = getArrangement(state.arrangementId);

  if (!arrangement || !arrangement.schema) {
    arrangementParamsEl.innerHTML = '<p>No parameters</p>';
    return;
  }

  // Initialize defaults if needed
  if (Object.keys(state.arrangementParams).length === 0) {
    const defaults = getDefaultParams(arrangement.schema);
    setState({ arrangementParams: defaults });
  }

  renderParams(arrangement.schema.params, arrangementParamsEl);
}

/**
 * Render parameters from schema
 * @param {Array} params - Parameter definitions
 * @param {HTMLElement} container - Container element
 * @param {string} prefix - Parameter ID prefix for nested params
 */
function renderParams(params, container, prefix = '') {
  container.innerHTML = '';

  for (const param of params) {
    if (!shouldShowParam(param)) continue;

    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramId = param.id;

    if (param.type === 'group') {
      // Collapsible group
      const header = document.createElement('div');
      header.className = 'param-group-header';
      header.innerHTML = `
        <label>${param.name}</label>
        <span class="param-group-toggle">▼</span>
      `;

      const content = document.createElement('div');
      content.className = 'param-group-content';

      header.addEventListener('click', () => {
        header.querySelector('.param-group-toggle').classList.toggle('collapsed');
        content.classList.toggle('collapsed');
      });

      group.appendChild(header);
      group.appendChild(content);

      // Render child params
      if (param.params) {
        renderParams(param.params, content, param.id);
      }
    } else {
      // Regular parameter
      const label = document.createElement('label');
      label.textContent = param.name;
      group.appendChild(label);

      const control = createParamControl(param);
      group.appendChild(control);

      if (param.description) {
        const desc = document.createElement('small');
        desc.className = 'param-description';
        desc.textContent = param.description;
        group.appendChild(desc);
      }
    }

    container.appendChild(group);
  }
}

/**
 * Create control element for a parameter
 * @param {Object} param - Parameter definition
 * @returns {HTMLElement} Control element
 */
function createParamControl(param) {
  const state = getState();
  const value = state.arrangementParams[param.id] ?? param.default;

  switch (param.type) {
    case 'number':
      return createNumberControl(param, value);

    case 'boolean':
      return createBooleanControl(param, value);

    case 'weight':
      return createWeightControl(param, value);

    case 'palette-color':
      return createPaletteColorControl(param, value);

    case 'select':
      return createSelectControl(param, value);

    default:
      const fallback = document.createElement('span');
      fallback.textContent = `Unknown type: ${param.type}`;
      return fallback;
  }
}

/**
 * Create number input control (slider + number)
 */
function createNumberControl(param, value) {
  const container = document.createElement('div');
  container.className = 'slider-group';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = param.min ?? 0;
  slider.max = param.max ?? 100;
  slider.step = param.step ?? 1;
  slider.value = value;

  const display = document.createElement('span');
  display.className = 'slider-value';
  display.textContent = value + (param.suffix || '');

  slider.addEventListener('input', () => {
    const newValue = parseFloat(slider.value);
    display.textContent = newValue + (param.suffix || '');
    setArrangementParam(param.id, newValue);
    updatePhotoCount();
  });

  container.appendChild(slider);
  container.appendChild(display);

  return container;
}

/**
 * Create boolean toggle control
 */
function createBooleanControl(param, value) {
  const container = document.createElement('label');
  container.className = 'toggle-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;

  const slider = document.createElement('span');
  slider.className = 'toggle-slider';

  input.addEventListener('change', () => {
    setArrangementParam(param.id, input.checked);
  });

  container.appendChild(input);
  container.appendChild(slider);

  return container;
}

/**
 * Create weight slider (0-10)
 */
function createWeightControl(param, value) {
  const container = document.createElement('div');
  container.className = 'slider-group';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = 10;
  slider.step = 1;
  slider.value = value;

  const display = document.createElement('span');
  display.className = 'slider-value';
  display.textContent = value;

  slider.addEventListener('input', () => {
    const newValue = parseInt(slider.value, 10);
    display.textContent = newValue;
    setArrangementParam(param.id, newValue);
    updateConditionalParams();
  });

  container.appendChild(slider);
  container.appendChild(display);

  return container;
}

/**
 * Create palette color selector
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
  swatch.style.background = getColorValue(value, palette);

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

  // Divider
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

  // Toggle dropdown
  btn.addEventListener('click', () => {
    dropdown.classList.toggle('active');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  // Handle selection
  dropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.color-picker-option');
    if (!option) return;

    const newValue = isNaN(option.dataset.value) ?
      option.dataset.value :
      parseInt(option.dataset.value, 10);

    setArrangementParam(param.id, newValue);

    // Update UI
    swatch.style.background = getColorValue(newValue, palette);
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
 * Create select dropdown
 */
function createSelectControl(param, value) {
  const select = document.createElement('select');

  for (const option of param.options) {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === value) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    setArrangementParam(param.id, select.value);
  });

  return select;
}

/**
 * Check if parameter should be visible based on conditions
 */
function shouldShowParam(param) {
  if (!param.condition) return true;

  const state = getState();
  const params = state.arrangementParams;

  if (typeof param.condition === 'string') {
    // Single param condition
    return (params[param.condition] || 0) > 0;
  }

  if (param.condition.anyOf) {
    // Any of multiple params
    return param.condition.anyOf.some(id => (params[id] || 0) > 0);
  }

  return true;
}

/**
 * Update conditional parameter visibility
 */
function updateConditionalParams() {
  const state = getState();
  const arrangement = getArrangement(state.arrangementId);
  if (!arrangement) return;

  // Re-render to update visibility
  loadArrangementParams();
}

/**
 * Handle state changes
 */
function handleStateChange(state) {
  // Update seed input if changed externally
  if (seedInput && parseInt(seedInput.value, 10) !== state.globalParams.seed) {
    seedInput.value = state.globalParams.seed;
  }
}

/**
 * Get actual color value from reference
 */
function getColorValue(ref, palette) {
  if (typeof ref === 'number' && palette?.colors?.[ref]) {
    return palette.colors[ref];
  }
  if (ref === 'white') return '#ffffff';
  if (ref === 'black') return '#000000';
  if (ref === 'neutral') return palette?.utilities?.neutral || '#888888';
  return '#888888';
}

/**
 * Get color label from reference
 */
function getColorLabel(ref) {
  if (typeof ref === 'number') return `Color ${ref + 1}`;
  if (ref === 'white') return 'White';
  if (ref === 'black') return 'Black';
  if (ref === 'neutral') return 'Neutral';
  return String(ref);
}
