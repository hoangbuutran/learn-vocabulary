/**
 * Vocab backend - a small Express server.
 *
 * Endpoints:
 *   GET  /api/health
 *        -> { ok: true }
 *
 *   GET  /api/transcript?url=<youtube url or id>&lang=en
 *        -> { videoId, lang, lines: [{ start, end, text }] }
 *        Fetches a YouTube video's transcript (captions) server-side, avoiding
 *        the browser CORS restriction. Powers the Shadowing feature.
 *
 *   POST /api/pronunciation/compare   { target, spoken }
 *        -> { score, passed, matchedWords, totalWords, words: [{word, matched}] }
 *        Compares recognized speech against a target phrase. The actual speech
 *        recognition still runs on-device (Whisper); this scores the result.
 *
 * Run:  cd server && npm install && npm start
 */
import express from 'express';
import cors from 'cors';
import { YoutubeTranscript } from 'youtube-transcript';

import { config } from './config.js';
import { parseVideoId, comparePhrase, mergeIntoSentences } from './utils.js';
import { listVideos, getVideo, addVideo, removeVideo } from './library.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins
}));

// --- Health ----------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'vocab-backend', time: new Date().toISOString() });
});

// --- YouTube transcript ------------------------------------------------------

app.get('/api/transcript', async (req, res) => {
  const videoId = parseVideoId(req.query.url || req.query.v || '');
  if (!videoId) {
    return res.status(400).json({ error: 'Thiếu hoặc sai link/ID YouTube.' });
  }
  const lang = (req.query.lang || 'en').toString();

  try {
    let raw;
    try {
      raw = await YoutubeTranscript.fetchTranscript(videoId, { lang });
    } catch (_) {
      // Fall back to whatever transcript exists (any language / auto-generated).
      raw = await YoutubeTranscript.fetchTranscript(videoId);
    }

    // youtube-transcript returns { text, duration, offset } in milliseconds.
    const rawLines = raw.map((seg) => {
      const start = (seg.offset || 0) / 1000;
      const dur = (seg.duration || 0) / 1000;
      return {
        start: Number(start.toFixed(2)),
        end: Number((start + dur).toFixed(2)),
        text: decodeEntities(seg.text || '').trim()
      };
    }).filter((l) => l.text);

    if (rawLines.length === 0) {
      return res.status(404).json({ error: 'Video này không có phụ đề khả dụng.' });
    }

    // Merge the short caption chunks into full sentences.
    const lines = mergeIntoSentences(rawLines);

    res.json({ videoId, lang, lines });
  } catch (err) {
    res.status(404).json({
      error: 'Không lấy được phụ đề. Video có thể không bật phụ đề, hoặc bị giới hạn.',
      detail: String(err && err.message ? err.message : err)
    });
  }
});

// --- Shadowing library (shared videos) --------------------------------------

// List all saved videos (summary, without transcript lines).
app.get('/api/library', (req, res) => {
  res.json({ videos: listVideos() });
});

// Get one saved video including its transcript lines.
app.get('/api/library/:id', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video.' });
  res.json(video);
});

// Add a video to the shared library. Fetches the transcript if not provided.
app.post('/api/library', async (req, res) => {
  const { url, title, level, lines } = req.body || {};
  const videoId = parseVideoId(url || '');
  if (!videoId) {
    return res.status(400).json({ error: 'Thiếu hoặc sai link/ID YouTube.' });
  }

  let finalLines = Array.isArray(lines) ? lines : null;

  // If the client didn't send lines, fetch + merge them now.
  if (!finalLines || finalLines.length === 0) {
    try {
      let raw;
      try {
        raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      } catch (_) {
        raw = await YoutubeTranscript.fetchTranscript(videoId);
      }
      const rawLines = raw.map((seg) => {
        const start = (seg.offset || 0) / 1000;
        const dur = (seg.duration || 0) / 1000;
        return {
          start: Number(start.toFixed(2)),
          end: Number((start + dur).toFixed(2)),
          text: decodeEntities(seg.text || '').trim()
        };
      }).filter((l) => l.text);
      finalLines = mergeIntoSentences(rawLines);
    } catch (err) {
      return res.status(404).json({ error: 'Không lấy được phụ đề cho video này.' });
    }
  }

  if (!finalLines || finalLines.length === 0) {
    return res.status(400).json({ error: 'Video không có lời thoại.' });
  }

  // Use the real YouTube title when the client didn't provide one.
  let finalTitle = (title || '').trim();
  if (!finalTitle) {
    finalTitle = await fetchYouTubeTitle(videoId);
  }

  const saved = addVideo({ videoId, title: finalTitle, level, lines: finalLines });
  res.json({ ok: true, video: { id: saved.id, videoId: saved.videoId, title: saved.title, level: saved.level, lineCount: saved.lines.length } });
});

// Remove a video from the library.
app.delete('/api/library/:id', (req, res) => {
  const ok = removeVideo(req.params.id);
  res.json({ ok });
});

// --- Pronunciation comparison -----------------------------------------------
app.post('/api/pronunciation/compare', (req, res) => {
  const { target, spoken } = req.body || {};
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Thiếu "target" (câu cần đọc).' });
  }
  if (typeof spoken !== 'string') {
    return res.status(400).json({ error: 'Thiếu "spoken" (nội dung đã đọc).' });
  }
  if (target.length > config.maxCompareTextLength || spoken.length > config.maxCompareTextLength) {
    return res.status(413).json({ error: 'Nội dung quá dài.' });
  }

  const result = comparePhrase(target, spoken);
  res.json(result);
});

// --- Fallback ---------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(config.port, () => {
  console.log(`vocab-backend listening on http://localhost:${config.port}`);
});

/** Decode the handful of HTML entities YouTube captions use. */
function decodeEntities(s) {
  return s
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Fetch a video's real title via YouTube oEmbed (free, no API key). */
async function fetchYouTubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    return (data && data.title ? String(data.title) : '').slice(0, 200);
  } catch {
    return '';
  }
}
