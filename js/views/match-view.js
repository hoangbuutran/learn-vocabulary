/**
 * MatchView - "Nối từ" matching game (continuous, anti-memorization).
 *
 * Design goals:
 *  - Always keep N live pairs on screen. When a pair is matched correctly it
 *    disappears and a brand-new word slides in to replace it, so the board never
 *    gets easier through elimination.
 *  - Re-shuffle BOTH columns on every successful match, and the two columns are
 *    independently shuffled, so positions never line up — you must actually read
 *    and recall the meaning instead of memorizing positions.
 *  - No rounds: play continuously, stop whenever you like.
 */
import storageManager from '../modules/storage-manager.js';
import speechModule from '../modules/speech-module.js';
import { showSuccess } from '../utils/helpers.js';

let container = null;

/** Game state */
let pool = [];           // shuffled queue of upcoming vocabulary items
let poolIndex = 0;       // next item to pull from the pool
let live = [];           // currently visible pairs [{id, word, meaning}]
let leftOrder = [];      // ids ordered for the left (English) column
let rightOrder = [];     // ids ordered for the right (meaning) column
let selectedLeft = null;
let selectedRight = null;
let locked = false;      // briefly true while showing wrong-answer feedback
let matchedCount = 0;
let mistakes = 0;
let streak = 0;
let bestStreak = 0;
let history = [];        // matched pairs, newest first [{word, meaning}]

const LIVE_PAIRS = 5;
const HISTORY_MAX = 50;  // keep the most recent matches

export function render(el) {
  container = el;
  resetGame();
  renderStart();
}

export function destroy() {
  if (speechModule.stopRecognition) speechModule.stopRecognition();
  if (container) container.innerHTML = '';
  container = null;
  resetGame();
}

function resetGame() {
  pool = [];
  poolIndex = 0;
  live = [];
  leftOrder = [];
  rightOrder = [];
  selectedLeft = null;
  selectedRight = null;
  locked = false;
  matchedCount = 0;
  mistakes = 0;
  streak = 0;
  bestStreak = 0;
  history = [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pull the next vocabulary item from the (looping) pool. */
function takeFromPool() {
  if (poolIndex >= pool.length) {
    pool = shuffle(pool);
    poolIndex = 0;
  }
  return pool[poolIndex++];
}

/** Independently shuffle the two columns so positions never align. */
function reshuffleColumns() {
  leftOrder = shuffle(live.map(p => p.id));
  rightOrder = shuffle(live.map(p => p.id));
  // Avoid the "easy" case where a row lines up; nudge if identical order.
  if (live.length > 1 && leftOrder.join() === rightOrder.join()) {
    rightOrder = shuffle(rightOrder);
  }
}

function renderStart() {
  if (!container) return;

  const vocab = storageManager.getActiveVocabulary().filter(it => it.word && it.meaning);
  const enough = vocab.length >= LIVE_PAIRS;

  container.innerHTML = `
    <section class="view match-view" aria-label="Nối từ">
      <h2>Nối từ</h2>
      <div class="match-start">
        <p class="match-intro">
          Nối từ tiếng Anh với nghĩa đúng. Nối đúng cặp nào thì cặp đó biến mất và
          một từ mới xuất hiện ngay — chơi liên tục, không nghỉ. Vị trí xáo trộn
          liên tục nên bạn phải thực sự nhớ nghĩa, không nhớ mẹo được đâu!
        </p>
        ${enough
          ? `<button class="btn btn-primary btn-lg" id="btn-start-match" aria-label="Bắt đầu">Bắt đầu chơi</button>`
          : `<p class="empty-message">Cần ít nhất ${LIVE_PAIRS} từ vựng để chơi. Hãy nhập thêm dữ liệu.</p>
             <a href="#import" class="btn btn-primary" role="button">Nhập dữ liệu</a>`
        }
      </div>
    </section>
  `;

  const startBtn = container.querySelector('#btn-start-match');
  if (startBtn) startBtn.addEventListener('click', startGame);
}

function startGame() {
  const vocab = storageManager.getActiveVocabulary().filter(it => it.word && it.meaning);
  pool = shuffle(vocab);
  poolIndex = 0;
  live = [];
  matchedCount = 0;
  mistakes = 0;
  streak = 0;
  bestStreak = 0;
  history = [];
  selectedLeft = null;
  selectedRight = null;
  locked = false;

  // Fill the board.
  for (let i = 0; i < LIVE_PAIRS; i++) {
    live.push(takeFromPool());
  }
  reshuffleColumns();
  renderBoard();
}

function renderBoard() {
  if (!container) return;

  const byId = (id) => live.find(p => p.id === id);

  const leftHtml = leftOrder.map(id => {
    const p = byId(id);
    if (!p) return '';
    const selected = selectedLeft === id;
    return `<button class="match-card match-left${selected ? ' selected' : ''}" data-side="left" data-id="${id}" aria-label="${p.word}">
      ${p.word}
    </button>`;
  }).join('');

  const rightHtml = rightOrder.map(id => {
    const p = byId(id);
    if (!p) return '';
    const selected = selectedRight === id;
    return `<button class="match-card match-right${selected ? ' selected' : ''}" data-side="right" data-id="${id}" aria-label="${p.meaning}">
      ${p.meaning}
    </button>`;
  }).join('');

  const historyHtml = history.length === 0
    ? `<p class="match-history-empty">Các cặp bạn nối đúng sẽ xuất hiện ở đây để xem và nghe lại.</p>`
    : history.map((h, i) => `
        <li class="match-history-item">
          <button class="match-history-audio" data-history="${i}" aria-label="Nghe lại ${h.word}" title="Nghe lại">🔊</button>
          <span class="match-history-word">${h.word}</span>
          <span class="match-history-sep">—</span>
          <span class="match-history-meaning">${h.meaning}</span>
        </li>
      `).join('');

  container.innerHTML = `
    <section class="view match-view" aria-label="Nối từ">
      <div class="match-topbar">
        <h2>Nối từ</h2>
        <div class="match-stats">
          <span class="match-stat match-stat-score"><span class="match-stat-label">Đã nối</span><span class="match-stat-value">${matchedCount}</span></span>
          <span class="match-stat match-stat-streak"><span class="match-stat-label">Chuỗi đúng</span><span class="match-stat-value">${streak}<small> / kỷ lục ${bestStreak}</small></span></span>
          <span class="match-stat match-stat-miss"><span class="match-stat-label">Sai</span><span class="match-stat-value">${mistakes}</span></span>
        </div>
      </div>

      <div class="match-layout">
        <div class="match-panel match-panel-board">
          <p class="match-instruction">Chọn 1 từ tiếng Anh, rồi chọn nghĩa đúng của nó.</p>
          <div class="match-board">
            <div class="match-column" role="group" aria-label="Từ tiếng Anh">
              <div class="match-column-head match-column-head-en">🇬🇧 Tiếng Anh</div>
              ${leftHtml}
            </div>
            <div class="match-column" role="group" aria-label="Nghĩa tiếng Việt">
              <div class="match-column-head match-column-head-vi">🇻🇳 Nghĩa tiếng Việt</div>
              ${rightHtml}
            </div>
          </div>

          <div class="match-footer">
            <button class="btn btn-secondary" id="btn-stop-match" aria-label="Dừng">Dừng</button>
          </div>
        </div>

        <aside class="match-panel match-history" aria-label="Lịch sử các cặp đã nối">
          <h3 class="match-history-title">📚 Đã học <span class="match-history-count">${history.length}</span></h3>
          <ul class="match-history-list">
            ${historyHtml}
          </ul>
        </aside>
      </div>
    </section>
  `;

  setupListeners();
}

function setupListeners() {
  if (!container) return;
  container.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('click', () => {
      if (locked) return;
      handleSelect(card.getAttribute('data-side'), card.getAttribute('data-id'));
    });
  });
  const stopBtn = container.querySelector('#btn-stop-match');
  if (stopBtn) stopBtn.addEventListener('click', stopGame);

  // History replay buttons
  container.querySelectorAll('.match-history-audio').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-history'), 10);
      const item = history[i];
      if (item) speechModule.speak(item.word).catch(() => {});
    });
  });
}

function handleSelect(side, id) {
  if (side === 'left') {
    selectedLeft = selectedLeft === id ? null : id;
    const p = live.find(i => i.id === id);
    if (p && selectedLeft === id) {
      speechModule.speak(p.word).catch(() => {});
    }
  } else {
    selectedRight = selectedRight === id ? null : id;
  }

  if (selectedLeft && selectedRight) {
    evaluateMatch();
  } else {
    renderBoard();
  }
}

function evaluateMatch() {
  const correct = selectedLeft === selectedRight;

  if (correct) {
    const matchedId = selectedLeft;
    matchedCount += 1;
    streak += 1;
    if (streak > bestStreak) bestStreak = streak;

    // Save to history (newest first) so the player can review/replay later.
    const matchedPair = live.find(p => p.id === matchedId);
    if (matchedPair) {
      history.unshift({ word: matchedPair.word, meaning: matchedPair.meaning });
      if (history.length > HISTORY_MAX) history.pop();
    }

    selectedLeft = null;
    selectedRight = null;

    // Briefly mark the pair as matched, then replace it with a fresh word.
    markMatched(matchedId);
    locked = true;
    setTimeout(() => {
      // Replace matched pair with a new one from the pool.
      const idx = live.findIndex(p => p.id === matchedId);
      if (idx !== -1) {
        let next = takeFromPool();
        // Avoid showing a word that's already live.
        let guard = 0;
        while (live.some(p => p.id === next.id) && guard < 10) {
          next = takeFromPool();
          guard++;
        }
        live[idx] = next;
      }
      // Re-shuffle BOTH columns so nothing stays in place.
      reshuffleColumns();
      locked = false;
      renderBoard();
    }, 400);
  } else {
    mistakes += 1;
    streak = 0;
    flashWrong(selectedLeft, selectedRight);
    selectedLeft = null;
    selectedRight = null;
  }
}

/** Show a green matched state on the just-completed pair before it's replaced. */
function markMatched(id) {
  if (!container) return;
  const l = container.querySelector(`.match-left[data-id="${id}"]`);
  const r = container.querySelector(`.match-right[data-id="${id}"]`);
  [l, r].forEach(el => {
    if (el) {
      el.classList.remove('selected');
      el.classList.add('matched');
      el.disabled = true;
    }
  });
}

function flashWrong(leftId, rightId) {
  if (!container) return;
  locked = true;
  const l = container.querySelector(`.match-left[data-id="${leftId}"]`);
  const r = container.querySelector(`.match-right[data-id="${rightId}"]`);
  if (l) l.classList.add('wrong');
  if (r) r.classList.add('wrong');
  setTimeout(() => {
    locked = false;
    // Re-shuffle on a mistake too, so guessing by position doesn't help.
    reshuffleColumns();
    renderBoard();
  }, 650);
}

function stopGame() {
  showSuccess(`Tốt lắm! Bạn đã nối đúng ${matchedCount} cặp, chuỗi đúng dài nhất ${bestStreak}.`);
  resetGame();
  renderStart();
}
