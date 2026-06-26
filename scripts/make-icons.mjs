/**
 * Generate simple PNG app icons for the PWA (no external deps).
 * Draws a solid indigo rounded background with a white book/"Aa" glyph.
 *
 * Outputs:
 *   assets/icons/icon-192.png
 *   assets/icons/icon-512.png
 *   assets/icons/icon-maskable-512.png
 *
 * Usage: node scripts/make-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.resolve(__dirname, '..', 'assets', 'icons');

const BG = [79, 70, 229];     // indigo #4f46e5
const FG = [255, 255, 255];   // white

/** 5x7 bitmap font for the few glyphs we need. */
const FONT = {
  A: [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],
  a: [
    '00000',
    '00000',
    '01110',
    '00001',
    '01111',
    '10001',
    '01111'
  ]
};

function makeCanvas(size) {
  // RGBA pixel buffer filled with the background colour.
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0];
    px[i * 4 + 1] = BG[1];
    px[i * 4 + 2] = BG[2];
    px[i * 4 + 3] = 255;
  }
  return px;
}

function setPixel(px, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = 255;
}

/** Draw a glyph scaled by `scale`, top-left at (ox, oy). */
function drawGlyph(px, size, glyph, ox, oy, scale, color) {
  const rows = FONT[glyph];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '1') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            setPixel(px, size, ox + c * scale + dx, oy + r * scale + dy, color);
          }
        }
      }
    }
  }
}

/** Encode an RGBA buffer into a PNG buffer. */
function encodePng(px, size) {
  const bytesPerPixel = 4;
  const rowLen = size * bytesPerPixel;
  // Add a filter byte (0) at the start of each scanline.
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0;
    px.copy(raw, y * (rowLen + 1) + 1, y * rowLen, y * rowLen + rowLen);
  }
  const compressed = zlib.deflateSync(raw);

  const chunks = [];
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  chunks.push(sig);
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', compressed));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

// CRC32 for PNG chunks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildIcon(size) {
  const px = makeCanvas(size);
  // Two glyphs "A" and "a" centered.
  const glyphW = 5, glyphH = 7;
  const scale = Math.floor(size / 16);
  const totalW = glyphW * scale * 2 + scale * 2; // A + gap + a
  const ox = Math.floor((size - totalW) / 2);
  const oy = Math.floor((size - glyphH * scale) / 2);
  drawGlyph(px, size, 'A', ox, oy, scale, FG);
  drawGlyph(px, size, 'a', ox + glyphW * scale + scale * 2, oy, scale, FG);
  return encodePng(px, size);
}

fs.mkdirSync(ICON_DIR, { recursive: true });
fs.writeFileSync(path.join(ICON_DIR, 'icon-192.png'), buildIcon(192));
fs.writeFileSync(path.join(ICON_DIR, 'icon-512.png'), buildIcon(512));
fs.writeFileSync(path.join(ICON_DIR, 'icon-maskable-512.png'), buildIcon(512));
console.log('Icons written to assets/icons/');
