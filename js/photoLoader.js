/**
 * photoLoader.js - Handle drag-and-drop photo upload and EXIF extraction
 */

import { generateId } from './utils.js';

let photos = [];
let dropZone = null;
let fileInput = null;
let callback = null;

/**
 * Convert EXIF GPS DMS (degrees/minutes/seconds) to decimal degrees
 */
function toDecimal(dms, ref) {
  if (!dms || dms.length < 3) return null;

  const degrees = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return (ref === 'S' || ref === 'W') ? -degrees : degrees;
}

/**
 * Parse EXIF date string to Date object
 * Format: "YYYY:MM:DD HH:MM:SS"
 */
function parseExifDate(dateStr) {
  if (!dateStr) return null;

  try {
    // EXIF date format: "2024:01:15 14:30:00"
    const parts = dateStr.split(' ');
    if (parts.length < 2) return null;

    const dateParts = parts[0].split(':');
    const timeParts = parts[1].split(':');

    return new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1]),
      parseInt(timeParts[2])
    );
  } catch (e) {
    console.warn('Failed to parse EXIF date:', dateStr);
    return null;
  }
}

/**
 * Extract EXIF data from an image file
 */
function extractExif(file, img) {
  return new Promise((resolve) => {
    if (typeof EXIF === 'undefined') {
      console.warn('EXIF library not loaded');
      resolve({ lat: null, lon: null, date: null });
      return;
    }

    EXIF.getData(img, function() {
      try {
        const latDMS = EXIF.getTag(this, 'GPSLatitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const lonDMS = EXIF.getTag(this, 'GPSLongitude');
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');
        const dateStr = EXIF.getTag(this, 'DateTimeOriginal') || EXIF.getTag(this, 'DateTime');

        const lat = toDecimal(latDMS, latRef);
        const lon = toDecimal(lonDMS, lonRef);
        const date = parseExifDate(dateStr);

        console.log(`EXIF for ${file.name}: lat=${lat}, lon=${lon}, date=${date}`);
        resolve({ lat, lon, date });
      } catch (e) {
        console.warn('EXIF extraction error:', e);
        resolve({ lat: null, lon: null, date: null });
      }
    });
  });
}

/**
 * Process a single image file
 */
async function processFile(file) {
  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const img = new Image();

      img.onload = async () => {
        const exif = await extractExif(file, img);

        const photo = {
          id: generateId(),
          filename: file.name,
          src: e.target.result,
          img: img,
          lat: exif.lat,
          lon: exif.lon,
          date: exif.date,
          width: img.naturalWidth,
          height: img.naturalHeight,
          hasLocation: exif.lat !== null && exif.lon !== null
        };

        console.log(`Loaded: ${photo.filename} (${photo.width}x${photo.height}, GPS: ${photo.hasLocation})`);
        resolve(photo);
      };

      img.onerror = () => {
        console.warn('Failed to load image:', file.name);
        resolve(null);
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      console.warn('Failed to read file:', file.name);
      resolve(null);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Process multiple files
 */
async function processFiles(files) {
  const fileArray = Array.from(files);
  console.log(`Processing ${fileArray.length} files...`);

  const results = await Promise.all(fileArray.map(processFile));
  const newPhotos = results.filter(p => p !== null);

  photos = [...photos, ...newPhotos];

  const withGPS = photos.filter(p => p.hasLocation).length;
  console.log(`Total: ${photos.length} photos, ${withGPS} with GPS`);

  if (callback) {
    callback(photos);
  }

  return photos;
}

/**
 * Update the photo count display
 */
function updatePhotoCount() {
  const countEl = document.getElementById('photoCount');
  if (!countEl) return;

  if (photos.length === 0) {
    countEl.textContent = '';
  } else {
    const withGPS = photos.filter(p => p.hasLocation).length;
    countEl.textContent = `${photos.length} photos loaded (${withGPS} with GPS)`;
  }
}

/**
 * Initialize the photo loader
 */
export function initPhotoLoader(dropZoneId, onPhotosLoaded) {
  dropZone = document.getElementById(dropZoneId);
  fileInput = document.getElementById('fileInput');
  callback = onPhotosLoaded;

  if (!dropZone) {
    console.error('Drop zone not found:', dropZoneId);
    return;
  }

  // Click to browse
  dropZone.addEventListener('click', () => {
    fileInput?.click();
  });

  // File input change
  fileInput?.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await processFiles(e.target.files);
      updatePhotoCount();
    }
  });

  // Drag and drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFiles(files);
      updatePhotoCount();
    }
  });

  console.log('Photo loader initialized');
}

/**
 * Get all loaded photos
 */
export function getPhotos() {
  return photos;
}

/**
 * Clear all photos
 */
export function clearPhotos() {
  photos = [];
  updatePhotoCount();
  if (callback) {
    callback(photos);
  }
}

/**
 * Sample photo data with GPS coordinates
 * These represent a travel photo collection across several locations
 */
const SAMPLE_PHOTO_DATA = [
  // San Francisco cluster (5 photos)
  { lat: 37.7749, lon: -122.4194, label: 'SF Downtown', color: '#ff6b6b' },
  { lat: 37.7851, lon: -122.4056, label: 'Financial District', color: '#ff8787' },
  { lat: 37.7694, lon: -122.4862, label: 'Golden Gate', color: '#fa5252' },
  { lat: 37.8024, lon: -122.4058, label: 'North Beach', color: '#e64545' },
  { lat: 37.7599, lon: -122.4148, label: 'Mission', color: '#c92a2a' },
  // Los Angeles cluster (4 photos)
  { lat: 34.0522, lon: -118.2437, label: 'LA Downtown', color: '#4dabf7' },
  { lat: 34.0195, lon: -118.4912, label: 'Santa Monica', color: '#339af0' },
  { lat: 34.1014, lon: -118.3267, label: 'Hollywood', color: '#228be6' },
  { lat: 34.0259, lon: -118.7798, label: 'Malibu', color: '#1c7ed6' },
  // New York cluster (6 photos)
  { lat: 40.7128, lon: -74.0060, label: 'NYC Downtown', color: '#69db7c' },
  { lat: 40.7484, lon: -73.9857, label: 'Empire State', color: '#51cf66' },
  { lat: 40.7580, lon: -73.9855, label: 'Times Square', color: '#40c057' },
  { lat: 40.7829, lon: -73.9654, label: 'Central Park', color: '#37b24d' },
  { lat: 40.6892, lon: -74.0445, label: 'Statue Liberty', color: '#2f9e44' },
  { lat: 40.7061, lon: -73.9969, label: 'Brooklyn Bridge', color: '#2b8a3e' },
  // Seattle cluster (3 photos)
  { lat: 47.6062, lon: -122.3321, label: 'Seattle Downtown', color: '#da77f2' },
  { lat: 47.6205, lon: -122.3493, label: 'Space Needle', color: '#be4bdb' },
  { lat: 47.6101, lon: -122.3420, label: 'Pike Place', color: '#9c36b5' },
  // Chicago cluster (4 photos)
  { lat: 41.8781, lon: -87.6298, label: 'Chicago Loop', color: '#ffd43b' },
  { lat: 41.8826, lon: -87.6233, label: 'Millennium Park', color: '#fab005' },
  { lat: 41.8919, lon: -87.6051, label: 'Navy Pier', color: '#f59f00' },
  { lat: 41.8827, lon: -87.6080, label: 'Art Institute', color: '#f08c00' }
];

/**
 * Generate a sample photo image using canvas
 */
function generateSampleImage(data, index) {
  const canvas = document.createElement('canvas');
  const size = 400 + Math.floor(Math.random() * 200); // Random size between 400-600
  const isLandscape = Math.random() > 0.4;

  canvas.width = isLandscape ? size : Math.floor(size * 0.75);
  canvas.height = isLandscape ? Math.floor(size * 0.75) : size;

  const ctx = canvas.getContext('2d');

  // Fill with gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, data.color);
  gradient.addColorStop(1, adjustColor(data.color, -40));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add some visual interest with shapes
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 20 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add label
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.label, canvas.width / 2, canvas.height - 25);

  // Add photo number
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText(`${index + 1}`, canvas.width / 2, canvas.height / 2);

  return canvas;
}

/**
 * Adjust a hex color brightness
 */
function adjustColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

/**
 * Load sample photos with simulated GPS data
 */
export async function loadSamplePhotos() {
  console.log('Loading sample photos...');

  const samplePhotos = [];

  for (let i = 0; i < SAMPLE_PHOTO_DATA.length; i++) {
    const data = SAMPLE_PHOTO_DATA[i];
    const canvas = generateSampleImage(data, i);

    // Convert canvas to image
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = canvas.toDataURL('image/jpeg', 0.9);
    });

    // Add slight variation to GPS coordinates
    const latVariation = (Math.random() - 0.5) * 0.01;
    const lonVariation = (Math.random() - 0.5) * 0.01;

    const photo = {
      id: generateId(),
      filename: `sample_${i + 1}_${data.label.toLowerCase().replace(/\s+/g, '_')}.jpg`,
      src: img.src,
      img: img,
      lat: data.lat + latVariation,
      lon: data.lon + lonVariation,
      date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      width: canvas.width,
      height: canvas.height,
      hasLocation: true
    };

    samplePhotos.push(photo);
    console.log(`Generated sample: ${photo.filename} at (${photo.lat.toFixed(4)}, ${photo.lon.toFixed(4)})`);
  }

  // Replace existing photos with samples
  photos = samplePhotos;
  updatePhotoCount();

  if (callback) {
    callback(photos);
  }

  console.log(`Loaded ${photos.length} sample photos`);
  return photos;
}
