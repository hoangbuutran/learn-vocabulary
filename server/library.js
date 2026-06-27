/**
 * Shadowing library: a shared list of videos (with their transcripts) that
 * users have added, stored in a JSON file so it can be committed and shared.
 *
 * File: server/data/shadowing-library.json
 * Shape: { videos: [ { id, videoId, title, level, lines:[{start,end,text}], addedAt } ] }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const LIB_PATH = path.join(DATA_DIR, 'shadowing-library.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LIB_PATH)) {
    fs.writeFileSync(LIB_PATH, JSON.stringify({ videos: [] }, null, 2), 'utf8');
  }
}

function read() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));
    if (!data || !Array.isArray(data.videos)) return { videos: [] };
    return data;
  } catch {
    return { videos: [] };
  }
}

function write(data) {
  ensureFile();
  fs.writeFileSync(LIB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/** Return the library list, but WITHOUT the heavy transcript lines (summary). */
export function listVideos() {
  const { videos } = read();
  return videos.map((v) => ({
    id: v.id,
    videoId: v.videoId,
    title: v.title || '',
    level: v.level || '',
    lineCount: Array.isArray(v.lines) ? v.lines.length : 0,
    addedAt: v.addedAt
  }));
}

/** Return a single video including its transcript lines. */
export function getVideo(id) {
  const { videos } = read();
  return videos.find((v) => v.id === id || v.videoId === id) || null;
}

/**
 * Add (or replace) a video in the library.
 * @param {{videoId:string, title?:string, level?:string, lines:Array}} entry
 * @returns {object} the saved entry
 */
export function addVideo(entry) {
  const data = read();
  const videoId = entry.videoId;
  // Replace if the same videoId already exists.
  const idx = data.videos.findIndex((v) => v.videoId === videoId);
  const record = {
    id: videoId,
    videoId,
    title: (entry.title || '').slice(0, 200),
    level: (entry.level || '').slice(0, 20),
    lines: Array.isArray(entry.lines) ? entry.lines : [],
    addedAt: new Date().toISOString()
  };
  if (idx >= 0) data.videos[idx] = record;
  else data.videos.unshift(record);
  write(data);
  return record;
}

/** Remove a video by id/videoId. */
export function removeVideo(id) {
  const data = read();
  const before = data.videos.length;
  data.videos = data.videos.filter((v) => v.id !== id && v.videoId !== id);
  write(data);
  return data.videos.length < before;
}
