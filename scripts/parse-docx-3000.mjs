/**
 * Parse the 3000-word vocabulary from 3000.docx into clean JSON.
 *
 * Tables have 5 columns: No. | Word | Type | Pronounce | Meaning
 * One vocabulary item per data row. Header/title rows are skipped.
 *
 * Output: data/vocabulary-3000.json
 * Usage: node scripts/parse-docx-3000.mjs
 * DEVELOPMENT-TIME ONLY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCX = path.join(ROOT, '3000.docx');
const OUT = path.join(ROOT, 'data', 'vocabulary-3000.json');
const EXTRACT_DIR = path.join(ROOT, '__docx3000');
const DOC_XML = path.join(EXTRACT_DIR, 'word', 'document.xml');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function clean(s) {
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

function cellText(cellXml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let m;
  while ((m = re.exec(cellXml)) !== null) {
    out += m[1] !== undefined ? m[1] : ' ';
  }
  return clean(out);
}

function rowCells(rowXml) {
  const cells = [];
  const re = /<w:tc>([\s\S]*?)<\/w:tc>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) cells.push(cellText(m[1]));
  return cells;
}

function* rows(xml) {
  const re = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let m;
  while ((m = re.exec(xml)) !== null) yield m[1];
}

function ensureExtracted() {
  if (fs.existsSync(DOC_XML)) return;
  if (fs.existsSync(EXTRACT_DIR)) fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
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
    const cells = rowCells(row);
    if (cells.length < 5) continue;

    const [no, word, type, pron, meaning] = cells;

    // Data rows have a numeric "No." column. Header/title rows do not.
    if (!/^\d+$/.test(no)) continue;
    if (!word) continue;

    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    idx++;
    const item = {
      id: `essential-3000_${String(idx).padStart(4, '0')}`,
      word,
      meaning: meaning || '',
      examples: [],
      category: 'essential-3000',
      groupIndex: Math.ceil(idx / 10)
    };
    if (type) item.wordType = type;
    if (pron) item.pronunciation = pron;

    items.push(item);
  }

  const json = {
    metadata: {
      source: '3000.docx',
      generatedAt: new Date().toISOString().split('T')[0],
      totalItems: items.length,
      categories: ['essential-3000']
    },
    items
  };

  fs.writeFileSync(OUT, JSON.stringify(json, null, 2), 'utf8');
  console.log(`Parsed ${items.length} items -> ${path.relative(ROOT, OUT)}`);
  for (const it of items.slice(0, 5)) {
    console.log(`  ${it.id}: "${it.word}" [${it.wordType || ''}] ${it.pronunciation || ''} = ${it.meaning}`);
  }
  console.log('  ...');
  for (const it of items.slice(-3)) {
    console.log(`  ${it.id}: "${it.word}" [${it.wordType || ''}] ${it.pronunciation || ''} = ${it.meaning}`);
  }
}

main();
