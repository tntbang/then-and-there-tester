const express = require('express');
const path = require('path');
const photosRouter = require('./routes/photos');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/photos', photosRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Pinboard Tester server running at http://localhost:${PORT}`);
});
