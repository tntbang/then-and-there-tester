# Map Rendering — Supplemental Plan

This document fills in the gaps from `plan.md` regarding map background rendering.

---

## Problem

The collage needs a map image as its background. Leaflet renders maps using DOM elements and async tile loading, which can't be directly drawn to a canvas. We need to capture the map as an image.

---

## Solution: Two Approaches

### Approach A: Leaflet + html2canvas (Simpler)

Use `html2canvas` library to screenshot the Leaflet map container.

**Pros:** Works with any Leaflet setup, simple concept  
**Cons:** Can be slow, sometimes has rendering quirks

**Implementation:**

```javascript
// mapRenderer.js

import L from 'leaflet';

let map = null;
let mapContainer = null;

export function initMap(containerId) {
  mapContainer = document.getElementById(containerId);
  
  // Make container visible but positioned off-screen for rendering
  mapContainer.style.position = 'absolute';
  mapContainer.style.left = '-9999px';
  mapContainer.style.width = '1000px';
  mapContainer.style.height = '1000px';
  
  map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false
  });
  
  // Default to street style
  setMapStyle('street');
}

export function setMapStyle(style) {
  // Remove existing tile layer
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      map.removeLayer(layer);
    }
  });
  
  // Add new tile layer based on style
  const tileUrl = getTileUrl(style);
  L.tileLayer(tileUrl, {
    maxZoom: 19
  }).addTo(map);
}

function getTileUrl(style) {
  switch (style) {
    case 'street':
      // OpenStreetMap standard
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      
    case 'satellite':
      // ESRI World Imagery (free, no API key)
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      
    case 'terrain':
      // OpenTopoMap (topographic)
      return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      
    case 'light':
      // CartoDB Positron (minimal, light)
      return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      
    case 'dark':
      // CartoDB Dark Matter (minimal, dark)
      return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      
    case 'watercolor':
      // Stamen Watercolor (artistic)
      return 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg';
      
    default:
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
}

export async function renderMapSnapshot(clusters, width, height, padding = 0.2) {
  // Calculate bounds from cluster centroids
  const lats = clusters.map(c => c.centroid.lat);
  const lons = clusters.map(c => c.centroid.lon);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  
  // Add padding
  const latPadding = (maxLat - minLat) * padding;
  const lonPadding = (maxLon - minLon) * padding;
  
  const bounds = L.latLngBounds(
    [minLat - latPadding, minLon - lonPadding],
    [maxLat + latPadding, maxLon + lonPadding]
  );
  
  // Resize container to match desired output
  mapContainer.style.width = width + 'px';
  mapContainer.style.height = height + 'px';
  map.invalidateSize();
  
  // Fit map to bounds
  map.fitBounds(bounds);
  
  // Wait for tiles to load
  await waitForTiles();
  
  // Capture with html2canvas
  const canvas = await html2canvas(mapContainer, {
    useCORS: true,
    allowTaint: true,
    width: width,
    height: height
  });
  
  return canvas;
}

function waitForTiles() {
  return new Promise(resolve => {
    // Check if tiles are loaded
    let checkCount = 0;
    const maxChecks = 50; // 5 seconds max
    
    const check = () => {
      checkCount++;
      
      // Look for loading tiles
      const loadingTiles = mapContainer.querySelectorAll('.leaflet-tile-loading');
      
      if (loadingTiles.length === 0 || checkCount >= maxChecks) {
        // Additional buffer for rendering
        setTimeout(resolve, 200);
      } else {
        setTimeout(check, 100);
      }
    };
    
    // Initial delay for tile requests to start
    setTimeout(check, 300);
  });
}
```

**Required Library:**
Add html2canvas to your project:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
```

---

### Approach B: Static Tile Fetching (More Reliable)

Directly fetch map tiles and composite them onto canvas. No DOM rendering needed.

**Pros:** More reliable, works offline after cache, full control  
**Cons:** More code, need to handle tile math

**Implementation:**

```javascript
// mapRenderer.js

const TILE_SIZE = 256;

export async function renderMapSnapshot(clusters, width, height, style = 'street', padding = 0.2) {
  // Calculate bounds
  const lats = clusters.map(c => c.centroid.lat);
  const lons = clusters.map(c => c.centroid.lon);
  
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  
  // Add padding
  const latPadding = (maxLat - minLat) * padding || 0.01;
  const lonPadding = (maxLon - minLon) * padding || 0.01;
  
  minLat -= latPadding;
  maxLat += latPadding;
  minLon -= lonPadding;
  maxLon += lonPadding;
  
  // Calculate appropriate zoom level
  const zoom = calculateZoom(minLat, maxLat, minLon, maxLon, width, height);
  
  // Get center point
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  
  // Calculate which tiles we need
  const tiles = getTilesForBounds(minLat, maxLat, minLon, maxLon, zoom);
  
  // Create output canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Fill background (in case tiles don't cover everything)
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, width, height);
  
  // Fetch and draw tiles
  const tileUrl = getTileUrlTemplate(style);
  await drawTiles(ctx, tiles, zoom, tileUrl, centerLat, centerLon, width, height);
  
  return canvas;
}

function getTileUrlTemplate(style) {
  const templates = {
    'street': 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'satellite': 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'terrain': 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    'light': 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    'dark': 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
  };
  return templates[style] || templates['street'];
}

function calculateZoom(minLat, maxLat, minLon, maxLon, width, height) {
  const WORLD_DIM = { height: 256, width: 256 };
  const ZOOM_MAX = 18;

  function latRad(lat) {
    const sin = Math.sin(lat * Math.PI / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  }

  function zoom(mapPx, worldPx, fraction) {
    return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
  }

  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  const lonDiff = maxLon - minLon;
  const lonFraction = ((lonDiff < 0) ? (lonDiff + 360) : lonDiff) / 360;

  const latZoom = zoom(height, WORLD_DIM.height, latFraction);
  const lonZoom = zoom(width, WORLD_DIM.width, lonFraction);

  return Math.min(latZoom, lonZoom, ZOOM_MAX);
}

function getTilesForBounds(minLat, maxLat, minLon, maxLon, zoom) {
  const tiles = [];
  
  const minTile = latLonToTile(maxLat, minLon, zoom); // NW corner
  const maxTile = latLonToTile(minLat, maxLon, zoom); // SE corner
  
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  
  return tiles;
}

function latLonToTile(lat, lon, zoom) {
  const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

function tileToLatLon(x, y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lon = x / Math.pow(2, zoom) * 360 - 180;
  return { lat, lon };
}

async function drawTiles(ctx, tiles, zoom, tileUrlTemplate, centerLat, centerLon, canvasWidth, canvasHeight) {
  // Calculate center tile position
  const centerTile = latLonToTile(centerLat, centerLon, zoom);
  const centerTileLatLon = tileToLatLon(centerTile.x, centerTile.y, zoom);
  
  // Pixel offset within center tile
  const pixelsPerTile = TILE_SIZE;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Load all tiles
  const tileImages = await Promise.all(tiles.map(async tile => {
    const url = tileUrlTemplate
      .replace('{z}', tile.z)
      .replace('{x}', tile.x)
      .replace('{y}', tile.y);
    
    try {
      const img = await loadImage(url);
      return { ...tile, img };
    } catch (e) {
      console.warn(`Failed to load tile ${tile.x},${tile.y},${tile.z}`);
      return { ...tile, img: null };
    }
  }));
  
  // Draw tiles
  for (const tile of tileImages) {
    if (!tile.img) continue;
    
    // Calculate position relative to center
    const offsetX = (tile.x - centerTile.x) * pixelsPerTile;
    const offsetY = (tile.y - centerTile.y) * pixelsPerTile;
    
    const drawX = centerX + offsetX - pixelsPerTile / 2;
    const drawY = centerY + offsetY - pixelsPerTile / 2;
    
    ctx.drawImage(tile.img, drawX, drawY, pixelsPerTile, pixelsPerTile);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

---

## Recommended Approach

**Use Approach B (Static Tile Fetching)** because:
1. More reliable across browsers
2. No extra DOM manipulation
3. Works better when map is a portion of the canvas (not full size)
4. Direct control over what gets rendered

---

## Map Styles Available

| Style | Description | Good For |
|-------|-------------|----------|
| `street` | Standard OpenStreetMap | Default, clear labels |
| `satellite` | ESRI aerial imagery | Beach trips, nature |
| `terrain` | OpenTopoMap topographic | Hiking, mountains |
| `light` | CartoDB Positron | Minimal, modern |
| `dark` | CartoDB Dark Matter | Night mode, dramatic |

---

## UI Addition

Add a map style selector to the controls:

```html
<div class="control-group">
  <label>Map Style</label>
  <select id="mapStyle">
    <option value="street">Street</option>
    <option value="satellite">Satellite</option>
    <option value="terrain">Terrain</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
</div>
```

---

## Integration with collageRenderer.js

The map snapshot should be rendered first, then photos drawn on top:

```javascript
export async function renderCollage(canvas, clusters, placements, config, debugOptions) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  // 1. Clear canvas
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, width, height);
  
  // 2. Calculate map rect (centered, based on mapAreaPercent)
  const mapSize = Math.min(width, height) * (config.layout.mapAreaPercent / 100);
  const mapRect = {
    x: (width - mapSize) / 2,
    y: (height - mapSize) / 2,
    width: mapSize,
    height: mapSize
  };
  
  // 3. Render map snapshot
  const mapCanvas = await renderMapSnapshot(
    clusters,
    mapRect.width,
    mapRect.height,
    config.mapStyle || 'street'
  );
  
  // 4. Draw map onto main canvas
  ctx.drawImage(mapCanvas, mapRect.x, mapRect.y);
  
  // 5. Draw photos
  for (const placement of placements) {
    drawPhoto(ctx, placement);
  }
  
  // 6. Draw debug overlays if enabled
  if (debugOptions.showQuadrants) {
    drawRegionLines(ctx, mapRect, width, height);
  }
  // ... other debug overlays
}
```

---

## Troubleshooting

**Blank map / CORS errors:**
- Some tile servers block cross-origin requests
- ESRI and CartoDB tiles generally work
- OSM tiles work but may rate-limit

**Map doesn't match photo locations:**
- Verify EXIF GPS extraction is working (log lat/lon values)
- Check bounds calculation includes all clusters

**Map is zoomed too far in/out:**
- Adjust padding parameter (default 0.2 = 20%)
- Check zoom calculation logic

**Tiles loading slowly:**
- Tiles are fetched over network
- Consider caching or using fewer tiles

---

## Summary of Changes to plan.md

1. Add `html2canvas` OR implement static tile fetching in `mapRenderer.js`
2. Add map style selector to UI
3. Add `mapStyle` to config object
4. Update file structure if adding html2canvas library
5. Wire map style changes to trigger re-render

---

**Document Version:** 1.0  
**Purpose:** Supplement to plan.md for map rendering implementation
