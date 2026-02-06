// Photo panel UI - upload, display, reorder, delete

import { getState, setState } from '../state.js';
import * as api from '../api.js';
import { getArrangement, getPhotoCount } from '../arrangements/registry.js';

let uploadZone = null;
let fileInput = null;
let photoList = null;
let photoCountEl = null;
let deleteAllBtn = null;

// Drag state
let draggedItem = null;
let draggedIndex = -1;

/**
 * Initialize the photo panel
 */
export function initPhotoPanel() {
  uploadZone = document.getElementById('uploadZone');
  fileInput = document.getElementById('fileInput');
  photoList = document.getElementById('photoList');
  photoCountEl = document.getElementById('photoCount');
  deleteAllBtn = document.getElementById('deleteAllBtn');

  setupUploadZone();
  setupDeleteAll();

  // Load initial photos
  loadPhotos();
}

/**
 * Setup upload zone event handlers
 */
function setupUploadZone() {
  // Click to upload
  uploadZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files);
      e.target.value = ''; // Reset for re-upload of same files
    }
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );

    if (files.length > 0) {
      handleUpload(files);
    }
  });
}

/**
 * Setup delete all button
 */
function setupDeleteAll() {
  deleteAllBtn.addEventListener('click', async () => {
    const state = getState();
    if (state.photos.length === 0) return;

    if (confirm('Delete all photos? This cannot be undone.')) {
      try {
        await api.deleteAllPhotos();
        setState({ photos: [], photoOrder: [] });
        renderPhotoList();
        updatePhotoCount();
      } catch (err) {
        console.error('Failed to delete all photos:', err);
        alert('Failed to delete photos');
      }
    }
  });
}

/**
 * Load photos from server
 */
async function loadPhotos() {
  try {
    const data = await api.fetchPhotos();
    setState({
      photos: data.photos || [],
      photoOrder: data.order || []
    });
    renderPhotoList();
    updatePhotoCount();
  } catch (err) {
    console.error('Failed to load photos:', err);
  }
}

/**
 * Handle file upload
 * @param {FileList|File[]} files - Files to upload
 */
async function handleUpload(files) {
  uploadZone.classList.add('loading');

  try {
    const data = await api.uploadPhotos(files);
    const state = getState();

    setState({
      photos: [...state.photos, ...data.photos],
      photoOrder: [...state.photoOrder, ...data.photos.map(p => p.id)]
    });

    renderPhotoList();
    updatePhotoCount();
  } catch (err) {
    console.error('Failed to upload photos:', err);
    alert('Failed to upload photos');
  } finally {
    uploadZone.classList.remove('loading');
  }
}

/**
 * Render the photo list as a 3-column grid
 */
function renderPhotoList() {
  const state = getState();
  const photoMap = new Map(state.photos.map(p => [p.id, p]));

  photoList.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'photo-grid';

  for (const id of state.photoOrder) {
    const photo = photoMap.get(id);
    if (!photo) continue;

    const item = createPhotoItem(photo);
    grid.appendChild(item);
  }

  photoList.appendChild(grid);
}

/**
 * Create a photo item element
 * @param {Object} photo - Photo object
 * @returns {HTMLElement} Photo item element
 */
function createPhotoItem(photo) {
  const item = document.createElement('div');
  item.className = 'photo-grid-item';
  item.dataset.id = photo.id;
  item.draggable = true;

  const img = document.createElement('img');
  img.src = `/uploads/${photo.thumbnailPath}`;
  img.alt = photo.filename;
  item.appendChild(img);

  // Overlay with buttons
  const overlay = document.createElement('div');
  overlay.className = 'photo-item-overlay';

  const focalBtn = document.createElement('button');
  focalBtn.className = 'photo-item-btn';
  focalBtn.textContent = 'Focal';
  focalBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFocalPointModal(photo);
  });
  overlay.appendChild(focalBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'photo-item-btn delete';
  deleteBtn.textContent = 'Del';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deletePhoto(photo.id);
  });
  overlay.appendChild(deleteBtn);

  item.appendChild(overlay);

  // Focal point indicator (if not centered)
  if (photo.focalPoint &&
      (Math.abs(photo.focalPoint.x - 0.5) > 0.05 ||
       Math.abs(photo.focalPoint.y - 0.5) > 0.05)) {
    const indicator = document.createElement('div');
    indicator.className = 'focal-indicator';
    item.appendChild(indicator);
  }

  // Drag handlers
  item.addEventListener('dragstart', handleDragStart);
  item.addEventListener('dragend', handleDragEnd);
  item.addEventListener('dragover', handleDragOver);
  item.addEventListener('drop', handleDrop);

  return item;
}

/**
 * Delete a single photo
 * @param {string} id - Photo ID
 */
async function deletePhoto(id) {
  try {
    await api.deletePhoto(id);
    const state = getState();

    setState({
      photos: state.photos.filter(p => p.id !== id),
      photoOrder: state.photoOrder.filter(pid => pid !== id)
    });

    renderPhotoList();
    updatePhotoCount();
  } catch (err) {
    console.error('Failed to delete photo:', err);
    alert('Failed to delete photo');
  }
}

/**
 * Update photo count display
 */
export function updatePhotoCount() {
  const state = getState();
  const arrangement = getArrangement(state.arrangementId);
  const required = arrangement ?
    getPhotoCount(arrangement.schema, state.arrangementParams) : 9;
  const current = state.photos.length;

  photoCountEl.textContent = `${current} / ${required} photos`;

  photoCountEl.classList.remove('warning', 'success');
  if (current < required) {
    photoCountEl.classList.add('warning');
  } else {
    photoCountEl.classList.add('success');
  }
}

// Drag and drop handlers
function handleDragStart(e) {
  draggedItem = e.currentTarget;
  const grid = photoList.querySelector('.photo-grid');
  draggedIndex = grid ? Array.from(grid.children).indexOf(draggedItem) : -1;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  draggedItem = null;
  draggedIndex = -1;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e) {
  e.preventDefault();

  const targetItem = e.currentTarget;
  if (targetItem === draggedItem) return;

  const grid = photoList.querySelector('.photo-grid');
  const targetIndex = grid ? Array.from(grid.children).indexOf(targetItem) : -1;
  if (targetIndex === -1 || draggedIndex === -1) return;

  // Reorder in state
  const state = getState();
  const newOrder = [...state.photoOrder];
  const [removed] = newOrder.splice(draggedIndex, 1);
  newOrder.splice(targetIndex, 0, removed);

  // Update server
  try {
    await api.updatePhotoOrder(newOrder);
    setState({ photoOrder: newOrder });
    renderPhotoList();
  } catch (err) {
    console.error('Failed to reorder photos:', err);
  }
}

// Focal point modal
let focalModal = null;
let focalImage = null;
let focalCrosshair = null;
let currentFocalPhoto = null;

/**
 * Open focal point modal for a photo
 * @param {Object} photo - Photo object
 */
function openFocalPointModal(photo) {
  if (!focalModal) {
    focalModal = document.getElementById('focalPointModal');
    focalImage = document.getElementById('focalPointImage');
    focalCrosshair = document.getElementById('focalCrosshair');

    const preview = document.getElementById('focalPointPreview');
    preview.addEventListener('click', handleFocalPointClick);

    document.getElementById('closeFocalModal').addEventListener('click', closeFocalModal);
    focalModal.addEventListener('click', (e) => {
      if (e.target === focalModal) closeFocalModal();
    });
  }

  currentFocalPhoto = photo;
  focalImage.src = `/uploads/${photo.originalPath}`;

  // Position crosshair
  const fp = photo.focalPoint || { x: 0.5, y: 0.5 };
  updateCrosshairPosition(fp.x, fp.y);

  focalModal.classList.add('active');
}

/**
 * Close focal point modal
 */
function closeFocalModal() {
  focalModal.classList.remove('active');
  currentFocalPhoto = null;
}

/**
 * Handle click on focal point preview
 * @param {MouseEvent} e - Click event
 */
async function handleFocalPointClick(e) {
  const rect = focalImage.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  // Clamp to image bounds
  const clampedX = Math.max(0, Math.min(1, x));
  const clampedY = Math.max(0, Math.min(1, y));

  updateCrosshairPosition(clampedX, clampedY);

  // Save to server
  if (currentFocalPhoto) {
    try {
      await api.updateFocalPoint(currentFocalPhoto.id, clampedX, clampedY);

      // Update state
      const state = getState();
      const photos = state.photos.map(p => {
        if (p.id === currentFocalPhoto.id) {
          return { ...p, focalPoint: { x: clampedX, y: clampedY } };
        }
        return p;
      });
      setState({ photos });
      renderPhotoList();
    } catch (err) {
      console.error('Failed to update focal point:', err);
    }
  }
}

/**
 * Update crosshair position
 * @param {number} x - X position (0-1)
 * @param {number} y - Y position (0-1)
 */
function updateCrosshairPosition(x, y) {
  focalCrosshair.style.left = `${x * 100}%`;
  focalCrosshair.style.top = `${y * 100}%`;
}
