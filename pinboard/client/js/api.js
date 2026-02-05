// API wrapper functions for server communication

const API_BASE = '/api';

/**
 * Fetch all photos from the server
 * @returns {Promise<{photos: Array, order: Array}>}
 */
export async function fetchPhotos() {
  const response = await fetch(`${API_BASE}/photos`);
  if (!response.ok) {
    throw new Error('Failed to fetch photos');
  }
  return response.json();
}

/**
 * Upload photos to the server
 * @param {FileList|File[]} files - Files to upload
 * @returns {Promise<{photos: Array}>}
 */
export async function uploadPhotos(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }

  const response = await fetch(`${API_BASE}/photos`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload photos');
  }
  return response.json();
}

/**
 * Delete a single photo
 * @param {string} id - Photo ID to delete
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePhoto(id) {
  const response = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Failed to delete photo');
  }
  return response.json();
}

/**
 * Delete all photos
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteAllPhotos() {
  const response = await fetch(`${API_BASE}/photos`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Failed to delete all photos');
  }
  return response.json();
}

/**
 * Update photo order
 * @param {string[]} order - Array of photo IDs in desired order
 * @returns {Promise<{success: boolean}>}
 */
export async function updatePhotoOrder(order) {
  const response = await fetch(`${API_BASE}/photos/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });

  if (!response.ok) {
    throw new Error('Failed to update photo order');
  }
  return response.json();
}

/**
 * Update photo focal point
 * @param {string} id - Photo ID
 * @param {number} x - Focal X (0-1)
 * @param {number} y - Focal Y (0-1)
 * @returns {Promise<{success: boolean}>}
 */
export async function updateFocalPoint(id, x, y) {
  const response = await fetch(`${API_BASE}/photos/${id}/focal`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y })
  });

  if (!response.ok) {
    throw new Error('Failed to update focal point');
  }
  return response.json();
}
