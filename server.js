const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Create upload directory if it doesn't exist
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer storage: store files with original filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const finalPath = path.join(UPLOAD_DIR, file.originalname);
    if (fs.existsSync(finalPath)) {
      // Reject upload gracefully
      return cb(new Error('FileExists'));
    }
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.message === 'FileExists') {
        return res.status(409).json({ error: 'File already exists', filename: req.file?.originalname });
      }
      return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ message: 'Uploaded', filename: req.file.originalname });
  });
});


// List uploaded files
app.get('/files', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to read uploads' });
    const out = files.map(f => {
      const stats = fs.statSync(path.join(UPLOAD_DIR, f));
      return {
        name: f,
        url: `/download/${encodeURIComponent(f)}`,
        size: stats.size,
        mtime: stats.mtime
      };
    });
    res.json(out);
  });
});

app.delete('/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..')) return res.status(400).json({ error: 'Invalid filename' });
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ error: 'Failed to delete file' });
    res.json({ message: 'Deleted' });
  });
});

// Download route (safe)
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent path traversal
  if (filename.includes('..')) return res.status(400).send('Invalid filename');

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  res.download(filePath, filename, (err) => {
    if (err) console.error('Download error', err);
  });
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
