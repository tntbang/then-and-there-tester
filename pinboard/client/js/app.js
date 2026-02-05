// Main application entry point

import { getState, setState, setGlobalParam, subscribe } from './state.js';
import { initRenderer, renderForExport, forceRender } from './canvas/renderer.js';
import { initPhotoPanel, updatePhotoCount } from './panels/photoPanel.js';
import { initParameterPanel } from './panels/parameterPanel.js';
import { initPaletteModal } from './panels/paletteModal.js';
import { getDefaultParams } from './arrangements/registry.js';

// Import arrangements to register them
import './arrangements/grid.js';

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

  exportBtn.addEventListener('click', async () => {
    exportBtn.classList.add('loading');
    exportBtn.disabled = true;

    try {
      // Render at 2x resolution
      const exportCanvas = await renderForExport(2);

      // Convert to blob
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to generate export');
          return;
        }

        // Create download link
        const state = getState();
        const filename = `pinboard-${state.arrangementId}-${state.globalParams.seed}.png`;

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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
