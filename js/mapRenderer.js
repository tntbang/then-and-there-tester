/**
 * mapRenderer.js - Generate a map image for collage background
 *
 * Uses direct tile fetching with CORS-enabled tile servers
 * to render map tiles onto a canvas.
 */

// Available map styles with CORS-enabled tile servers
// Note: Stamen tiles moved to Stadia Maps hosting
export const MAP_STYLES = {
  streets: {
    name: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap'
  },
  terrain: {
    name: 'Terrain',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
    attribution: 'Stadia Maps / Stamen Terrain'
  },
  toner: {
    name: 'Toner (B&W)',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
    attribution: 'Stadia Maps / Stamen Toner'
  },
  watercolor: {
    name: 'Watercolor',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: 'Stadia Maps / Stamen Watercolor'
  },
  cartodb_light: {
    name: 'Light',
    url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: 'CartoDB'
  },
  cartodb_dark: {
    name: 'Dark',
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: 'CartoDB'
  },
  cartodb_voyager: {
    name: 'Voyager',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: 'CartoDB Voyager'
  }
};

let currentStyle = 'cartodb_voyager';

/**
 * Set the current map style
 */
export function setMapStyle(styleName) {
  if (MAP_STYLES[styleName]) {
    currentStyle = styleName;
    console.log('Map style set to:', styleName);
  } else {
    console.warn('Unknown map style:', styleName);
  }
}

/**
 * Get current map style name
 */
export function getMapStyle() {
  return currentStyle;
}

/**
 * Initialize the map renderer (no-op for this implementation)
 */
export function initMap(containerId) {
  console.log('Map renderer initialized (direct tile fetching)');
}

/**
 * Convert lat/lon to tile coordinates
 */
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Convert tile coordinates back to lat/lon (top-left corner of tile)
 */
function tileToLatLon(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lon = x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = latRad * 180 / Math.PI;
  return { lat, lon };
}

/**
 * Calculate appropriate zoom level for given bounds and canvas size
 */
function calculateZoom(minLat, maxLat, minLon, maxLon, width, height) {
  const TILE_SIZE = 256;

  for (let zoom = 18; zoom >= 1; zoom--) {
    const topLeft = latLonToTile(maxLat, minLon, zoom);
    const bottomRight = latLonToTile(minLat, maxLon, zoom);

    const tilesX = bottomRight.x - topLeft.x + 1;
    const tilesY = bottomRight.y - topLeft.y + 1;

    const mapWidth = tilesX * TILE_SIZE;
    const mapHeight = tilesY * TILE_SIZE;

    if (mapWidth <= width * 2 && mapHeight <= height * 2) {
      return zoom;
    }
  }
  return 1;
}

/**
 * Load a single tile image
 */
function loadTile(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Failed to load tile:', url);
      resolve(null); // Resolve with null instead of rejecting
    };

    img.src = url;
  });
}

/**
 * Calculate bounding box from clusters with padding
 */
function calculateBounds(clusters, padding = 0.2) {
  if (!clusters || clusters.length === 0) {
    return { minLat: -45, maxLat: 45, minLon: -90, maxLon: 90 };
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const cluster of clusters) {
    minLat = Math.min(minLat, cluster.bounds.south);
    maxLat = Math.max(maxLat, cluster.bounds.north);
    minLon = Math.min(minLon, cluster.bounds.west);
    maxLon = Math.max(maxLon, cluster.bounds.east);
  }

  // Add padding
  let latPad = (maxLat - minLat) * padding;
  let lonPad = (maxLon - minLon) * padding;

  // Ensure minimum bounds for single-point clusters
  const minSpan = 0.005;
  if (maxLat - minLat < minSpan) {
    latPad = minSpan;
  }
  if (maxLon - minLon < minSpan) {
    lonPad = minSpan;
  }

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad
  };
}

/**
 * Render a map snapshot for the given clusters
 *
 * @param {Cluster[]} clusters - Clusters to show on map
 * @param {number} width - Target canvas width
 * @param {number} height - Target canvas height
 * @param {number} padding - Padding around bounds (0-1)
 * @param {number} zoomMult - Zoom multiplier (>1 = zoom out, <1 = zoom in)
 * @returns {Promise<HTMLCanvasElement>} Canvas with rendered map
 */
export async function renderMapSnapshot(clusters, width, height, padding = 0.2, zoomMult = 1.0) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fill with background color
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, width, height);

  // Apply zoom multiplier to padding (higher mult = more zoomed out = more padding)
  const adjustedPadding = padding * zoomMult;
  const bounds = calculateBounds(clusters, adjustedPadding);
  const { minLat, maxLat, minLon, maxLon } = bounds;

  console.log('Rendering map for bounds:', bounds);

  // Calculate zoom level
  const zoom = calculateZoom(minLat, maxLat, minLon, maxLon, width, height);
  console.log('Using zoom level:', zoom);

  // Get tile range
  const topLeftTile = latLonToTile(maxLat, minLon, zoom);
  const bottomRightTile = latLonToTile(minLat, maxLon, zoom);

  // Get the lat/lon of the tile corners for accurate positioning
  const topLeftCorner = tileToLatLon(topLeftTile.x, topLeftTile.y, zoom);
  const bottomRightCorner = tileToLatLon(bottomRightTile.x + 1, bottomRightTile.y + 1, zoom);

  // Calculate the full map dimensions in pixels
  const TILE_SIZE = 256;
  const tilesX = bottomRightTile.x - topLeftTile.x + 1;
  const tilesY = bottomRightTile.y - topLeftTile.y + 1;
  const fullMapWidth = tilesX * TILE_SIZE;
  const fullMapHeight = tilesY * TILE_SIZE;

  // Calculate scale and offset to fit/center the map
  const scaleX = width / fullMapWidth;
  const scaleY = height / fullMapHeight;
  const scale = Math.max(scaleX, scaleY); // Use max to fill the canvas

  const scaledWidth = fullMapWidth * scale;
  const scaledHeight = fullMapHeight * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

  // Get tile URL template
  const style = MAP_STYLES[currentStyle];
  const urlTemplate = style.url;

  // Collect all tile load promises
  const tilePromises = [];
  const tilePositions = [];

  for (let y = topLeftTile.y; y <= bottomRightTile.y; y++) {
    for (let x = topLeftTile.x; x <= bottomRightTile.x; x++) {
      const url = urlTemplate
        .replace('{z}', zoom)
        .replace('{x}', x)
        .replace('{y}', y);

      tilePromises.push(loadTile(url));
      tilePositions.push({
        x: (x - topLeftTile.x) * TILE_SIZE * scale + offsetX,
        y: (y - topLeftTile.y) * TILE_SIZE * scale + offsetY,
        width: TILE_SIZE * scale,
        height: TILE_SIZE * scale
      });
    }
  }

  console.log(`Loading ${tilePromises.length} tiles...`);

  // Wait for all tiles to load
  const tiles = await Promise.all(tilePromises);

  // Draw tiles onto canvas
  let loadedCount = 0;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const pos = tilePositions[i];

    if (tile) {
      ctx.drawImage(tile, pos.x, pos.y, pos.width, pos.height);
      loadedCount++;
    }
  }

  console.log(`Rendered ${loadedCount}/${tiles.length} tiles`);

  // Add subtle vignette effect for polish
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

/**
 * Get geographic bounds info for coordinate mapping
 */
export function getGeoBounds(clusters) {
  if (!clusters || clusters.length === 0) {
    return null;
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const cluster of clusters) {
    minLat = Math.min(minLat, cluster.bounds.south);
    maxLat = Math.max(maxLat, cluster.bounds.north);
    minLon = Math.min(minLon, cluster.bounds.west);
    maxLon = Math.max(maxLon, cluster.bounds.east);
  }

  return {
    minLat, maxLat, minLon, maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2
  };
}
