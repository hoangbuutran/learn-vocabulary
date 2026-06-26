/**
 * Parse the A1-A2 vocabulary from the Word document into clean JSON.
 *
 * The .docx stores the vocabulary in tables with 5 columns:
 *   STT | Từ vựng | Loại từ | Phiên âm | Nghĩa
 *
 * This reads word/document.xml directly (a .docx is a zip), walks every
 * table row, and extracts one vocabulary item per data row. Header rows and
 * section-title rows (e.g. "TRAVEL - DU LỊCH") are skipped.
 *
 * Output: data/vocabulary-a1-a2.json
 *
 * Usage: node scripts/parse-docx-a1a2.mjs
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCX = path.join(ROOT, 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.docx');
const OUT = path.join(ROOT, 'data', 'vocabulary-a1-a2.json');
const EXTRACT_DIR = path.join(ROOT, '__docx_extract');
const DOC_XML = path.join(EXTRACT_DIR, 'word', 'document.xml');

/** Decode the few XML entities that appear in w:t text nodes. */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Collapse whitespace. */
function clean(s) {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

/** Extract the concatenated text of a single <w:tc> cell. */
function cellText(cellXml) {
  // Each <w:t ...>text</w:t> run; also treat <w:tab/> and <w:br/> as spaces.
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let m;
  while ((m = re.exec(cellXml)) !== null) {
    if (m[1] !== undefined) out += m[1];
    else out += ' ';
  }
  return clean(out);
}

/** Split a table row into its cell XML chunks. */
function rowCells(rowXml) {
  const cells = [];
  const re = /<w:tc>([\s\S]*?)<\/w:tc>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) cells.push(m[1]);
  return cells;
}

/** Iterate all <w:tr> rows across the whole document, in order. */
function* rows(xml) {
  const re = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let m;
  while ((m = re.exec(xml)) !== null) yield m[1];
}

function ensureExtracted() {
  if (fs.existsSync(DOC_XML)) return;
  if (fs.existsSync(EXTRACT_DIR)) fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  // Use PowerShell's Expand-Archive via a .zip copy.
  const ps =
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
    `[System.IO.Compression.ZipFile]::ExtractToDirectory('${DOCX}', '${EXTRACT_DIR}')`;
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });
}

function main() {
  ensureExtracted();
  const xml = fs.readFileSync(DOC_XML, 'utf8');

  const items = [];
  const seen = new Set();
  let idx = 0;

  for (const row of rows(xml)) {
    const cells = rowCells(row).map(cellText);
    if (cells.length < 5) continue; // not a 5-column data row

    const [stt, word, type, pron, meaning] = cells;

    // Skip header rows (the STT column literally says "STT", word col empty, etc.)
    if (!/^\d+$/.test(stt)) continue;
    if (!word) continue;

    // De-dupe by word (some sections repeat).
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    idx++;
    const item = {
      id: `a1-a2_${String(idx).padStart(4, '0')}`,
      word,
      meaning: meaning || '',
      examples: [],
      category: 'a1-a2',
      groupIndex: Math.ceil(idx / 10)
    };
    // type column (n, v, adj...) -> keep as wordType when present.
    if (type) item.wordType = type;
    // Only attach pronunciation when it actually looks like IPA.
    if (pron && /[\/\[].*[\/\]]/.test(pron)) {
      item.pronunciation = pron;
    } else if (pron) {
      item.pronunciation = pron;
    }

    items.push(item);
  }

  const json = {
    metadata: {
      source: 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.docx',
      generatedAt: new Date().toISOString().split('T')[0],
      totalItems: items.length,
      categories: ['a1-a2']
    },
    items
  };

  fs.writeFileSync(OUT, JSON.stringify(json, null, 2), 'utf8');
  console.log(`Parsed ${items.length} items -> ${path.relative(ROOT, OUT)}`);
  // Print a few samples for verification.
  for (const it of items.slice(0, 5)) {
    console.log(`  ${it.id}: "${it.word}" [${it.wordType || ''}] ${it.pronunciation || ''} = ${it.meaning}`);
  }
  console.log('  ...');
  for (const it of items.slice(-3)) {
    console.log(`  ${it.id}: "${it.word}" [${it.wordType || ''}] ${it.pronunciation || ''} = ${it.meaning}`);
  }
}

main();
