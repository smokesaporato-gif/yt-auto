require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/video');
const youtubeRoutes = require('./routes/youtube');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - allow Render URL and localhost
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.RENDER_EXTERNAL_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(null, true); // allow all in dev
  }
}));

app.use(express.json());

// Uploads - serve static files
const uploadsPath = process.env.RENDER_DISK_MOUNT || path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/auth', youtubeRoutes);

// Health check for Render
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend in production
const frontendBuild = path.join(__dirname, '..', '..', 'frontend', 'build');
app.use(express.static(frontendBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[YT-Auto] Server running on port ${PORT}`);
  console.log(`[YT-Auto] Auth URL: /auth/login`);
});