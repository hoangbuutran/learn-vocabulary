/**
 * ShadowingView - Shadowing practice with a YouTube video.
 *
 * Flow:
 *  - User pastes a YouTube link. The backend fetches the captions automatically.
 *  - The video plays sentence by sentence. The line currently being spoken is
 *    highlighted and auto-scrolled into view.
 *  - After each sentence the video PAUSES so the user can repeat it. They can
 *    record themselves (on-device Whisper) to compare, then continue.
 *
 * Requires the backend (see /server) for transcript fetching.
 */
import pronunciationValidator from '../modules/pronunciation-validator.js';
import { showError } from '../utils/helpers.js';
import { API_BASE, HAS_BACKEND } from '../config.js';

let container = null;
let player = null;
let ytApiLoading = null;
let lines = [];             // [{ start, end, text }]
let currentLine = -1;
let playbackRate = 1;
let autoPause = true;       // pause after each sentence for shadowing
let watchTimer = null;
let videoId = '';
let lastWordMatch = null;   // { idx, words: [{word, ok}] } highlight for the current line

const SESSION_KEY = 'shadowing_session';

export function render(el) {
  container = el;
  const saved = loadSession();
  renderSetup(saved);
}

export function destroy() {
  stopWatch();
  if (player && player.destroy) {
    try { player.destroy(); } catch (_) {}
  }
  player = null;
  if (container) container.innerHTML = '';
  container = null;
}

// --- Persistence -----------------------------------------------------------

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (_) {}
}

// --- Parsing ----------------------------------------------------------------

function parseVideoId(input) {
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

// --- YouTube IFrame API -----------------------------------------------------

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiLoading) return ytApiLoading;
  ytApiLoading = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiLoading;
}

// --- Setup screen -----------------------------------------------------------

function renderSetup(saved) {
  if (!container) return;
  const url = saved && saved.url ? saved.url : '';

  container.innerHTML = `
    <section class="view shadowing-view" aria-label="Luyện nói theo (Shadowing)">
      <h2>Luyện nói theo (Shadowing)</h2>
      <p class="shadow-intro">
        Dán link YouTube để học video mới, hoặc chọn video có sẵn ở thư viện bên
        dưới. App phát từng câu, dừng cho bạn đọc theo và so sánh giọng của bạn.
      </p>

      <div class="shadow-add">
        <div class="shadow-add-input-row">
          <input type="url" id="yt-url" class="shadow-input shadow-url-input" placeholder="Dán link YouTube vào đây..." value="${escapeAttr(url)}" />
          <button class="btn btn-secondary btn-sm" id="shadow-paste" type="button" title="Dán từ clipboard">📋 Dán</button>
        </div>
        <div class="shadow-add-options">
          <select id="yt-level" class="shadow-select">
            <option value="">— Chọn cấp độ —</option>
            <option value="A1">A1 – Mới bắt đầu</option>
            <option value="A2">A2 – Sơ cấp</option>
            <option value="B1">B1 – Trung cấp</option>
            <option value="B2">B2 – Trung cao cấp</option>
            <option value="C1">C1 – Cao cấp</option>
            <option value="C2">C2 – Thành thạo</option>
          </select>
          <button class="btn btn-primary" id="shadow-start">Học ngay</button>
        </div>
        <div class="shadow-autofetch-status" id="shadow-status"></div>
        ${!HAS_BACKEND ? '<p class="shadow-hint">⚠️ Chưa cấu hình backend.</p>' : ''}
      </div>

      <div class="shadow-library" id="shadow-library">
        <div class="shadow-library-head">
          <h3>📚 Thư viện video</h3>
        </div>
        <div class="shadow-library-list" id="shadow-library-list">
          <p class="shadow-hint">Đang tải danh sách...</p>
        </div>
      </div>
    </section>
  `;

  const startBtn = container.querySelector('#shadow-start');
  if (startBtn) startBtn.addEventListener('click', () => startFromUrl());
  const pasteBtn = container.querySelector('#shadow-paste');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const urlInput = container.querySelector('#yt-url');
        if (urlInput && text) urlInput.value = text.trim();
      } catch (_) { /* clipboard permission denied or not supported */ }
    });
  }

  loadLibrary();
}

/** Load and render the shared video library from the backend. */
async function loadLibrary() {
  const listEl = container && container.querySelector('#shadow-library-list');
  if (!listEl) return;

  if (!HAS_BACKEND) {
    listEl.innerHTML = '<p class="shadow-hint">Cần backend để hiển thị thư viện chung.</p>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/library`);
    const data = await res.json();
    const videos = (data && data.videos) || [];
    if (videos.length === 0) {
      listEl.innerHTML = '<p class="shadow-hint">Chưa có video nào. Hãy thêm video đầu tiên bên dưới!</p>';
      return;
    }
    listEl.innerHTML = videos.map(v => `
      <button class="shadow-lib-item" data-id="${escapeAttr(v.videoId)}">
        <img class="shadow-lib-thumb" src="https://img.youtube.com/vi/${escapeAttr(v.videoId)}/mqdefault.jpg" alt="" loading="lazy" />
        <span class="shadow-lib-info">
          <span class="shadow-lib-title">${escapeHtml(v.title || v.videoId)}</span>
          <span class="shadow-lib-meta">${v.level ? escapeHtml(v.level) + ' · ' : ''}${v.lineCount} câu</span>
        </span>
      </button>
    `).join('');
    listEl.querySelectorAll('.shadow-lib-item').forEach(btn => {
      btn.addEventListener('click', () => playFromLibrary(btn.getAttribute('data-id')));
    });
  } catch (err) {
    listEl.innerHTML = '<p class="shadow-hint">Không kết nối được backend. Hãy chạy server (thư mục /server).</p>';
  }
}

/** Load a saved video (with its transcript) from the library and start. */
async function playFromLibrary(id) {
  try {
    const res = await fetch(`${API_BASE}/api/library/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data.lines || data.lines.length === 0) {
      showError('Không tải được video này.');
      return;
    }
    lines = data.lines;
    videoId = data.videoId;
    currentLine = -1;
    renderPlayer(data.videoId);
  } catch (err) {
    showError('Không kết nối được backend.');
  }
}

/**
 * Fetch transcript for the pasted URL, auto-save to the shared library, then
 * start studying. The video title is taken from YouTube automatically.
 */
async function startFromUrl() {
  const urlVal = container.querySelector('#yt-url').value;
  const levelVal = container.querySelector('#yt-level') ? container.querySelector('#yt-level').value : '';
  const statusEl = container.querySelector('#shadow-status');
  const vid = parseVideoId(urlVal);
  if (!vid) {
    showError('Link YouTube không hợp lệ. Hãy dán link đầy đủ.');
    return;
  }
  if (!HAS_BACKEND) {
    showError('Cần backend để lấy lời thoại. Hãy chạy server trong thư mục /server.');
    return;
  }

  const setStatus = (m) => { if (statusEl) statusEl.textContent = m; };
  setStatus('Đang lấy lời thoại...');

  try {
    const res = await fetch(`${API_BASE}/api/transcript?url=${encodeURIComponent(vid)}&lang=en`);
    const data = await res.json();
    if (!res.ok || !data.lines || data.lines.length === 0) {
      setStatus('');
      showError((data && data.error) || 'Không lấy được lời thoại cho video này.');
      return;
    }

    // Auto-save to the shared library in the BACKGROUND (don't block playback).
    // Title comes from YouTube on the server side.
    fetch(`${API_BASE}/api/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: vid, level: levelVal, lines: data.lines })
    }).catch(() => { /* saving is best-effort */ });

    // Go straight to the player.
    lines = data.lines;
    videoId = vid;
    currentLine = -1;
    saveSession({ url: urlVal });
    renderPlayer(vid);
  } catch (err) {
    setStatus('');
    showError('Không kết nối được backend. Hãy chạy server (thư mục /server) rồi thử lại.');
  }
}

// --- Player screen ----------------------------------------------------------

function renderPlayer(vid) {
  if (!container) return;

  container.innerHTML = `
    <section class="view shadowing-view shadowing-play" aria-label="Luyện nói theo">
      <div class="shadow-topbar">
        <h2>Luyện nói theo</h2>
        <button class="btn btn-text" id="shadow-back">← Đổi video</button>
      </div>

      <div class="shadow-layout">
        <div class="shadow-left">
          <div class="shadow-video-wrap">
            <div id="yt-player"></div>
          </div>

          <div class="shadow-controls">
            <div class="shadow-speed">
              <span>Tốc độ:</span>
              ${[0.5, 0.75, 1].map(r => `<button class="shadow-speed-btn ${r === playbackRate ? 'active' : ''}" data-rate="${r}">${r}x</button>`).join('')}
            </div>
            <label class="shadow-autopause">
              <input type="checkbox" id="shadow-autopause" ${autoPause ? 'checked' : ''} />
              <span>Dừng sau mỗi câu</span>
            </label>
          </div>

          <div class="shadow-current" id="shadow-current"></div>

          <div class="shadow-actions">
            <button class="btn btn-secondary btn-sm" id="shadow-prev">← Trước</button>
            <button class="btn btn-primary btn-sm" id="shadow-replay">🔁 Nghe lại</button>
            <button class="btn btn-secondary btn-sm" id="shadow-next">Sau →</button>
          </div>

          <div class="shadow-record">
            <div class="shadow-record-btns">
              <button class="btn btn-primary btn-shadow-mic" id="shadow-mic" aria-label="Đọc theo">🎤 Đọc theo</button>
              <button class="btn btn-success" id="shadow-continue" style="display:none">▶ Tiếp tục</button>
            </div>
            <div class="shadow-result" id="shadow-result" aria-live="polite"></div>
          </div>
        </div>

        <aside class="shadow-right">
          <h3 class="shadow-lines-title">Lời thoại</h3>
          <div class="shadow-lines" id="shadow-lines"></div>
        </aside>
      </div>
    </section>
  `;

  renderLineList();
  renderCurrentLine();
  setupPlayerControls();

  loadYouTubeApi().then(() => {
    player = new window.YT.Player('yt-player', {
      videoId: vid,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => {
          try { player.setPlaybackRate(playbackRate); } catch (_) {}
          // Run the watcher continuously; it checks play state itself.
          startWatch();
        },
        onStateChange: onPlayerStateChange
      }
    });
  });
}

/** Track playback so we can highlight the active line and auto-pause. */
function onPlayerStateChange(e) {
  if (!window.YT) return;
  if (e.data === window.YT.PlayerState.ENDED) {
    // keep watcher running; nothing to highlight at the end
  }
}

function renderCurrentLine() {
  const el = container && container.querySelector('#shadow-current');
  if (!el) return;
  if (currentLine < 0 || currentLine >= lines.length) {
    el.innerHTML = `<p class="shadow-line-text shadow-line-muted">Nhấn ▶ trên video để bắt đầu. Mỗi câu sẽ tự dừng cho bạn đọc theo.</p>`;
    return;
  }
  const line = lines[currentLine];

  // If we have a word-by-word result for THIS line, colour each word.
  let textHtml;
  if (lastWordMatch && lastWordMatch.idx === currentLine && lastWordMatch.words.length) {
    textHtml = lastWordMatch.words.map(w =>
      `<span class="shadow-word ${w.ok ? 'ok' : 'bad'}">${escapeHtml(w.word)}</span>`
    ).join(' ');
  } else {
    textHtml = escapeHtml(line.text);
  }

  el.innerHTML = `
    <span class="shadow-line-no">Câu ${currentLine + 1} / ${lines.length}</span>
    <p class="shadow-line-text">${textHtml}</p>
  `;
}

/**
 * Build per-word match info comparing the target line against spoken text.
 * @param {string} target
 * @param {string} spoken
 * @returns {Array<{word:string, ok:boolean}>}
 */
function buildWordMatch(target, spoken) {
  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const spokenSet = new Set(norm(spoken).split(' ').filter(Boolean));
  // Keep original words (with punctuation) for display, match on normalized form.
  return target.split(/\s+/).filter(Boolean).map(w => {
    const key = norm(w);
    return { word: w, ok: key !== '' && spokenSet.has(key) };
  });
}

function renderLineList() {
  const el = container && container.querySelector('#shadow-lines');
  if (!el) return;
  el.innerHTML = lines.map((l, i) => `
    <button class="shadow-line-item ${i === currentLine ? 'active' : ''}" data-idx="${i}">
      <span class="shadow-line-item-no">${i + 1}</span>
      <span>${escapeHtml(l.text)}</span>
    </button>
  `).join('');
  el.querySelectorAll('.shadow-line-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      playLine(idx);
    });
  });
}

/** Highlight a line in both the current box and the list, scroll into view. */
function setActiveLine(idx) {
  if (idx === currentLine) return;
  currentLine = idx;
  renderCurrentLine();

  const list = container && container.querySelector('#shadow-lines');
  if (list) {
    list.querySelectorAll('.shadow-line-item').forEach((b) => {
      const i = parseInt(b.getAttribute('data-idx'), 10);
      b.classList.toggle('active', i === idx);
      if (i === idx) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

function setupPlayerControls() {
  container.querySelectorAll('.shadow-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playbackRate = parseFloat(btn.getAttribute('data-rate'));
      container.querySelectorAll('.shadow-speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (player && player.setPlaybackRate) {
        try { player.setPlaybackRate(playbackRate); } catch (_) {}
      }
    });
  });

  const apEl = container.querySelector('#shadow-autopause');
  if (apEl) apEl.addEventListener('change', (e) => { autoPause = e.target.checked; });

  container.querySelector('#shadow-replay').addEventListener('click', () => {
    if (currentLine >= 0) playLine(currentLine);
  });
  container.querySelector('#shadow-prev').addEventListener('click', () => {
    if (currentLine > 0) playLine(currentLine - 1);
  });
  container.querySelector('#shadow-next').addEventListener('click', () => {
    if (currentLine < lines.length - 1) playLine(currentLine + 1);
  });
  container.querySelector('#shadow-mic').addEventListener('click', handleShadowRecord);
  container.querySelector('#shadow-continue').addEventListener('click', () => {
    hideContinue();
    if (currentLine < lines.length - 1) playLine(currentLine + 1);
  });
  container.querySelector('#shadow-back').addEventListener('click', () => {
    stopWatch();
    render(container);
  });
}

// --- Playback ---------------------------------------------------------------

function stopWatch() {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
}

/** Continuously watch playback time to highlight lines and auto-pause. */
function startWatch() {
  stopWatch();
  watchTimer = setInterval(() => {
    if (!player || !player.getCurrentTime || !player.getPlayerState) return;
    // Only act while the video is actually playing.
    const state = player.getPlayerState();
    if (state !== (window.YT && window.YT.PlayerState.PLAYING)) return;

    const t = player.getCurrentTime();

    // End of the active line reached? Auto-pause for shadowing.
    if (autoPause && currentLine >= 0 && currentLine < lines.length) {
      const line = lines[currentLine];
      if (line.end != null && t >= line.end - 0.05) {
        player.pauseVideo();
        showContinue();
        return;
      }
    }

    // Keep the highlighted line in sync with the current time.
    const idx = lineIndexAt(t);
    if (idx !== -1 && idx !== currentLine) {
      setActiveLine(idx);
    }
  }, 120);
}

/** Find which line covers a given time. */
function lineIndexAt(t) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.start != null && l.end != null && t >= l.start && t < l.end) return i;
  }
  return -1;
}

/** Jump to and play a specific line. */
function playLine(idx) {
  if (!player || !player.seekTo) return;
  if (idx < 0 || idx >= lines.length) return;
  hideContinue();
  lastWordMatch = null; // clear previous word highlight
  setActiveLine(idx);
  const line = lines[idx];
  if (line.start == null) return;
  player.seekTo(line.start, true);
  player.playVideo();
  startWatch();
}

function showContinue() {
  const btn = container && container.querySelector('#shadow-continue');
  const result = container && container.querySelector('#shadow-result');
  if (btn) btn.style.display = '';
  if (result && !result.textContent) {
    result.innerHTML = '<span class="result-info">Đến lượt bạn — bấm 🎤 đọc theo, hoặc ▶ Tiếp tục.</span>';
  }
}
function hideContinue() {
  const btn = container && container.querySelector('#shadow-continue');
  if (btn) btn.style.display = 'none';
  const result = container && container.querySelector('#shadow-result');
  if (result) result.innerHTML = '';
}

// --- Recording / comparison -------------------------------------------------

async function handleShadowRecord() {
  const resultEl = container && container.querySelector('#shadow-result');
  const micBtn = container && container.querySelector('#shadow-mic');
  if (currentLine < 0 || currentLine >= lines.length) return;
  const line = lines[currentLine];

  if (micBtn) micBtn.classList.add('recording');

  const setStatus = (s) => {
    if (!resultEl) return;
    if (s === 'loading-model') resultEl.innerHTML = '<span class="result-info">Đang tải mô hình (lần đầu)...</span>';
    else if (s === 'listening') resultEl.innerHTML = '<span class="result-info">🎤 Đang nghe... đọc theo câu trên.</span>';
    else if (s === 'processing') resultEl.innerHTML = '<span class="result-info">Đang xử lý...</span>';
  };

  try {
    const result = await pronunciationValidator.startValidation(line.text, { onStatus: setStatus, maxMs: 12000 });
    // Colour each word of the current line by whether it was spoken.
    lastWordMatch = {
      idx: currentLine,
      words: buildWordMatch(line.text, result.recognizedText || '')
    };
    renderCurrentLine();

    if (resultEl) {
      const score = Math.round((result.score || 0) * 100);
      const cls = result.passed ? 'result-pass' : 'result-fail';
      resultEl.innerHTML = `<span class="${cls}">Khớp ${score}% — Bạn đọc: "${result.recognizedText}"</span>`;
    }
    // Keep the "continue" button visible so they can move on.
    const btn = container && container.querySelector('#shadow-continue');
    if (btn) btn.style.display = '';
  } catch (err) {
    if (resultEl) resultEl.innerHTML = `<span class="result-error">${err.message}</span>`;
  } finally {
    if (micBtn) micBtn.classList.remove('recording');
  }
}

// --- Utils ------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
