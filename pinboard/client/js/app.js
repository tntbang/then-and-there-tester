// Main application entry point

import { getState, setState, setGlobalParam, subscribe } from './state.js';
import { initRenderer, renderForExport, forceRender } from './canvas/renderer.js';
import { initPhotoPanel, updatePhotoCount } from './panels/photoPanel.js';
import { initParameterPanel } from './panels/parameterPanel.js';
import { initPaletteModal } from './panels/paletteModal.js';
import { initBackgroundPanel } from './panels/backgroundPanel.js';
import { getDefaultParams } from './arrangements/registry.js';

// Import arrangements to register them
import './arrangements/grid.js';

// Import backgrounds to register them
import './backgrounds/index.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing Pinboard Tester...');

  // Set initial arrangement params
  const state = getState();
  if (Object.keys(state.arrangementParams).length === 0) {
    const { gridSchema } = await import('./arrangements/grid.js');
    const defaults = getDefaultParams(gridSchema);
    setState({ arrangementParams: defaults });
  }

  // Initialize canvas
  const canvas = document.getElementById('mainCanvas');
  const canvasContainer = document.getElementById('canvasContainer');
  initRenderer(canvas, canvasContainer);

  // Initialize UI panels
  initPhotoPanel();
  initParameterPanel();
  initPaletteModal();

  // Initialize background gallery
  const bgSection = document.getElementById('backgroundSection');
  if (bgSection) {
    initBackgroundPanel(bgSection);
  }

  // Initialize drop shadow controls
  initShadowControls();

  // Setup export button
  setupExport();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  console.log('Pinboard Tester initialized');
}

/**
 * Setup export functionality
 */
function setupExport() {
  const exportBtn = document.getElementById('exportBtn');
  const resolutionSelect = document.getElementById('exportResolution');

  exportBtn.addEventListener('click', async () => {
    exportBtn.classList.add('loading');
    exportBtn.disabled = true;

    try {
      const resolution = resolutionSelect.value;
      const exportCanvas = await renderForExport(resolution);

      exportCanvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to generate export');
          return;
        }

        const state = getState();
        const filename = `pinboard-${state.arrangementId}-${state.globalParams.seed}-${resolution}.png`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    } finally {
      exportBtn.classList.remove('loading');
      exportBtn.disabled = false;
    }
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'r':
        // Randomize seed
        if (!e.ctrlKey && !e.metaKey) {
          const newSeed = Math.floor(Math.random() * 100000);
          setGlobalParam('seed', newSeed);
          document.getElementById('seedInput').value = newSeed;
          forceRender();
        }
        break;

      case 'e':
        // Export
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('exportBtn').click();
        }
        break;

      case 'delete':
      case 'backspace':
        // Delete all (with confirmation)
        if (e.shiftKey) {
          document.getElementById('deleteAllBtn').click();
        }
        break;
    }
  });

  // Seed input arrow keys
  const seedInput = document.getElementById('seedInput');
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      document.getElementById('seedUp').click();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.getElementById('seedDown').click();
    }
  });
}

/**
 * Initialize drop shadow controls
 */
function initShadowControls() {
  const section = document.getElementById('shadowSection');
  if (!section) return;

  section.innerHTML = `
    <div class="shadow-controls">
      <div class="shadow-controls-header">
        <label>Drop Shadow</label>
        <input type="checkbox" id="shadowEnabled" class="bg-param-toggle">
      </div>
      <div class="shadow-param-grid" id="shadowParams">
        <label>Blur</label>
        <input type="range" id="shadowBlur" min="0" max="30" step="1" value="8">
        <span class="param-value" id="shadowBlurVal">8</span>

        <label>Offset X</label>
        <input type="range" id="shadowOffsetX" min="-20" max="20" step="1" value="3">
        <span class="param-value" id="shadowOffsetXVal">3</span>

        <label>Offset Y</label>
        <input type="range" id="shadowOffsetY" min="-20" max="20" step="1" value="4">
        <span class="param-value" id="shadowOffsetYVal">4</span>

        <label>Opacity</label>
        <input type="range" id="shadowOpacity" min="0" max="100" step="5" value="35">
        <span class="param-value" id="shadowOpacityVal">35%</span>
      </div>
    </div>
  `;

  const state = getState();
  const gp = state.globalParams;

  const enabledEl = section.querySelector('#shadowEnabled');
  enabledEl.checked = gp.shadowEnabled !== false;

  const sliders = ['shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowOpacity'];
  for (const id of sliders) {
    const slider = section.querySelector(`#${id}`);
    const valEl = section.querySelector(`#${id}Val`);
    slider.value = gp[id] ?? slider.value;
    valEl.textContent = slider.value + (id === 'shadowOpacity' ? '%' : '');

    slider.addEventListener('input', () => {
      valEl.textContent = slider.value + (id === 'shadowOpacity' ? '%' : '');
      setGlobalParam(id, parseFloat(slider.value));
    });
  }

  enabledEl.addEventListener('change', () => {
    setGlobalParam('shadowEnabled', enabledEl.checked);
    section.querySelector('#shadowParams').style.display = enabledEl.checked ? '' : 'none';
  });

  // Initial visibility
  section.querySelector('#shadowParams').style.display = enabledEl.checked ? '' : 'none';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
