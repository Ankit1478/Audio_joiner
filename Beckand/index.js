const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Set the FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

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
  const secondAudioOriginalName = path.parse(req.files[1].originalname).name;
  const loweredVolumePath = path.join(outputDir, `${req.files[0].filename}_lowered.aac`);
  const concatenatedPath = path.join(outputDir, `${req.files[0].filename}_concatenated.aac`);
  const finalOutputPath = path.join(publicDir, `${secondAudioOriginalName}.aac`);

  console.log('Starting audio processing...');

  // Step 1: Get durations of both audio files
  Promise.all([
    getDuration(firstAudioPath),
    getDuration(secondAudioPath)
  ]).then(([firstAudioDuration, secondAudioDuration]) => {
    console.log(`First audio duration: ${firstAudioDuration}, Second audio duration: ${secondAudioDuration}`);

    // Calculate how many times to repeat the first audio
    const repeatCount = Math.ceil(secondAudioDuration / firstAudioDuration);
    
    // Step 2: Lower the volume of the first audio to 60%
    lowerVolume(firstAudioPath, loweredVolumePath)
      .then(() => {
        console.log('Volume lowering finished');
        console.log(`Repeat count: ${repeatCount}`);
        // Step 3: Concatenate the first audio based on repeatCount
        return concatenateAudio(loweredVolumePath, concatenatedPath, repeatCount, secondAudioDuration);
      })
      .then(() => {
        console.log('Concatenation finished');
        // Step 4: Merge the concatenated audio with the second audio
        return mergeAudio(concatenatedPath, secondAudioPath, finalOutputPath, secondAudioDuration);
      })
      .then(() => {
        console.log('Processing finished successfully');
        const downloadUrl = `/download/${path.basename(finalOutputPath)}`;
        res.json({ message: 'Audio processed successfully', downloadUrl });

        // Clean up intermediate files
        [firstAudioPath, secondAudioPath, loweredVolumePath, concatenatedPath].forEach(filePath => {
          fs.unlink(filePath, err => {
            if (err) console.error(`Error deleting file ${filePath}:`, err);
          });
        });
      })
      .catch(err => {
        console.error('Error during audio processing:', err);
        res.status(500).json({ error: 'Error processing audio: ' + err.message });
      });
  }).catch(err => {
    console.error('Error getting audio durations:', err);
    res.status(500).json({ error: 'Error processing audio: ' + err.message });
  });
});

function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

function lowerVolume(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters('volume=0.6')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function concatenateAudio(inputPath, outputPath, repeatCount, targetDuration) {
  return new Promise((resolve, reject) => {
    console.log(`Starting concatenation: input=${inputPath}, output=${outputPath}, repeatCount=${repeatCount}, targetDuration=${targetDuration}`);
    
    // Prepare the complex filter string
    const inputs = Array(repeatCount).fill('[0:a]').join('');
    const filterComplex = `${inputs}concat=n=${repeatCount}:v=0:a=1[concat];[concat]atrim=0:${targetDuration}[out]`;
    
    ffmpeg(inputPath)
      .output(outputPath)
      .complexFilter([filterComplex], ['out'])
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + progress.percent + '% done');
      })
      .on('end', () => {
        console.log('Concatenation finished successfully');
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error during concatenation:', err);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

function mergeAudio(input1, input2, outputPath, targetDuration) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(input1)
      .input(input2)
      .complexFilter([
        '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[outa]',
        `[outa]atrim=0:${targetDuration}[out]`
      ])
      .outputOptions('-map [out]')
      .outputOptions('-c:a aac')
      .outputOptions('-b:a 128k')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

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
});