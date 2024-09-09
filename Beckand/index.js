const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Set the FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Define directory paths
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
const outputDir = path.join(__dirname, 'output');

// Create necessary directories
[uploadsDir, publicDir, outputDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Configure multer to use the uploads directory
const upload = multer({ dest: uploadsDir });

app.post('/process', upload.array('audio', 2), (req, res) => {
  if (req.files.length !== 2) {
    return res.status(400).send('Please upload exactly two audio files.');
  }

  const firstAudioPath = req.files[0].path;
  const secondAudioPath = req.files[1].path;
  const loweredVolumePath = path.join(outputDir, `${req.files[0].filename}_lowered.aac`);
  const concatenatedPath = path.join(outputDir, `${req.files[0].filename}_concatenated.aac`);
  const finalOutputPath = path.join(publicDir, `${req.files[0].filename}_final.aac`);

  // Step 1: Lower the volume of the first audio to 50%
  ffmpeg(firstAudioPath)
    .audioFilters('volume=0.5')
    .save(loweredVolumePath)
    .on('end', () => {
      console.log('Volume lowering finished');

      
      ffmpeg(loweredVolumePath)
        .output(concatenatedPath)
        .complexFilter([
          '[0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a][0:a]concat=n=20:v=0:a=1[out]',
        ], ['out'])
        .on('end', () => {
          console.log('Concatenation finished');
          
          // Step 3: Merge the concatenated audio with the second audio, trimming to the shortest length
          ffmpeg()
            .input(concatenatedPath)
            .input(secondAudioPath)
            .complexFilter([
              '[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[outa]'
            ])
            .outputOptions('-map [outa]')
            .outputOptions('-c:a aac')
            .outputOptions('-b:a 128k')
            .save(finalOutputPath)
            .on('error', (err) => {
              console.error('An error occurred: ' + err.message);
              res.status(500).json({ error: 'Error processing audio' });
            })
            .on('end', () => {
              console.log('Processing finished successfully');
              const downloadUrl = `/download/${path.basename(finalOutputPath)}`;
              res.json({ message: 'Audio processed successfully', downloadUrl });
              
              // Clean up intermediate files
              fs.unlinkSync(firstAudioPath);
              fs.unlinkSync(secondAudioPath);
              fs.unlinkSync(loweredVolumePath);
              fs.unlinkSync(concatenatedPath);
            });
        })
        .on('error', (err) => {
          console.error('Error during concatenation:', err);
          res.status(500).json({ error: 'Error processing audio' });
        })
        .run();
    })
    .on('error', (err) => {
      console.error('Error during volume lowering:', err);
      res.status(500).json({ error: 'Error processing audio' });
    });
});

// Serve files from the public directory
app.use(express.static(publicDir));

// Add a route for downloading the processed file
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(publicDir, req.params.filename);
  res.download(filePath, (err) => {
    if (err) {
      res.status(404).send('File not found');
    }
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Public directory: ${publicDir}`);
  console.log(`Output directory: ${outputDir}`);
});