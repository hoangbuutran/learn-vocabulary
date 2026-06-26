/**
 * Fill in pronunciation audio for every word that the Free Dictionary API
 * did NOT have (entries marked `null` in the manifest), plus any vocabulary
 * word missing from the manifest entirely.
 *
 * Source: Google Translate TTS (en). It covers ANY word or phrase, so this
 * guarantees 100% offline audio coverage. Quality is synthesized but far more
 * natural than the local OS voice.
 *
 * Output: assets/audio/<word>.mp3  + updates assets/audio/manifest.json
 *
 * Usage:
 *   node scripts/fetch-audio-tts.mjs           # fill gaps only (resumable)
 *   node scripts/fetch-audio-tts.mjs --accent uk
 *
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');
const DATA_FILES = ['vocabulary-a1-a2.json', 'vocabulary-3000.json'];

// Google TTS uses British-leaning 'en-gb' or American 'en'; default American.
const accentArg = (() => {
  const i = process.argv.indexOf('--accent');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1].toLowerCase() : 'us';
})();
const TTS_LANG = accentArg === 'uk' ? 'en-GB' : 'en';

const DELAY_MS = 250;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function collectWords() {
  const words = new Set();
  for (const file of DATA_FILES) {
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) continue;
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const item of json.items || []) {
      if (item.word) words.add(item.word.trim().toLowerCase());
    }
  }
  return [...words];
}

function safeName(word) {
  return word.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

/** Fetch one TTS clip as a Buffer (with a couple of retries). */
async function fetchTts(text) {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8' +
    `&q=${encodeURIComponent(text)}&tl=${TTS_LANG}&client=tw-ob`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error('too small');
      return buf;
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : {};

  const words = collectWords();

  // Targets: words with no real audio yet (null in manifest OR not present).
  const targets = words.filter(w => !manifest[w]);
  console.log(`Total words: ${words.length}`);
  console.log(`Need TTS audio: ${targets.length}`);
  console.log(`Accent: ${accentArg} (${TTS_LANG})\n`);

  let done = 0;
  let failed = 0;
  const saveManifest = () =>
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  for (let i = 0; i < targets.length; i++) {
    const word = targets[i];
    try {
      const buf = await fetchTts(word);
      const fileName = safeName(word) + '.mp3';
      fs.writeFileSync(path.join(AUDIO_DIR, fileName), buf);
      manifest[word] = fileName;
      done++;
    } catch (err) {
      failed++;
      console.warn(`  ! ${word}: ${err.message}`);
    }

    if ((i + 1) % 25 === 0) {
      saveManifest();
      console.log(`[${i + 1}/${targets.length}] done=${done} failed=${failed}`);
    }
    await sleep(DELAY_MS);
  }

  saveManifest();
  console.log(`\nFinished. filled=${done} failed=${failed}`);
  const remaining = collectWords().filter(w => !manifest[w]).length;
  console.log(`Words still without audio: ${remaining}`);
}

main().catch(err => { console.error(err); process.exit(1); });
