const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const app = express();

app.use(cors());

const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
const outputDir = path.join(__dirname, 'output');

// Create necessary directories
[uploadsDir, publicDir, outputDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({ dest: uploadsDir });

app.use(express.static(publicDir));

app.post('/mix', upload.array('audio', 2), (req, res) => {
  if (req.files.length !== 2) {
    return res.status(400).send('Please upload exactly two audio files.');
  }

  const outputPath = path.join(outputDir, 'mixed.aac');

  ffmpeg()
    .input(req.files[0].path)
    .input(req.files[1].path)
    .complexFilter([
      '[0:a][1:a]amix=inputs=2:duration=longest[outa]'
    ])
    .outputOptions('-map [outa]')
    .outputOptions('-c:a aac')
    .outputOptions('-b:a 128k')
    .save(outputPath)
    .on('error', (err) => {
      console.error('An error occurred: ' + err.message);
      res.status(500).send('Error mixing audio files');
    })
    .on('end', () => {
      console.log('Mixing finished successfully');
      res.download(outputPath, 'mixed.aac', (err) => {
        if (err) {
          console.error('Error sending file: ' + err);
        }
        // Clean up uploaded and output files
        req.files.forEach(file => fs.unlinkSync(file.path));
        fs.unlinkSync(outputPath);
      });
    });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});