/**
 * Shared helpers for the backend.
 */

/** Extract an 11-char YouTube video id from a URL or raw id. */
export function parseVideoId(input) {
  const s = (input || '').trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return '';
}

/** Normalize text for comparison: lowercase, strip punctuation, collapse spaces. */
export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance between two strings. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Similarity ratio in [0,1] based on Levenshtein distance. */
export function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Compare a spoken/recognized text against a target phrase.
 * Returns a score plus per-word matching so the frontend can highlight.
 */
export function comparePhrase(target, spoken) {
  const t = normalize(target);
  const s = normalize(spoken);
  const score = similarity(t, s);

  const targetWords = t.split(' ').filter(Boolean);
  const spokenSet = new Set(s.split(' ').filter(Boolean));
  const words = targetWords.map((w) => ({
    word: w,
    matched: spokenSet.has(w)
  }));
  const matchedCount = words.filter((w) => w.matched).length;

  return {
    score: Number(score.toFixed(3)),
    passed: score >= 0.72,
    matchedWords: matchedCount,
    totalWords: targetWords.length,
    words
  };
}

/**
 * Merge raw caption segments into full sentences with correct timing.
 * YouTube captions are split into short display chunks (often mid-sentence);
 * we join them and split on sentence-ending punctuation so each line is a
 * complete sentence with a start (first chunk) and end (last chunk).
 *
 * @param {Array<{start:number,end:number,text:string}>} segments
 * @returns {Array<{start:number,end:number,text:string}>}
 */
export function mergeIntoSentences(segments) {
  const sentences = [];
  let buf = '';
  let start = null;
  let end = null;

  const flush = () => {
    let text = buf.replace(/\s+/g, ' ').trim();
    // Drop standalone music/markup tokens.
    text = text.replace(/[♪♫]/g, '').replace(/\s+/g, ' ').trim();
    // Skip lines with no actual letters (e.g. "[]", "(...)", "♪♪♪").
    const hasLetters = /[a-zA-Z]/.test(text);
    if (text && hasLetters && start != null) {
      sentences.push({
        start: Number(start.toFixed(2)),
        end: Number((end != null ? end : start).toFixed(2)),
        text
      });
    }
    buf = '';
    start = null;
    end = null;
  };

  // Comfortable length for a shadowing line (split sooner than full paragraphs).
  const SOFT_MAX = 90;

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const piece = (seg.text || '').replace(/\s+/g, ' ').trim();
    if (!piece) continue;

    // A big time gap before this segment means a new sentence.
    if (start != null && seg.start != null && end != null && seg.start - end > 1.2) {
      flush();
    }

    if (start == null) start = seg.start;
    end = seg.end;
    buf += (buf ? ' ' : '') + piece;

    const endsSentence = /[.!?…]["')\]]?$/.test(buf);
    const hasMusicBreak = /[♪♫]\s*$/.test(piece); // lyric line boundary
    if (endsSentence || hasMusicBreak || buf.length >= SOFT_MAX) {
      flush();
    }
  }
  flush();

  // Fix overlapping timestamps from rolling captions: a sentence must not
  // extend past the start of the next one. Keeps auto-pause accurate.
  for (let i = 0; i < sentences.length - 1; i++) {
    if (sentences[i].end > sentences[i + 1].start) {
      sentences[i].end = sentences[i + 1].start;
    }
    // Guard against a zero/negative span.
    if (sentences[i].end <= sentences[i].start) {
      sentences[i].end = Number((sentences[i].start + 0.5).toFixed(2));
    }
  }

  return sentences.length ? sentences : segments;
}
