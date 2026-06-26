/**
 * IpaView - "Học phát âm" / IPA pronunciation guide.
 *
 * Shows the English IPA symbols grouped (vowels, diphthongs, consonants), each
 * with a plain Vietnamese hint for how it sounds and an example word you can
 * click to hear. Also includes a small "decoder" that breaks a phonetic string
 * like /ɪnˈrəʊl/ into its symbols so learners can see how to read it.
 */
import speechModule from '../modules/speech-module.js';

let container = null;
/** Map of IPA symbol -> phoneme audio file (loaded from assets/audio/ipa). */
let ipaAudio = null;
const IPA_AUDIO_BASE = 'assets/audio/ipa/';

/**
 * IPA symbol catalogue. `hint` = how it sounds (Vietnamese-friendly),
 * `example` = an English word that contains the sound (used for audio).
 */
const SECTIONS = [
  {
    title: 'Nguyên âm ngắn',
    items: [
      { ipa: 'ɪ', hint: 'i ngắn, gọn', example: 'sit', word: 'i (như "ít")' },
      { ipa: 'e', hint: 'e như "e" tiếng Việt', example: 'bed', word: 'e' },
      { ipa: 'æ', hint: 'a bẹt, miệng rộng', example: 'cat', word: 'a (e pha a)' },
      { ipa: 'ʌ', hint: 'â ngắn', example: 'cup', word: 'â' },
      { ipa: 'ɒ', hint: 'o ngắn (giọng Anh)', example: 'hot', word: 'o' },
      { ipa: 'ʊ', hint: 'u ngắn, gọn', example: 'put', word: 'u' },
      { ipa: 'ə', hint: 'ơ nhẹ, không nhấn (schwa)', example: 'about', word: 'ơ' }
    ]
  },
  {
    title: 'Nguyên âm dài',
    items: [
      { ipa: 'iː', hint: 'i kéo dài', example: 'see', word: 'ii' },
      { ipa: 'ɑː', hint: 'a kéo dài, sâu', example: 'car', word: 'aa' },
      { ipa: 'ɔː', hint: 'o kéo dài', example: 'four', word: 'oo' },
      { ipa: 'uː', hint: 'u kéo dài', example: 'blue', word: 'uu' },
      { ipa: 'ɜː', hint: 'ơ kéo dài (giọng Anh)', example: 'bird', word: 'ơơ' }
    ]
  },
  {
    title: 'Nguyên âm đôi',
    items: [
      { ipa: 'eɪ', hint: 'ây (e + i)', example: 'day', word: 'ây' },
      { ipa: 'aɪ', hint: 'ai', example: 'my', word: 'ai' },
      { ipa: 'ɔɪ', hint: 'oi', example: 'boy', word: 'oi' },
      { ipa: 'aʊ', hint: 'ao', example: 'now', word: 'ao' },
      { ipa: 'əʊ', hint: 'âu (giọng Anh)', example: 'go', word: 'âu' },
      { ipa: 'ɪə', hint: 'ia', example: 'here', word: 'ia' },
      { ipa: 'eə', hint: 'e-ơ', example: 'hair', word: 'eơ' },
      { ipa: 'ʊə', hint: 'u-ơ', example: 'tour', word: 'uơ' }
    ]
  },
  {
    title: 'Phụ âm',
    items: [
      { ipa: 'p', hint: 'p (bật hơi)', example: 'pen', word: 'p' },
      { ipa: 'b', hint: 'b', example: 'bad', word: 'b' },
      { ipa: 't', hint: 't (bật hơi)', example: 'tea', word: 't' },
      { ipa: 'd', hint: 'd (lưỡi chạm lợi)', example: 'did', word: 'đ' },
      { ipa: 'k', hint: 'c/k', example: 'cat', word: 'c' },
      { ipa: 'g', hint: 'g (gờ)', example: 'go', word: 'g' },
      { ipa: 'f', hint: 'ph', example: 'fall', word: 'ph' },
      { ipa: 'v', hint: 'v (rung môi-răng)', example: 'voice', word: 'v' },
      { ipa: 'θ', hint: 'th (lưỡi giữa răng, không rung)', example: 'think', word: 'th (đầu lưỡi)' },
      { ipa: 'ð', hint: 'th (lưỡi giữa răng, có rung)', example: 'this', word: 'đ (đầu lưỡi)' },
      { ipa: 's', hint: 's (xì)', example: 'so', word: 's' },
      { ipa: 'z', hint: 'z (rung)', example: 'zoo', word: 'z' },
      { ipa: 'ʃ', hint: 'sh', example: 'she', word: 'sờ' },
      { ipa: 'ʒ', hint: 'zh (rung)', example: 'vision', word: 'giơ' },
      { ipa: 'tʃ', hint: 'ch', example: 'chair', word: 'ch' },
      { ipa: 'dʒ', hint: 'j (giơ)', example: 'just', word: 'jơ' },
      { ipa: 'm', hint: 'm', example: 'man', word: 'm' },
      { ipa: 'n', hint: 'n', example: 'no', word: 'n' },
      { ipa: 'ŋ', hint: 'ng (cuối từ)', example: 'sing', word: 'ng' },
      { ipa: 'h', hint: 'h (hờ)', example: 'how', word: 'h' },
      { ipa: 'l', hint: 'l', example: 'leg', word: 'l' },
      { ipa: 'r', hint: 'r (cong lưỡi)', example: 'red', word: 'r' },
      { ipa: 'w', hint: 'w (uơ)', example: 'wet', word: 'qu' },
      { ipa: 'j', hint: 'y (như "yêu")', example: 'yes', word: 'y' }
    ]
  }
];

/** Stress / length marks that may appear in a phonetic string. */
const MARKS = {
  'ˈ': 'dấu nhấn chính (trọng âm) — đọc mạnh ở âm tiết ngay sau dấu này',
  'ˌ': 'dấu nhấn phụ — nhấn nhẹ',
  'ː': 'kéo dài âm liền trước',
  '.': 'ngăn cách âm tiết',
  '/': 'dấu mở/đóng phiên âm',
  '(': '', ')': '', ' ': ''
};

/** Quick lookup from ipa symbol -> item, longest symbols first for decoding. */
const SYMBOLS = (() => {
  const map = new Map();
  for (const sec of SECTIONS) {
    for (const it of sec.items) map.set(it.ipa, it);
  }
  return map;
})();

const SYMBOL_KEYS_BY_LEN = [...SYMBOLS.keys()].sort((a, b) => b.length - a.length);

export function render(el) {
  container = el;
  loadIpaAudio().finally(() => renderGuide());
}

export function destroy() {
  if (container) container.innerHTML = '';
  container = null;
}

/** Load the phoneme audio manifest once. */
async function loadIpaAudio() {
  if (ipaAudio) return ipaAudio;
  try {
    const res = await fetch(IPA_AUDIO_BASE + 'manifest.json');
    ipaAudio = res.ok ? await res.json() : {};
  } catch {
    ipaAudio = {};
  }
  return ipaAudio;
}

/** Play the pure phoneme sound for a symbol; fall back to the example word. */
function playPhoneme(ipa) {
  const file = ipaAudio && ipaAudio[ipa];
  if (file) {
    try {
      const audio = new Audio(IPA_AUDIO_BASE + file);
      audio.play().catch(() => playExampleFor(ipa));
      return true;
    } catch {
      return playExampleFor(ipa);
    }
  }
  return playExampleFor(ipa);
}

/** Speak the example word that contains this sound (always available). */
function playExampleFor(ipa) {
  const it = SYMBOLS.get(ipa);
  if (it && it.example) {
    speechModule.speak(it.example).catch(() => {});
    return true;
  }
  return false;
}

function renderGuide() {
  if (!container) return;

  const sectionsHtml = SECTIONS.map(sec => `
    <div class="ipa-section">
      <h3 class="ipa-section-title">${sec.title}</h3>
      <div class="ipa-grid">
        ${sec.items.map(it => {
          const hasPhoneme = ipaAudio && ipaAudio[it.ipa];
          return `
          <div class="ipa-card">
            <span class="ipa-symbol">/${it.ipa}/</span>
            <span class="ipa-read">${it.word}</span>
            <span class="ipa-hint">${it.hint}</span>
            <div class="ipa-card-actions">
              ${hasPhoneme
                ? `<button class="ipa-btn ipa-btn-sound" data-ipa="${it.ipa}" aria-label="Nghe âm ${it.ipa}">🔊 Âm</button>`
                : ''}
              <button class="ipa-btn ipa-btn-example" data-example="${it.example}" aria-label="Nghe ví dụ ${it.example}">🔊 ${it.example}</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <section class="view ipa-view" aria-label="Học phát âm">
      <h2>Học phát âm (IPA)</h2>

      <div class="ipa-decoder">
        <p class="ipa-decoder-label">Gõ phiên âm để xem cách đọc từng ký hiệu (ví dụ <code>/ɪnˈrəʊl/</code>):</p>
        <div class="ipa-decoder-row">
          <input type="text" id="ipa-input" class="ipa-input" placeholder="Dán phiên âm vào đây..." aria-label="Phiên âm cần phân tích" />
          <button class="btn btn-primary" id="ipa-decode-btn" aria-label="Phân tích">Phân tích</button>
        </div>
        <div class="ipa-decoder-result" id="ipa-decoder-result" aria-live="polite"></div>
      </div>

      <p class="ipa-tip">Bấm <strong>🔊 Âm</strong> để nghe âm thuần (ví dụ chỉ riêng /ɪ/), hoặc bấm nút từ ví dụ để nghe âm đó trong một từ.</p>

      ${sectionsHtml}
    </section>
  `;

  setupListeners();
}

function setupListeners() {
  if (!container) return;

  // Play pure phoneme sound.
  container.querySelectorAll('.ipa-btn-sound').forEach(btn => {
    btn.addEventListener('click', () => {
      const ipa = btn.getAttribute('data-ipa');
      if (ipa) playPhoneme(ipa);
    });
  });

  // Play example word.
  container.querySelectorAll('.ipa-btn-example').forEach(btn => {
    btn.addEventListener('click', () => {
      const ex = btn.getAttribute('data-example');
      if (ex) speechModule.speak(ex).catch(() => {});
    });
  });

  const input = container.querySelector('#ipa-input');
  const btn = container.querySelector('#ipa-decode-btn');
  const decode = () => decodePhonetic(input ? input.value : '');
  if (btn) btn.addEventListener('click', decode);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); decode(); }
    });
  }
}

/**
 * Break a phonetic string into its IPA symbols and marks, explaining each.
 * @param {string} text
 */
function decodePhonetic(text) {
  const resultEl = container && container.querySelector('#ipa-decoder-result');
  if (!resultEl) return;

  const raw = (text || '').trim();
  if (!raw) {
    resultEl.innerHTML = '<p class="ipa-empty">Hãy nhập một phiên âm, ví dụ /ɪnˈrəʊl/.</p>';
    return;
  }

  const parts = [];
  const playableSymbols = []; // symbols in order that have a phoneme recording
  let i = 0;
  while (i < raw.length) {
    let matched = null;

    // Try to match the longest known IPA symbol first.
    for (const key of SYMBOL_KEYS_BY_LEN) {
      if (raw.startsWith(key, i)) { matched = key; break; }
    }

    if (matched) {
      const it = SYMBOLS.get(matched);
      const hasSound = ipaAudio && ipaAudio[matched];
      if (hasSound) playableSymbols.push(matched);
      parts.push(`
        <li class="ipa-decode-item${hasSound ? ' ipa-decode-playable' : ''}"${hasSound ? ` data-ipa="${matched}" role="button" tabindex="0" aria-label="Nghe âm ${matched}"` : ''}>
          <span class="ipa-decode-sym">${matched}${hasSound ? ' 🔊' : ''}</span>
          <span class="ipa-decode-read">${it.word}</span>
          <span class="ipa-decode-hint">${it.hint} · ví dụ: ${it.example}</span>
        </li>
      `);
      i += matched.length;
      continue;
    }

    // Not a sound symbol — maybe a stress/length mark.
    const ch = raw[i];
    if (ch in MARKS) {
      if (MARKS[ch]) {
        parts.push(`
          <li class="ipa-decode-item ipa-decode-mark">
            <span class="ipa-decode-sym">${ch}</span>
            <span class="ipa-decode-read">dấu</span>
            <span class="ipa-decode-hint">${MARKS[ch]}</span>
          </li>
        `);
      }
      i += 1;
      continue;
    }

    // Unknown character — show it but flag it.
    parts.push(`
      <li class="ipa-decode-item ipa-decode-unknown">
        <span class="ipa-decode-sym">${ch}</span>
        <span class="ipa-decode-read">?</span>
        <span class="ipa-decode-hint">Không nhận ra ký hiệu này</span>
      </li>
    `);
    i += 1;
  }

  const canPlaySounds = playableSymbols.length > 0;
  resultEl.innerHTML = `
    <div class="ipa-decode-toolbar">
      <p class="ipa-decode-caption">Đọc lần lượt từng âm:</p>
      ${canPlaySounds
        ? `<button class="btn btn-primary btn-sm" id="ipa-play-all" aria-label="Phát lần lượt các âm">▶ Phát từng âm</button>`
        : ''}
    </div>
    <ol class="ipa-decode-list">${parts.join('')}</ol>
    <p class="ipa-decode-note">Bấm vào ô có 🔊 để nghe riêng âm đó. Đây là âm thuần (do hệ thống máy không đọc trực tiếp được phiên âm).</p>
  `;

  // Click a single decoded symbol to hear it.
  resultEl.querySelectorAll('.ipa-decode-playable').forEach(el => {
    const play = () => { const s = el.getAttribute('data-ipa'); if (s) playPhoneme(s); };
    el.addEventListener('click', play);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); }
    });
  });

  // Play all phonemes in sequence.
  const playAllBtn = resultEl.querySelector('#ipa-play-all');
  if (playAllBtn) {
    playAllBtn.addEventListener('click', () => playSequence(playableSymbols));
  }
}

/**
 * Play a list of phoneme recordings one after another.
 * @param {string[]} symbols
 */
function playSequence(symbols) {
  let idx = 0;
  const playNext = () => {
    if (idx >= symbols.length) return;
    const file = ipaAudio && ipaAudio[symbols[idx]];
    idx++;
    if (!file) { playNext(); return; }
    try {
      const audio = new Audio(IPA_AUDIO_BASE + file);
      audio.onended = () => setTimeout(playNext, 150);
      audio.onerror = () => playNext();
      audio.play().catch(() => playNext());
    } catch {
      playNext();
    }
  };
  playNext();
}
