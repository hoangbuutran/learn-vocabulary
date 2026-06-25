/**
 * Parse the two source PDFs into vocabulary JSON files.
 * Extracts: word, type, pronunciation (IPA), Vietnamese meaning.
 * Examples and memory tips are left empty (not present in the PDFs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

async function extractText(file) {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/** Normalize whitespace inside a field. */
function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** Lines we should ignore (headers, footers, page markers). */
function isNoise(line) {
  const l = line.trim();
  if (!l) return true;
  if (/^-{2,}\s*\d+\s*of\s*\d+\s*-{2,}$/i.test(l)) return true;
  if (/HOTLINE/i.test(l)) return true;
  if (/TRUNG TÂM/i.test(l)) return true;
  if (/Oxford 3000/i.test(l)) return true;
  if (/effortlessenglishclub/i.test(l)) return true;
  if (/^Trang\s+\d+/i.test(l)) return true;
  if (/^3000 TỪ VỰNG/i.test(l)) return true;
  if (/^Tổng hợp 1000/i.test(l)) return true;
  if (/^`$/.test(l)) return true;
  if (/^(No\.|STT)\s/i.test(l)) return true;
  if (/^STT\b/i.test(l)) return true;
  return false;
}

const TYPE_RE = /^(n|v|adj|adv|prep|pron|det|conj|int|num|abbr|aux|modal|article|phr|exclam)(\s*,\s*(n|v|adj|adv|prep|pron|det|conj|int|num|abbr|aux|modal|article|phr|exclam))*(\s+(n|v|adj|adv|prep|pron|det|conj|int|num|abbr|aux|modal|article|phr|exclam))*$/i;

/**
 * Parse text whose entries start with a leading number.
 * Entries may span multiple lines; we join then split on the entry-number boundary.
 * @param {string} text
 * @param {string} category
 * @returns {Array}
 */
function parseNumbered(text, category) {
  // Join everything, then split where an entry number begins.
  const rawLines = text.split(/\r?\n/).filter(l => !isNoise(l));
  // Reassemble into entries: an entry starts when a line begins with a number
  // (optionally the number is alone on its line).
  const entries = [];
  let current = null;

  for (const line of rawLines) {
    const m = line.match(/^\s*(\d+)\b(.*)$/);
    if (m) {
      if (current) entries.push(current);
      current = (m[2] || '').trim();
    } else if (current !== null) {
      current += ' ' + line.trim();
    }
  }
  if (current) entries.push(current);

  const items = [];
  let idx = 0;

  // IPA / phonetic characters commonly used in the 3000 PDF (no slashes there).
  const IPA_CHARS = "ˈˌːəɪʊɔæʃʒθðŋɑɛɜɒʌɐɚɝˑ'";
  const hasIPA = (tok) => {
    for (const ch of tok) if (IPA_CHARS.includes(ch)) return true;
    return false;
  };

  for (const entry of entries) {
    const joined = clean(entry.replace(/\t/g, ' '));
    const tokens = joined.split(/\s+/);
    if (tokens.length < 2) continue;

    // Find the type token (n, v, adj, ...) — may be a comma list like "n, v"
    let typeStart = -1;
    let typeEnd = -1;
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i].replace(/[,.]$/, '');
      if (TYPE_RE.test(t)) {
        if (typeStart === -1) typeStart = i;
        typeEnd = i;
      } else if (typeStart !== -1) {
        // allow a trailing comma-type sequence; stop at first non-type
        break;
      }
    }
    if (typeStart === -1) continue;

    const word = clean(tokens.slice(0, typeStart).join(' '));
    let rest = tokens.slice(typeEnd + 1);

    // Pronunciation: leading token(s) containing IPA characters (no Vietnamese).
    let pron = '';
    if (rest.length && hasIPA(rest[0])) {
      pron = rest[0];
      rest = rest.slice(1);
    }
    const meaning = clean(rest.join(' '));

    if (!word || !meaning) continue;
    if (word.length > 60) continue;

    idx++;
    const item = {
      id: `${category}_${String(idx).padStart(4, '0')}`,
      word,
      meaning,
      examples: [],
      category,
      groupIndex: Math.ceil(idx / 10)
    };
    if (pron) item.pronunciation = `/${pron.replace(/^\/+|\/+$/g, '')}/`;
    items.push(item);
  }

  return items;
}

function writeFile(filename, source, categories, items) {
  const data = {
    metadata: {
      source,
      generatedAt: new Date().toISOString().split('T')[0],
      totalItems: items.length,
      categories
    },
    items
  };
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ ${filename}: ${items.length} items`);
}

/**
 * Parser for the A1-A2 PDF. Format per entry:
 *   <number> <word> <type> /<pronunciation>/ <vietnamese meaning>
 * Entries span multiple lines and are grouped under topic headers
 * (e.g. "EDUCATION - GIÁO DỤC") which we use as sub-categories.
 */
function parseA1A2(text, category) {
  const rawLines = text.split(/\r?\n/);
  // Reassemble entries by leading number, skipping noise and capturing topics.
  const entries = [];
  let current = null;

  for (const line of rawLines) {
    if (isNoise(line)) continue;
    // Topic header: all-caps with a dash, no leading number
    const numMatch = line.match(/^\s*(\d+)\b(.*)$/);
    if (numMatch) {
      if (current) entries.push(current);
      current = (numMatch[2] || '').trim();
    } else if (current !== null) {
      current += ' ' + line.trim();
    }
  }
  if (current) entries.push(current);

  const items = [];
  let idx = 0;

  for (const entry of entries) {
    const joined = clean(entry.replace(/\t/g, ' '));
    // Match: word(+type) /pron/ meaning   — pronunciation delimited by slashes
    const m = joined.match(/^(.*?)\s*\/([^/]+)\/\s*(.*)$/);
    let word, pron, meaning;

    if (m) {
      let head = clean(m[1]);
      pron = clean(m[2]);
      meaning = clean(m[3]);
      // Strip trailing type tokens from head (n, v, adj, adv, prep, n adj, etc.)
      head = head.replace(/\s+((n|v|adj|adv|prep|pron|det|conj|int|num|abbr|phr)\b[,\s]*)+$/i, '');
      word = clean(head);
    } else {
      // No pronunciation: split type out heuristically
      const tokens = joined.split(/\s+/);
      let typeIdx = -1;
      for (let i = 1; i < tokens.length; i++) {
        if (TYPE_RE.test(tokens[i].replace(/,$/, ''))) { typeIdx = i; break; }
      }
      if (typeIdx === -1) continue;
      word = tokens.slice(0, typeIdx).join(' ');
      meaning = tokens.slice(typeIdx + 1).join(' ');
      pron = '';
    }

    word = clean(word);
    meaning = clean(meaning);
    if (!word || !meaning) continue;
    if (word.length > 60) continue;

    idx++;
    const item = {
      id: `${category}_${String(idx).padStart(4, '0')}`,
      word,
      meaning,
      examples: [],
      category,
      groupIndex: Math.ceil(idx / 10)
    };
    if (pron) item.pronunciation = `/${pron}/`;
    items.push(item);
  }

  return items;
}

async function main() {
  const text3000 = await extractText(path.join(ROOT, '3000.pdf'));
  const items3000 = parseNumbered(text3000, 'essential-3000');
  writeFile('vocabulary-3000.json', '3000.pdf', ['essential-3000'], items3000);

  const textA1 = await extractText(path.join(ROOT, 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf'));
  const itemsA1 = parseA1A2(textA1, 'a1-a2');
  writeFile('vocabulary-a1-a2.json', 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf', ['a1-a2'], itemsA1);

  // Print a few samples for verification
  console.log('\n--- 3000 samples ---');
  console.log(JSON.stringify(items3000.slice(0, 3), null, 2));
  console.log('\n--- A1-A2 samples ---');
  console.log(JSON.stringify(itemsA1.slice(0, 5), null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
