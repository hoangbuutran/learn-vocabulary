/**
 * Add a real example sentence (with Vietnamese translation) to each vocabulary
 * item, to help learners remember words in context.
 *
 * Source of examples: Free Dictionary API (real usage sentences).
 * Translation: Google Translate (unofficial gtx endpoint).
 *
 * Writes into data/*.json, setting item.examples = [{ en, vi }].
 * RESUMABLE: skips items that already have an {en} example, so you can stop
 * (Ctrl+C) and re-run any time.
 *
 * Usage:
 *   node scripts/fetch-examples.mjs              # both files
 *   node scripts/fetch-examples.mjs a1-a2        # only A1-A2
 *   node scripts/fetch-examples.mjs 3000         # only the 3000 set
 *
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const FILES = {
  'a1-a2': 'vocabulary-a1-a2.json',
  '3000': 'vocabulary-3000.json'
};

const which = process.argv[2];
const targetFiles = which && FILES[which]
  ? [FILES[which]]
  : Object.values(FILES);

const DELAY_MS = 300;
const SAVE_EVERY = 20;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Retry a fetch returning JSON, tolerating the flaky connection. */
async function getJson(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === attempts - 1) return undefined; // signal transient failure
      await sleep(800 * (i + 1));
    }
  }
}

/** Pick the best example sentence for a word from the dictionary response. */
function pickExample(data, word) {
  if (!Array.isArray(data)) return null;
  const candidates = [];
  for (const entry of data) {
    for (const meaning of entry.meanings || []) {
      for (const def of meaning.definitions || []) {
        if (def.example && def.example.trim()) {
          candidates.push(def.example.trim());
        }
      }
    }
  }
  if (!candidates.length) return null;
  // Prefer a sentence that actually contains the word and isn't too long.
  const w = word.toLowerCase();
  const withWord = candidates.filter(c => c.toLowerCase().includes(w));
  const pool = withWord.length ? withWord : candidates;
  pool.sort((a, b) => a.length - b.length);
  // Avoid ultra-short fragments; pick a mid-length one.
  return pool.find(c => c.length >= 12) || pool[0];
}

/** Translate English -> Vietnamese. Returns '' on failure. */
async function translate(text) {
  const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q='
    + encodeURIComponent(text);
  const data = await getJson(u);
  if (!data || !Array.isArray(data[0])) return '';
  try {
    return data[0].map(seg => seg[0]).join('').trim();
  } catch {
    return '';
  }
}

/** Does this item already have a usable example, or was already checked? */
function hasExample(item) {
  if (item.examplesChecked) return true; // checked before, no example found
  return Array.isArray(item.examples)
    && item.examples.length > 0
    && item.examples[0]
    && typeof item.examples[0] === 'object'
    && item.examples[0].en;
}

async function processFile(fileName) {
  const full = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(full)) {
    console.warn('skip (not found):', fileName);
    return;
  }
  const json = JSON.parse(fs.readFileSync(full, 'utf8'));
  const items = json.items || [];

  const todo = items.filter(it => !hasExample(it));
  console.log(`\n${fileName}: ${items.length} items, need examples: ${todo.length}`);

  let added = 0, noExample = 0, processed = 0;
  const save = () => fs.writeFileSync(full, JSON.stringify(json, null, 2), 'utf8');

  for (const item of items) {
    if (hasExample(item)) continue;
    processed++;

    const word = (item.word || '').trim();
    if (!word) continue;

    const dict = await getJson(
      'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase())
    );

    // transient failure -> leave for a later run
    if (dict === undefined) { await sleep(DELAY_MS); continue; }

    const en = pickExample(dict, word);
    if (!en) {
      // Mark as "checked, no example" so we don't retry forever.
      item.examples = [];
      item.examplesChecked = true;
      noExample++;
    } else {
      const vi = await translate(en);
      item.examples = [{ en, vi }];
      added++;
    }

    if (processed % SAVE_EVERY === 0) {
      save();
      console.log(`  [${processed}/${todo.length}] added=${added} noExample=${noExample}`);
    }
    await sleep(DELAY_MS);
  }

  save();
  console.log(`Done ${fileName}: added=${added} noExample=${noExample}`);
}

async function main() {
  for (const f of targetFiles) {
    await processFile(f);
  }
  console.log('\nAll done.');
}

main().catch(e => { console.error(e); process.exit(1); });
