const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { uploadToYouTube } = require('../services/youtube');
const router = express.Router();

// Storage path
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
  limits: { fileSize: 256 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Formato não suportado. Use: mp4, mov, avi, mkv, webm'));
  }
});

// ─── Queue ────────────────────────────────────────────────────
let videoQueue = [];
let nextId = 1;
let schedulerRunning = false;

// ─── Upload ───────────────────────────────────────────────────
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const { title, description, tags, privacy, scheduledTime } = req.body;
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
      status: 'scheduled',  // scheduled, uploading, done, error
      youtubeId: null,
      error: null,
      scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
      postedAt: null,
      createdAt: new Date().toISOString()
    };

    videoQueue.push(video);

    // If no schedule or scheduled for now, process immediately
    if (!scheduledTime || new Date(scheduledTime) <= new Date()) {
      processVideo(video);
    }

    res.json({ success: true, video });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk Upload ──────────────────────────────────────────────
router.post('/upload-bulk', authMiddleware, upload.array('videos', 20), async (req, res) => {
  try {
    const { titles, descriptions, tags, privacy, startTime, intervalHours } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Nenhum vídeo enviado' });

    const titleList = titles ? JSON.parse(titles) : [];
    const descList = descriptions ? JSON.parse(descriptions) : [];
    const tagList = tags ? JSON.parse(tags) : [];
    const start = startTime ? new Date(startTime) : new Date();
    const interval = parseFloat(intervalHours) || 24; // default 24h between posts

    const results = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const scheduledFor = new Date(start.getTime() + (i * interval * 60 * 60 * 1000));

      const video = {
        id: nextId++,
        filename: file.filename,
        originalName: file.originalname,
        fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        title: titleList[i] || `Vídeo ${i + 1}`,
        description: descList[i] || '',
        tags: tagList[i] || [],
        privacy: privacy || 'private',
        status: 'scheduled',
        youtubeId: null,
        error: null,
        scheduledTime: scheduledFor.toISOString(),
        postedAt: null,
        createdAt: new Date().toISOString()
      };

      videoQueue.push(video);
      results.push(video);
    }

    res.json({ success: true, videos: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Queue ────────────────────────────────────────────────────
router.get('/queue', authMiddleware, (req, res) => {
  res.json(videoQueue);
});

// ─── Delete ───────────────────────────────────────────────────
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

// ─── Retry ────────────────────────────────────────────────────
router.post('/:id/retry', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const video = videoQueue.find(v => v.id === id);
  if (!video) return res.status(404).json({ error: 'Vídeo não encontrado' });
  if (video.status !== 'error') return res.status(400).json({ error: 'Só vídeos com erro podem ser reenviados' });

  video.status = 'scheduled';
  video.error = null;
  video.scheduledTime = new Date().toISOString();
  res.json({ success: true, video });
});

// ─── Update Schedule ──────────────────────────────────────────
router.put('/:id/schedule', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const video = videoQueue.find(v => v.id === id);
  if (!video) return res.status(404).json({ error: 'Vídeo não encontrado' });
  if (video.status !== 'scheduled') return res.status(400).json({ error: 'Só vídeos agendados podem ser reagendados' });

  const { scheduledTime } = req.body;
  video.scheduledTime = new Date(scheduledTime).toISOString();
  res.json({ success: true, video });
});

// ─── Process Video ────────────────────────────────────────────
async function processVideo(video) {
  video.status = 'uploading';
  try {
    const filePath = path.join(uploadsDir, video.filename);
    if (!fs.existsSync(filePath)) throw new Error('Arquivo de vídeo não encontrado');

    const result = await uploadToYouTube({
      filePath,
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacy: video.privacy
    });

    video.status = 'done';
    video.youtubeId = result.videoId;
    video.postedAt = new Date().toISOString();
    console.log(`[YT-Auto] ✅ Posted: "${video.title}" -> https://youtube.com/watch?v=${result.videoId}`);

    // Clean up file
    try { fs.unlinkSync(filePath); } catch {}
  } catch (err) {
    video.status = 'error';
    video.error = err.message;
    console.error(`[YT-Auto] ❌ Error: "${video.title}" - ${err.message}`);
  }
}

// ─── Scheduler (checks every 30s) ────────────────────────────
function startScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  setInterval(() => {
    const now = new Date();
    for (const video of videoQueue) {
      if (video.status === 'scheduled' && video.scheduledTime) {
        const scheduled = new Date(video.scheduledTime);
        if (scheduled <= now) {
          console.log(`[YT-Auto] ⏰ Scheduler: posting "${video.title}"`);
          processVideo(video);
        }
      }
    }
  }, 30 * 1000); // check every 30 seconds

  console.log('[YT-Auto] ⏰ Scheduler started');
}

// Start scheduler on module load
startScheduler();

module.exports = router;