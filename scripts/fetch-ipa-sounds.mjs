/**
 * Download individual IPA phoneme audio (pure sounds, not example words) from
 * Wikimedia Commons, so the pronunciation guide can play e.g. /ɪ/ on its own.
 *
 * Source: Wikimedia Commons (CC-licensed linguistics recordings).
 * Output: assets/audio/ipa/<symbol>.ogg  +  assets/audio/ipa/manifest.json
 *
 * Usage: node scripts/fetch-ipa-sounds.mjs   (resumable)
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'audio', 'ipa');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// Map IPA symbol -> Wikimedia Commons file name (pure phoneme recordings).
const MAP = {
  // short/long vowels
  'iː': 'Close front unrounded vowel.ogg',
  'ɪ': 'Near-close near-front unrounded vowel.ogg',
  'e': 'Open-mid front unrounded vowel.ogg',
  'æ': 'Near-open front unrounded vowel.ogg',
  'ʌ': 'Open-mid back unrounded vowel.ogg',
  'ɑː': 'Open back unrounded vowel.ogg',
  'ɒ': 'Open back rounded vowel.ogg',
  'ɔː': 'Open-mid back rounded vowel.ogg',
  'ʊ': 'Near-close near-back rounded vowel.ogg',
  'uː': 'Close back rounded vowel.ogg',
  'ɜː': 'Open-mid central unrounded vowel.ogg',
  'ə': 'Mid-central vowel.ogg',
  // consonants
  'p': 'Voiceless bilabial plosive.ogg',
  'b': 'Voiced bilabial plosive.ogg',
  't': 'Voiceless alveolar plosive.ogg',
  'd': 'Voiced alveolar plosive.ogg',
  'k': 'Voiceless velar plosive.ogg',
  'g': 'Voiced velar plosive 02.ogg',
  'f': 'Voiceless labiodental fricative.ogg',
  'v': 'Voiced labiodental fricative.ogg',
  'θ': 'Voiceless dental fricative.ogg',
  'ð': 'Voiced dental fricative.ogg',
  's': 'Voiceless alveolar sibilant.ogg',
  'z': 'Voiced alveolar sibilant.ogg',
  'ʃ': 'Voiceless palato-alveolar sibilant.ogg',
  'ʒ': 'Voiced palato-alveolar sibilant.ogg',
  'tʃ': 'Voiceless palato-alveolar affricate.ogg',
  'dʒ': 'Voiced palato-alveolar affricate.ogg',
  'm': 'Bilabial nasal.ogg',
  'n': 'Alveolar nasal.ogg',
  'ŋ': 'Velar nasal.ogg',
  'h': 'Voiceless glottal fricative.ogg',
  'l': 'Alveolar lateral approximant.ogg',
  'r': 'Alveolar approximant.ogg',
  'w': 'Voiced labio-velar approximant.ogg',
  'j': 'Palatal approximant.ogg'
};

const UA = 'LearnVocabApp/1.0 (educational; contact: local-dev)';
const DELAY_MS = 6000; // be gentle to avoid HTTP 429
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function safeName(sym) {
  // ascii-friendly filename per symbol
  const table = {
    'iː': 'i_long', 'ɪ': 'short_i', 'e': 'e', 'æ': 'ae', 'ʌ': 'uh',
    'ɑː': 'a_long', 'ɒ': 'o_short', 'ɔː': 'o_long', 'ʊ': 'u_short',
    'uː': 'u_long', 'ɜː': 'er_long', 'ə': 'schwa',
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g',
    'f': 'f', 'v': 'v', 'θ': 'th_unvoiced', 'ð': 'th_voiced',
    's': 's', 'z': 'z', 'ʃ': 'sh', 'ʒ': 'zh', 'tʃ': 'ch', 'dʒ': 'j',
    'm': 'm', 'n': 'n', 'ŋ': 'ng', 'h': 'h', 'l': 'l', 'r': 'r',
    'w': 'w', 'j': 'y'
  };
  return (table[sym] || 'sym') + '.ogg';
}

async function fetchFile(fileName) {
  const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
    encodeURIComponent(fileName);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (res.status === 429) {
        await sleep(5000 * (attempt + 1)); // back off harder on rate limit
        continue;
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('too small');
      return buf;
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error('rate limited (429) after retries');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : {};

  const symbols = Object.keys(MAP);
  let done = 0, failed = 0, skipped = 0;

  for (const sym of symbols) {
    if (manifest[sym]) { skipped++; continue; }
    const fileName = safeName(sym);
    try {
      const buf = await fetchFile(MAP[sym]);
      fs.writeFileSync(path.join(OUT_DIR, fileName), buf);
      manifest[sym] = fileName;
      done++;
      console.log(`OK  ${sym} -> ${fileName} (${buf.length} b)`);
    } catch (err) {
      failed++;
      console.warn(`!   ${sym} (${MAP[sym]}): ${err.message}`);
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. new=${done} skipped=${skipped} failed=${failed}`);
  console.log(`Manifest: ${path.relative(ROOT, MANIFEST)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
