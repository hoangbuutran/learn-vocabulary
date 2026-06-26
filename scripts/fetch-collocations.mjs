/**
 * Fetch rich word relationships from the Datamuse API (free, no key) and store
 * them in a SEPARATE file so it can run safely alongside other data scripts.
 *
 * For each vocabulary word we collect:
 *   before    : words that commonly come BEFORE it   (rel_bgb)  -> "heavy rain"
 *   after     : words that commonly come AFTER it     (rel_bga)  -> "rain forest"
 *   synonyms  : synonyms                              (rel_syn)
 *   antonyms  : antonyms                              (rel_ant)
 *   similar   : similar-meaning words                 (ml)
 *   topic     : words from the same topic             (rel_trg)
 *   phrases   : ready-made collocation phrases built from before/after
 *
 * Output: data/word-extras.json  =  { "<word>": { before, after, ... } }
 *
 * RESUMABLE: skips words already present. Stop/re-run any time.
 *
 * Usage:
 *   node scripts/fetch-collocations.mjs            # all words
 *   node scripts/fetch-collocations.mjs a1-a2
 *   node scripts/fetch-collocations.mjs 3000
 *
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT = path.join(DATA_DIR, 'word-extras.json');

const FILES = { 'a1-a2': 'vocabulary-a1-a2.json', '3000': 'vocabulary-3000.json' };
const which = process.argv[2];
const targetFiles = which && FILES[which] ? [FILES[which]] : Object.values(FILES);

const DELAY_MS = 200;
const SAVE_EVERY = 25;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Function words to drop from collocations (not useful to learners).
const STOP = new Set([
  'the','a','an','of','to','in','on','and','this','that','these','those',
  'his','her','its','their','your','my','our','was','is','are','be','been',
  'it','for','at','as','with','by','or','but','not','had','has','have','will',
  'would','can','could','should','must','may','might','do','does','did','than',
  'so','if','then','also','very','more','most','such','no','any','all','some',
  '.',',',';',':','-','—','’s'
]);

async function q(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === attempts - 1) return undefined; // transient -> retry later run
      await sleep(700 * (i + 1));
    }
  }
}

const words = (arr, n) =>
  (arr || []).map(x => x.word).filter(w => w && !STOP.has(w.toLowerCase())).slice(0, n);

async function fetchWord(word) {
  const w = encodeURIComponent(word.toLowerCase());
  const base = 'https://api.datamuse.com/words?max=10&';

  const before = await q(`${base}rel_bgb=${w}`);
  if (before === undefined) return undefined;
  const after = await q(`${base}rel_bga=${w}`);
  const syn = await q(`${base}rel_syn=${w}`);
  const ant = await q(`${base}rel_ant=${w}`);
  const ml = await q(`${base}ml=${w}`);
  const trg = await q(`${base}rel_trg=${w}`);

  const beforeW = words(before, 4);
  const afterW = words(after, 4);

  // Build natural-ish phrases from before/after words.
  const phrases = [];
  for (const p of beforeW) phrases.push(`${p} ${word}`);
  for (const p of afterW) phrases.push(`${word} ${p}`);

  return {
    before: beforeW,
    after: afterW,
    synonyms: words(syn, 6),
    antonyms: words(ant, 6),
    similar: words(ml, 6),
    topic: words(trg, 8),
    phrases: phrases.slice(0, 6)
  };
}

function collectWords(fileNames) {
  const set = new Set();
  for (const f of fileNames) {
    const full = path.join(DATA_DIR, f);
    if (!fs.existsSync(full)) continue;
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const it of json.items || []) {
      if (it.word) set.add(it.word.trim().toLowerCase());
    }
  }
  return [...set];
}

async function main() {
  const extras = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const all = collectWords(targetFiles);
  const todo = all.filter(w => !extras[w]);

  console.log(`Total words: ${all.length}`);
  console.log(`Already have extras: ${Object.keys(extras).length}`);
  console.log(`Need fetching: ${todo.length}\n`);

  const save = () => fs.writeFileSync(OUT, JSON.stringify(extras, null, 2), 'utf8');
  let done = 0;

  for (let i = 0; i < todo.length; i++) {
    const word = todo[i];
    const data = await fetchWord(word);
    if (data === undefined) { await sleep(DELAY_MS); continue; } // retry later
    extras[word] = data;
    done++;

    if (done % SAVE_EVERY === 0) {
      save();
      console.log(`[${i + 1}/${todo.length}] saved=${done}`);
    }
    await sleep(DELAY_MS);
  }

  save();
  console.log(`\nDone. fetched=${done}. File: ${path.relative(ROOT, OUT)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
