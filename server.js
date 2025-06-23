const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const instagramGetUrl = require('instagram-url-direct');
const TikTokScraper = require('tiktok-scraper');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Temporary storage for downloads
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

// YouTube Downloader
app.post('/download/youtube', async (req, res) => {
  try {
    const { url, format } = req.body;
    
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    let filename, command;

    if (format === 'mp3') {
      filename = `${title}.mp3`;
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
      
      command = ffmpeg(ytdl(url, { quality: 'highestaudio' }))
        .audioBitrate(128)
        .toFormat('mp3')
        .pipe(res, { end: true });
    } else {
      filename = `${title}.mp4`;
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
      ytdl(url, { quality: format === 'hd' ? 'highest' : 'lowest' }).pipe(res);
    }

  } catch (err) {
    console.error('YouTube download error:', err);
    res.status(500).json({ error: 'Failed to download YouTube video' });
  }
});

// Instagram Downloader
app.post('/download/instagram', async (req, res) => {
  try {
    const { url } = req.body;
    const result = await instagramGetUrl(url);
    
    if (!result || !result.url_list || result.url_list.length === 0) {
      return res.status(400).json({ error: 'No media found' });
    }

    const mediaUrl = result.url_list[0];
    const filename = `instagram_${Date.now()}.${mediaUrl.includes('.mp4') ? 'mp4' : 'jpg'}`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.redirect(mediaUrl);

  } catch (err) {
    console.error('Instagram download error:', err);
    res.status(500).json({ error: 'Failed to download Instagram media' });
  }
});

// TikTok Downloader
app.post('/download/tiktok', async (req, res) => {
  try {
    const { url } = req.body;
    const videoMeta = await TikTokScraper.getVideoMeta(url);
    const videoUrl = videoMeta.collector[0].videoUrl;
    
    const filename = `tiktok_${Date.now()}.mp4`;
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.redirect(videoUrl);

  } catch (err) {
    console.error('TikTok download error:', err);
    res.status(500).json({ error: 'Failed to download TikTok video' });
  }
});

// Generic Downloader
app.post('/download/generic', async (req, res) => {
  try {
    const { url, format } = req.body;
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch resource' });
    }

    const contentType = response.headers.get('content-type');
    let extension = 'mp4';
    
    if (contentType.includes('image')) {
      extension = format === 'png' ? 'png' : 'jpg';
    } else if (contentType.includes('audio')) {
      extension = format === 'wav' ? 'wav' : 'mp3';
    }

    const filename = `download_${Date.now()}.${extension}`;
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    response.body.pipe(res);

  } catch (err) {
    console.error('Generic download error:', err);
    res.status(500).json({ error: 'Failed to download media' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});