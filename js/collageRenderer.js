/**
 * collageRenderer.js - Composite the final collage image (map + photos)
 */

// Cluster colors for debug overlay
const CLUSTER_COLORS = [
  'rgba(255, 99, 132, 0.4)',   // red
  'rgba(54, 162, 235, 0.4)',   // blue
  'rgba(75, 192, 192, 0.4)',   // green
  'rgba(255, 159, 64, 0.4)',   // orange
  'rgba(153, 102, 255, 0.4)',  // purple
  'rgba(255, 205, 86, 0.4)',   // yellow
  'rgba(201, 203, 207, 0.4)',  // grey
  'rgba(255, 99, 255, 0.4)',   // pink
];

const CLUSTER_SOLID_COLORS = [
  '#ff6384',
  '#36a2eb',
  '#4bc0c0',
  '#ff9f40',
  '#9966ff',
  '#ffcd56',
  '#c9cbcf',
  '#ff63ff',
];

/**
 * Render the complete collage
 *
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLCanvasElement} mapImage - Rendered map canvas
 * @param {Placement[]} placements - Photo placements from algorithm
 * @param {object} mapRect - Map rectangle {x, y, width, height}
 * @param {object} debugOptions - Debug overlay options
 * @param {Cluster[]} clusters - Clusters for debug overlay
 */
export function renderCollage(canvas, mapImage, placements, mapRect, debugOptions = {}, clusters = []) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas with background color
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Draw map image to cover full canvas
  if (mapImage) {
    ctx.drawImage(
      mapImage,
      0,
      0,
      width,
      height
    );
  }

  // Debug: draw region lines before photos
  if (debugOptions.showQuadrants) {
    drawRegionLines(ctx, mapRect, width, height);
  }

  // Sort placements by size (largest first, so smallest are on top)
  const sortedPlacements = [...placements].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return areaB - areaA;
  });

  // Draw each photo
  for (const placement of sortedPlacements) {
    drawPhoto(ctx, placement);

    // Debug: cluster color overlay
    if (debugOptions.showClusters) {
      drawClusterOverlay(ctx, placement);
    }

    // Debug: photo bounds
    if (debugOptions.showBounds) {
      drawPhotoBounds(ctx, placement);
    }
  }

  // Debug: cluster radiuses (from v2 algorithm - circles)
  if (debugOptions.showRadiuses && placements.clusterInfo) {
    drawClusterRadiuses(ctx, placements.clusterInfo);
  }

  // Debug: cluster ellipses (from v3 Edge Snap algorithm)
  if (debugOptions.showEllipses && placements.clusterInfo) {
    drawClusterEllipses(ctx, placements.clusterInfo);
  }

  // Debug: bounding boxes for placed photos per cluster
  if (debugOptions.showBboxes && placements.clusterInfo) {
    drawClusterBoundingBoxes(ctx, placements);
  }

  // Debug: pin markers
  if (debugOptions.showPins && placements.clusterInfo) {
    drawPinMarkersV2(ctx, placements.clusterInfo);
  } else if (debugOptions.showPins && clusters.length > 0) {
    drawPinMarkers(ctx, clusters, mapRect);
  }

  // Debug: fallback markers
  if (debugOptions.showFallback) {
    drawFallbackMarkers(ctx, placements);
  }
}

/**
 * Draw a single photo at its placement position
 */
function drawPhoto(ctx, placement) {
  const { photo, x, y, width, height, rotation } = placement;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);

  // Draw shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Draw white border (polaroid style)
  const borderSize = Math.min(width, height) * 0.04;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    -width / 2 - borderSize,
    -height / 2 - borderSize,
    width + borderSize * 2,
    height + borderSize * 2
  );

  // Reset shadow for photo
  ctx.shadowColor = 'transparent';

  // Draw the photo
  ctx.drawImage(
    photo.img,
    -width / 2,
    -height / 2,
    width,
    height
  );

  ctx.restore();
}

/**
 * Draw cluster color overlay on photo
 */
function drawClusterOverlay(ctx, placement) {
  const { x, y, width, height, rotation, clusterId } = placement;
  const color = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);

  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  ctx.restore();
}

/**
 * Draw photo bounding box
 */
function drawPhotoBounds(ctx, placement) {
  const { x, y, width, height, rotation } = placement;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  ctx.restore();
}

/**
 * Draw region boundary lines
 */
function drawRegionLines(ctx, mapRect, canvasWidth, canvasHeight) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);

  // Vertical lines at map edges
  ctx.beginPath();
  ctx.moveTo(mapRect.x, 0);
  ctx.lineTo(mapRect.x, canvasHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(mapRect.x + mapRect.width, 0);
  ctx.lineTo(mapRect.x + mapRect.width, canvasHeight);
  ctx.stroke();

  // Horizontal lines at map edges
  ctx.beginPath();
  ctx.moveTo(0, mapRect.y);
  ctx.lineTo(canvasWidth, mapRect.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, mapRect.y + mapRect.height);
  ctx.lineTo(canvasWidth, mapRect.y + mapRect.height);
  ctx.stroke();

  // Labels
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
  ctx.font = '12px monospace';

  const regions = ['NW', 'TOP', 'NE', 'LEFT', 'MAP', 'RIGHT', 'SW', 'BOTTOM', 'SE'];
  const positions = [
    { x: mapRect.x / 2, y: mapRect.y / 2 },
    { x: mapRect.x + mapRect.width / 2, y: mapRect.y / 2 },
    { x: mapRect.x + mapRect.width + (canvasWidth - mapRect.x - mapRect.width) / 2, y: mapRect.y / 2 },
    { x: mapRect.x / 2, y: mapRect.y + mapRect.height / 2 },
    { x: mapRect.x + mapRect.width / 2, y: mapRect.y + mapRect.height / 2 },
    { x: mapRect.x + mapRect.width + (canvasWidth - mapRect.x - mapRect.width) / 2, y: mapRect.y + mapRect.height / 2 },
    { x: mapRect.x / 2, y: mapRect.y + mapRect.height + (canvasHeight - mapRect.y - mapRect.height) / 2 },
    { x: mapRect.x + mapRect.width / 2, y: mapRect.y + mapRect.height + (canvasHeight - mapRect.y - mapRect.height) / 2 },
    { x: mapRect.x + mapRect.width + (canvasWidth - mapRect.x - mapRect.width) / 2, y: mapRect.y + mapRect.height + (canvasHeight - mapRect.y - mapRect.height) / 2 },
  ];

  regions.forEach((label, i) => {
    const pos = positions[i];
    ctx.fillText(label, pos.x - 10, pos.y + 4);
  });

  ctx.restore();
}

/**
 * Draw cluster ellipses (v3 Edge Snap algorithm debug)
 */
function drawClusterEllipses(ctx, clusterInfo) {
  ctx.save();

  for (let i = 0; i < clusterInfo.length; i++) {
    const cluster = clusterInfo[i];
    const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
    const ellipseMult = cluster.ellipseMult || 2.17;

    // Portrait ellipse: Y-axis stretched
    ctx.beginPath();
    ctx.ellipse(
      cluster.x, cluster.y,
      cluster.radius,                    // radiusX (width)
      cluster.radius * ellipseMult,      // radiusY (height stretched)
      0,                                 // rotation
      0, Math.PI * 2                     // full ellipse
    );
    ctx.fillStyle = color;
    ctx.fill();

    // Draw ellipse outline
    ctx.strokeStyle = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw bounding boxes for placed photos per cluster
 */
function drawClusterBoundingBoxes(ctx, placements) {
  // Group placements by cluster
  const clusterPlacements = new Map();

  for (const p of placements) {
    if (!clusterPlacements.has(p.clusterId)) {
      clusterPlacements.set(p.clusterId, []);
    }
    clusterPlacements.get(p.clusterId).push(p);
  }

  ctx.save();

  let colorIndex = 0;
  for (const [clusterId, placementList] of clusterPlacements) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of placementList) {
      const halfW = p.width / 2;
      const halfH = p.height / 2;

      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - halfH);
      maxY = Math.max(maxY, p.y + halfH);
    }

    // Draw bounding box
    ctx.strokeStyle = CLUSTER_SOLID_COLORS[colorIndex % CLUSTER_SOLID_COLORS.length];
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    colorIndex++;
  }

  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw cluster radiuses (v2 algorithm debug)
 */
function drawClusterRadiuses(ctx, clusterInfo) {
  ctx.save();

  for (let i = 0; i < clusterInfo.length; i++) {
    const cluster = clusterInfo[i];
    const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

    // Draw radius circle
    ctx.beginPath();
    ctx.arc(cluster.x, cluster.y, cluster.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw radius outline
    ctx.strokeStyle = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw pin markers using clusterInfo from v2 algorithm
 */
function drawPinMarkersV2(ctx, clusterInfo) {
  ctx.save();

  for (let i = 0; i < clusterInfo.length; i++) {
    const cluster = clusterInfo[i];
    const color = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];

    // Draw pin
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cluster.x, cluster.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw photo count label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cluster.photoCount.toString(), cluster.x, cluster.y);
  }

  ctx.restore();
}

/**
 * Draw fallback markers on photos placed via spiral fallback
 */
function drawFallbackMarkers(ctx, placements) {
  ctx.save();

  for (const placement of placements) {
    if (placement.isFallback) {
      const { x, y, width, height } = placement;

      // Draw orange border around fallback photos
      ctx.strokeStyle = '#ff9500';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(x - width / 2, y - height / 2, width, height);

      // Draw "F" marker
      ctx.fillStyle = '#ff9500';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', x, y - height / 2 - 12);
    }
  }

  ctx.restore();
}

/**
 * Draw cluster pin markers on map area
 */
function drawPinMarkers(ctx, clusters, mapRect, geoBounds) {
  ctx.save();

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const color = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];

    // Simple center position for pin (actual geo-mapping would need bounds)
    // For now, just distribute across map area based on cluster position
    const pinX = mapRect.x + mapRect.width / 2;
    const pinY = mapRect.y + mapRect.height / 2;

    // Draw pin
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pinX, pinY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw cluster label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cluster.photos.length.toString(), pinX, pinY + 3);
  }

  ctx.restore();
}

/**
 * Render collage with viewport transform (v3.1 Edge Snap Zoom)
 *
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {HTMLCanvasElement} mapImage - Rendered map canvas (at max viewport size)
 * @param {Placement[]} placements - Photo placements from algorithm (in master canvas coords)
 * @param {object} viewport - Viewport info {x, y, width, height, scaleX, scaleY}
 * @param {object} debugOptions - Debug overlay options
 * @param {number} mapToMasterRatio - Ratio of map size to master canvas size (default 2.0)
 */
export function renderCollageWithViewport(canvas, mapImage, placements, viewport, debugOptions = {}, mapToMasterRatio = 2.0) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas with background color
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Draw map image - extract viewport region from the larger map
  // The map is rendered at mapToMasterRatio × master canvas size
  // Viewport coords are in master canvas space, so we need to translate them
  // to map image space, accounting for the map being centered on the master canvas
  if (mapImage) {
    // The map is larger than master canvas, centered around the same center point
    // Map center = mapImage.width/2, mapImage.height/2
    // Master center = masterCanvas.width/2, masterCanvas.height/2
    // The offset to translate from master coords to map coords:
    const masterWidth = mapImage.width / mapToMasterRatio;
    const masterHeight = mapImage.height / mapToMasterRatio;
    const mapOffsetX = (mapImage.width - masterWidth) / 2;
    const mapOffsetY = (mapImage.height - masterHeight) / 2;

    // Translate viewport coords from master space to map image space
    const mapSourceX = mapOffsetX + viewport.x;
    const mapSourceY = mapOffsetY + viewport.y;
    const mapSourceW = viewport.width;
    const mapSourceH = viewport.height;

    ctx.drawImage(
      mapImage,
      // Source rectangle (from the larger map image)
      mapSourceX, mapSourceY, mapSourceW, mapSourceH,
      // Destination rectangle (full final canvas)
      0, 0, width, height
    );
  }

  // Set up viewport transform for photos
  ctx.save();

  // Scale from master canvas to final canvas
  ctx.scale(viewport.scaleX, viewport.scaleY);

  // Translate so viewport origin maps to canvas origin
  ctx.translate(-viewport.x, -viewport.y);

  // Set up clipping region (for 'crop' mode)
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();

  // Sort placements by size (largest first, so smallest are on top)
  const sortedPlacements = [...placements].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    return areaB - areaA;
  });

  // Draw each photo (in master canvas coordinates - transform handles scaling)
  for (const placement of sortedPlacements) {
    drawPhotoWithScaledShadow(ctx, placement, viewport.scaleX);

    // Debug: cluster color overlay
    if (debugOptions.showClusters) {
      drawClusterOverlay(ctx, placement);
    }

    // Debug: photo bounds
    if (debugOptions.showBounds) {
      drawPhotoBoundsScaled(ctx, placement, viewport.scaleX);
    }
  }

  // Debug: cluster ellipses (in master canvas coords)
  if (debugOptions.showEllipses && placements.clusterInfo) {
    drawClusterEllipsesScaled(ctx, placements.clusterInfo, viewport.scaleX);
  }

  // Debug: bounding boxes for placed photos per cluster
  if (debugOptions.showBboxes && placements.clusterInfo) {
    drawClusterBoundingBoxesScaled(ctx, placements, viewport.scaleX);
  }

  // Debug: pin markers
  if (debugOptions.showPins && placements.clusterInfo) {
    drawPinMarkersV2Scaled(ctx, placements.clusterInfo, viewport.scaleX);
  }

  ctx.restore();

  // Debug: viewport indicator (drawn in screen space)
  if (debugOptions.showViewport && placements.masterCanvas) {
    drawViewportDebug(ctx, viewport, placements.masterCanvas, { width, height });
  }
}

/**
 * Draw a single photo with shadow scaled appropriately for viewport
 */
function drawPhotoWithScaledShadow(ctx, placement, scale) {
  const { photo, x, y, width, height, rotation } = placement;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);

  // Draw shadow (scale shadow properties inversely to maintain consistent appearance)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10 / scale;
  ctx.shadowOffsetX = 3 / scale;
  ctx.shadowOffsetY = 3 / scale;

  // Draw white border (polaroid style)
  const borderSize = Math.min(width, height) * 0.04;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    -width / 2 - borderSize,
    -height / 2 - borderSize,
    width + borderSize * 2,
    height + borderSize * 2
  );

  // Reset shadow for photo
  ctx.shadowColor = 'transparent';

  // Draw the photo
  ctx.drawImage(
    photo.img,
    -width / 2,
    -height / 2,
    width,
    height
  );

  ctx.restore();
}

/**
 * Draw photo bounding box with scaled line width
 */
function drawPhotoBoundsScaled(ctx, placement, scale) {
  const { x, y, width, height, rotation } = placement;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([5 / scale, 5 / scale]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  ctx.restore();
}

/**
 * Draw cluster ellipses with scaled line width
 */
function drawClusterEllipsesScaled(ctx, clusterInfo, scale) {
  ctx.save();

  for (let i = 0; i < clusterInfo.length; i++) {
    const cluster = clusterInfo[i];
    const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
    const ellipseMult = cluster.ellipseMult || 2.17;

    // Portrait ellipse: Y-axis stretched
    ctx.beginPath();
    ctx.ellipse(
      cluster.x, cluster.y,
      cluster.radius,                    // radiusX (width)
      cluster.radius * ellipseMult,      // radiusY (height stretched)
      0,
      0, Math.PI * 2
    );
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw bounding boxes with scaled line width
 */
function drawClusterBoundingBoxesScaled(ctx, placements, scale) {
  const clusterPlacements = new Map();

  for (const p of placements) {
    if (!clusterPlacements.has(p.clusterId)) {
      clusterPlacements.set(p.clusterId, []);
    }
    clusterPlacements.get(p.clusterId).push(p);
  }

  ctx.save();

  let colorIndex = 0;
  for (const [clusterId, placementList] of clusterPlacements) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of placementList) {
      const halfW = p.width / 2;
      const halfH = p.height / 2;

      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - halfH);
      maxY = Math.max(maxY, p.y + halfH);
    }

    ctx.strokeStyle = CLUSTER_SOLID_COLORS[colorIndex % CLUSTER_SOLID_COLORS.length];
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([3 / scale, 3 / scale]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    colorIndex++;
  }

  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw pin markers with scaled size
 */
function drawPinMarkersV2Scaled(ctx, clusterInfo, scale) {
  ctx.save();

  for (let i = 0; i < clusterInfo.length; i++) {
    const cluster = clusterInfo[i];
    const color = CLUSTER_SOLID_COLORS[i % CLUSTER_SOLID_COLORS.length];
    const pinRadius = 10 / scale;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cluster.x, cluster.y, pinRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${11 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cluster.photoCount.toString(), cluster.x, cluster.y);
  }

  ctx.restore();
}

/**
 * Draw viewport debug overlay showing master canvas and viewport
 */
function drawViewportDebug(ctx, viewport, masterCanvas, finalCanvas) {
  ctx.save();

  // Draw mini master canvas representation in corner
  const miniScale = 0.15;
  const miniWidth = masterCanvas.width * miniScale;
  const miniHeight = masterCanvas.height * miniScale;
  const miniX = 10;
  const miniY = 10;

  // Master canvas outline
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(miniX, miniY, miniWidth, miniHeight);
  ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
  ctx.fillRect(miniX, miniY, miniWidth, miniHeight);

  // Viewport within master
  const vpMiniX = miniX + (viewport.x / masterCanvas.width) * miniWidth;
  const vpMiniY = miniY + (viewport.y / masterCanvas.height) * miniHeight;
  const vpMiniW = (viewport.width / masterCanvas.width) * miniWidth;
  const vpMiniH = (viewport.height / masterCanvas.height) * miniHeight;

  ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(vpMiniX, vpMiniY, vpMiniW, vpMiniH);
  ctx.fillStyle = 'rgba(255, 100, 100, 0.1)';
  ctx.fillRect(vpMiniX, vpMiniY, vpMiniW, vpMiniH);

  // Labels
  ctx.fillStyle = '#333';
  ctx.font = '10px sans-serif';
  ctx.fillText('Master Canvas', miniX, miniY - 3);
  ctx.fillStyle = '#c00';
  ctx.fillText('Viewport', vpMiniX, vpMiniY - 3);

  // Zoom info
  ctx.fillStyle = '#333';
  ctx.fillText(`Zoom: ${viewport.scaleX.toFixed(2)}×`, miniX, miniY + miniHeight + 12);

  ctx.restore();
}

/**
 * Save canvas as PNG file
 */
export function saveAsPng(canvas, filename = 'collage.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Calculate map rectangle based on canvas size and percentage
 */
export function calculateMapRect(canvasSize, mapAreaPercent) {
  const mapWidth = canvasSize.width * (mapAreaPercent / 100);
  const mapHeight = canvasSize.height * (mapAreaPercent / 100);

  return {
    x: (canvasSize.width - mapWidth) / 2,
    y: (canvasSize.height - mapHeight) / 2,
    width: mapWidth,
    height: mapHeight
  };
}
