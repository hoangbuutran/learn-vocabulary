/**
 * Download real human pronunciation audio for every vocabulary word and
 * store it locally so the app can play pronunciations OFFLINE.
 *
 * Source: Free Dictionary API (https://dictionaryapi.dev/) - audio recorded by
 * native speakers, free, no API key.
 *
 * Output:
 *   assets/audio/<word>.mp3          - one file per word that has audio
 *   assets/audio/manifest.json       - { "word": "filename.mp3", ... }
 *
 * Usage:
 *   node scripts/fetch-audio.mjs            # download everything (resumable)
 *   node scripts/fetch-audio.mjs --accent uk
 *
 * The script is RESUMABLE: it skips words already present in the manifest,
 * so you can stop (Ctrl+C) and re-run it any time.
 *
 * DEVELOPMENT-TIME ONLY. The downloaded files are bundled as static assets.
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

// --accent us|uk  (default: us)
const accentArg = (() => {
  const i = process.argv.indexOf('--accent');
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1].toLowerCase() : 'us';
})();
const PREFER_SUFFIX = accentArg === 'uk' ? '-uk.' : '-us.';
const OTHER_SUFFIX = accentArg === 'uk' ? '-us.' : '-uk.';

const DELAY_MS = 350;          // polite delay between API calls
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Collect the unique set of words across all data files. */
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

/** Turn a word into a safe filename stem. */
function safeName(word) {
  return word.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

/** Pick the best audio URL from the API response for our preferred accent. */
function pickAudioUrl(apiData) {
  const phonetics = [];
  for (const entry of apiData) {
    if (Array.isArray(entry.phonetics)) phonetics.push(...entry.phonetics);
  }
  const withAudio = phonetics.filter(p => p.audio && p.audio.trim());
  if (!withAudio.length) return null;

  const chosen =
    withAudio.find(p => p.audio.includes(PREFER_SUFFIX)) ||
    withAudio.find(p => p.audio.includes(OTHER_SUFFIX)) ||
    withAudio[0];

  let url = chosen.audio;
  if (url.startsWith('//')) url = 'https:' + url;
  return url;
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : {};

  const words = collectWords();
  console.log(`Total unique words: ${words.length}`);
  console.log(`Already in manifest: ${Object.keys(manifest).length}`);
  console.log(`Preferred accent: ${accentArg}\n`);

  let downloaded = 0;
  let missing = 0;
  let processed = 0;

  const saveManifest = () =>
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  for (const word of words) {
    processed++;
    // Skip words we've already resolved (downloaded or confirmed-missing).
    if (Object.prototype.hasOwnProperty.call(manifest, word)) continue;

    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );

      if (!res.ok) {
        // 404 = word not in dictionary. Record as missing so we don't retry.
        manifest[word] = null;
        missing++;
      } else {
        const data = await res.json();
        const url = pickAudioUrl(data);
        if (!url) {
          manifest[word] = null;
          missing++;
        } else {
          const audioRes = await fetch(url);
          if (!audioRes.ok) throw new Error(`audio ${audioRes.status}`);
          const buf = Buffer.from(await audioRes.arrayBuffer());

          const ext = url.endsWith('.ogg') ? '.ogg' : '.mp3';
          const fileName = safeName(word) + ext;
          fs.writeFileSync(path.join(AUDIO_DIR, fileName), buf);
          manifest[word] = fileName;
          downloaded++;
        }
      }
    } catch (err) {
      // Transient error: do NOT record, so a re-run retries this word.
      console.warn(`  ! ${word}: ${err.message}`);
    }

    if (processed % 25 === 0) {
      saveManifest();
      console.log(`[${processed}/${words.length}] downloaded=${downloaded} missing=${missing}`);
    }

    await sleep(DELAY_MS);
  }

  saveManifest();
  console.log(`\nDone. downloaded=${downloaded} missing=${missing}`);
  console.log(`Manifest: ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
