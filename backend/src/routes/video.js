const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { uploadToYouTube } = require('../services/youtube');
const router = express.Router();

// Storage path - Render persistent disk or local
const uploadsDir = process.env.RENDER_DISK_MOUNT || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 256 * 1024 * 1024 }, // 256MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Formato não suportado. Use: mp4, mov, avi, mkv, webm'));
  }
});

// In-memory queue (persists across requests but not across restarts)
let videoQueue = [];
let nextId = 1;

// Upload video
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const { title, description, tags, privacy } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const video = {
      id: nextId++,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: (req.file.size / 1024 / 1024).toFixed(1) + ' MB',
      title,
      description: description || '',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      privacy: privacy || 'private',
      status: 'pending',
      youtubeId: null,
      error: null,
      createdAt: new Date().toISOString()
    };

    videoQueue.push(video);

    // Auto-upload in background
    processVideo(video);

    res.json({ success: true, video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get queue
router.get('/queue', authMiddleware, (req, res) => {
  res.json(videoQueue);
});

// Delete video
router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = videoQueue.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Vídeo não encontrado' });

  const video = videoQueue[idx];
  const filePath = path.join(uploadsDir, video.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  videoQueue.splice(idx, 1);
  res.json({ success: true });
});

// Retry failed upload
router.post('/:id/retry', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const video = videoQueue.find(v => v.id === id);
  if (!video) return res.status(404).json({ error: 'Vídeo não encontrado' });
  if (video.status !== 'error') return res.status(400).json({ error: 'Só vídeos com erro podem ser reenviados' });

  video.status = 'pending';
  video.error = null;
  processVideo(video);
  res.json({ success: true, video });
});

// Process video upload to YouTube
async function processVideo(video) {
  video.status = 'uploading';
  try {
    const filePath = path.join(uploadsDir, video.filename);

    if (!fs.existsSync(filePath)) {
      throw new Error('Arquivo de vídeo não encontrado');
    }

    const result = await uploadToYouTube({
      filePath,
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacy: video.privacy
    });

    video.status = 'done';
    video.youtubeId = result.videoId;
    console.log(`[YT-Auto] ✅ Uploaded: "${video.title}" -> https://youtube.com/watch?v=${result.videoId}`);

    // Clean up file after successful upload
    try {
      fs.unlinkSync(filePath);
      console.log(`[YT-Auto] 🗑️ Cleaned up: ${video.filename}`);
    } catch {}
  } catch (err) {
    video.status = 'error';
    video.error = err.message;
    console.error(`[YT-Auto] ❌ Error: "${video.title}" - ${err.message}`);
  }
}

module.exports = router;