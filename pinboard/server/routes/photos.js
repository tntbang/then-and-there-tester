const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Paths
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const ORIGINALS_DIR = path.join(UPLOADS_DIR, 'originals');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
const MANIFEST_PATH = path.join(UPLOADS_DIR, 'manifest.json');

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
}

// Read manifest
async function readManifest() {
  try {
    const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { photos: [], order: [] };
  }
}

// Write manifest
async function writeManifest(manifest) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// GET /api/photos - List all photos
router.get('/', async (req, res) => {
  try {
    const manifest = await readManifest();
    res.json({ photos: manifest.photos, order: manifest.order });
  } catch (err) {
    console.error('Error reading photos:', err);
    res.status(500).json({ error: 'Failed to read photos' });
  }
});

// POST /api/photos - Upload photo(s)
router.post('/', upload.array('photos', 50), async (req, res) => {
  try {
    await ensureDirectories();
    const manifest = await readManifest();
    const newPhotos = [];

    for (const file of req.files) {
      const id = uuidv4();
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const originalFilename = `${id}${ext}`;
      const thumbnailFilename = `${id}.jpg`;

      // Get image metadata
      const metadata = await sharp(file.buffer).metadata();

      // Save original
      await sharp(file.buffer)
        .toFile(path.join(ORIGINALS_DIR, originalFilename));

      // Generate thumbnail (300px max dimension)
      await sharp(file.buffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(path.join(THUMBNAILS_DIR, thumbnailFilename));

      const photo = {
        id,
        filename: file.originalname,
        originalPath: `originals/${originalFilename}`,
        thumbnailPath: `thumbnails/${thumbnailFilename}`,
        width: metadata.width,
        height: metadata.height,
        aspectRatio: metadata.width / metadata.height,
        focalPoint: { x: 0.5, y: 0.5 },
        dominantColors: [],
        uploadedAt: new Date().toISOString()
      };

      manifest.photos.push(photo);
      manifest.order.push(id);
      newPhotos.push(photo);
    }

    await writeManifest(manifest);
    res.json({ photos: newPhotos });
  } catch (err) {
    console.error('Error uploading photos:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// DELETE /api/photos/:id - Delete single photo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const manifest = await readManifest();

    const photoIndex = manifest.photos.findIndex(p => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = manifest.photos[photoIndex];

    // Delete files
    try {
      await fs.unlink(path.join(UPLOADS_DIR, photo.originalPath));
    } catch (err) { /* File may not exist */ }
    try {
      await fs.unlink(path.join(UPLOADS_DIR, photo.thumbnailPath));
    } catch (err) { /* File may not exist */ }

    // Remove from manifest
    manifest.photos.splice(photoIndex, 1);
    manifest.order = manifest.order.filter(orderId => orderId !== id);

    await writeManifest(manifest);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// DELETE /api/photos - Delete all photos
router.delete('/', async (req, res) => {
  try {
    // Clear directories
    try {
      const originals = await fs.readdir(ORIGINALS_DIR);
      for (const file of originals) {
        await fs.unlink(path.join(ORIGINALS_DIR, file));
      }
    } catch (err) { /* Directory may not exist */ }

    try {
      const thumbnails = await fs.readdir(THUMBNAILS_DIR);
      for (const file of thumbnails) {
        await fs.unlink(path.join(THUMBNAILS_DIR, file));
      }
    } catch (err) { /* Directory may not exist */ }

    // Reset manifest
    await writeManifest({ photos: [], order: [] });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting all photos:', err);
    res.status(500).json({ error: 'Failed to delete all photos' });
  }
});

// PUT /api/photos/order - Reorder photos
router.put('/order', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    const manifest = await readManifest();
    const existingIds = new Set(manifest.photos.map(p => p.id));

    // Validate all IDs exist
    for (const id of order) {
      if (!existingIds.has(id)) {
        return res.status(400).json({ error: `Invalid photo ID: ${id}` });
      }
    }

    // Validate all photos are included
    if (order.length !== manifest.photos.length) {
      return res.status(400).json({ error: 'Order must include all photo IDs' });
    }

    manifest.order = order;
    await writeManifest(manifest);
    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering photos:', err);
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
});

// PUT /api/photos/:id/focal - Update focal point
router.put('/:id/focal', async (req, res) => {
  try {
    const { id } = req.params;
    const { x, y } = req.body;

    if (typeof x !== 'number' || typeof y !== 'number' ||
        x < 0 || x > 1 || y < 0 || y > 1) {
      return res.status(400).json({ error: 'Focal point x and y must be numbers between 0 and 1' });
    }

    const manifest = await readManifest();
    const photo = manifest.photos.find(p => p.id === id);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    photo.focalPoint = { x, y };
    await writeManifest(manifest);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating focal point:', err);
    res.status(500).json({ error: 'Failed to update focal point' });
  }
});

module.exports = router;
