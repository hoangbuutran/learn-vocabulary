/**
 * FlashcardView - Displays vocabulary flashcards with flip animation,
 * pronunciation playback, speech recognition, and memory tracking.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2, 15.1, 15.2
 */
import memorySystem from '../modules/memory-system.js';
import speechModule from '../modules/speech-module.js';
import pronunciationValidator from '../modules/pronunciation-validator.js';
import storageManager from '../modules/storage-manager.js';

let container = null;

/** Session state */
let words = [];
let currentIndex = 0;
let isFlipped = false;
let isRecording = false;
let lastResultHtml = '';

/** LocalStorage key that keeps the current 10-word batch fixed across visits. */
const SESSION_KEY = 'flashcard_session';

/** Load a saved session { ids: string[], index: number } or null. */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist the current batch's word ids and position. */
function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ids: words.map(w => w.id),
      index: currentIndex
    }));
  } catch {
    /* ignore quota errors */
  }
}

/** Forget the current batch so a fresh one is generated next time. */
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Start a fresh batch of words and persist it.
 * @param {string[]} [excludeIds] - ids to avoid (e.g. the batch being replaced)
 */
function startNewBatch(excludeIds = []) {
  const count = storageManager.getSettings().dailyWordCount || 10;
  const exclude = new Set(excludeIds);

  if (exclude.size > 0) {
    // Pull a larger pool then filter out the words we want to avoid.
    const pool = memorySystem.getWordsForStudy(count * 4)
      .filter(w => !exclude.has(w.id));
    words = pool.slice(0, count);
    // If filtering left us short, top up with a normal draw.
    if (words.length < count) {
      const have = new Set(words.map(w => w.id));
      for (const w of memorySystem.getWordsForStudy(count * 4)) {
        if (words.length >= count) break;
        if (!have.has(w.id)) { words.push(w); have.add(w.id); }
      }
    }
  } else {
    words = memorySystem.getWordsForStudy(count);
  }

  currentIndex = 0;
  isFlipped = false;
  lastResultHtml = '';
  saveSession();
}

/**
 * Build a full default progress record so partial updates never wipe SM-2 fields.
 * @param {string} itemId
 * @returns {object}
 */
function newProgress(itemId) {
  const now = new Date().toISOString();
  return {
    itemId,
    status: 'not_studied',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: null,
    lastReviewDate: null,
    pronunciationAttempts: 0,
    firstSuccessDate: null,
    lastPronunciationDate: null,
    pronunciationPassed: false,
    meaningViewed: false,
    pronunciationListened: false,
    assignedDay: null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Render the flashcard view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  isRecording = false;
  lastResultHtml = '';

  // Restore the saved 10-word batch so the user keeps studying the same set
  // until they finish it, instead of getting new words on every visit.
  const saved = loadSession();
  if (saved && Array.isArray(saved.ids) && saved.ids.length > 0) {
    const all = storageManager.getAllVocabulary();
    const byId = new Map(all.map(item => [item.id, item]));
    words = saved.ids.map(id => byId.get(id)).filter(Boolean);
    // Keep the saved position, including the "completed" state (index === length)
    // so returning to the view shows the completion screen, not word 10 again.
    const savedIndex = typeof saved.index === 'number' ? saved.index : 0;
    currentIndex = Math.min(Math.max(savedIndex, 0), words.length);
  } else {
    words = [];
  }

  // No valid saved batch -> create a fresh one.
  if (words.length === 0) {
    startNewBatch();
  }

  isFlipped = false;

  if (words.length === 0) {
    renderEmpty();
  } else {
    renderCard();
  }
}

/**
 * Destroy the flashcard view and clean up resources.
 */
export function destroy() {
  speechModule.stopRecognition();
  const modal = document.getElementById('write-modal');
  if (modal) modal.remove();
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  words = [];
  currentIndex = 0;
  isFlipped = false;
  isRecording = false;
}

/**
 * Render empty state when no words are available.
 */
function renderEmpty() {
  if (!container) return;
  container.innerHTML = `
    <section class="view flashcard-view" aria-label="Thẻ từ vựng">
      <h2>Thẻ từ vựng</h2>
      <div class="flashcard-container">
        <p class="empty-message">Chưa có từ vựng nào. Hãy nhập dữ liệu trước.</p>
        <a href="#import" class="btn btn-primary" role="button">Nhập dữ liệu</a>
      </div>
    </section>
  `;
}

/**
 * Render the current flashcard.
 */
function renderCard() {
  if (!container) return;

  const word = words[currentIndex];
  if (!word) {
    renderSessionComplete();
    return;
  }

  // "Đã nhớ" is always available now — pronunciation check via mic was too
  // unreliable, so we let the user decide when they've learned the word.
  const progressPercent = ((currentIndex) / words.length) * 100;

  container.innerHTML = `
    <section class="view flashcard-view" aria-label="Thẻ từ vựng">
      <h2>Thẻ từ vựng</h2>

      <div class="flashcard-progress" role="progressbar" aria-valuenow="${progressPercent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ phiên học">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-row">
          <span class="progress-text">Từ ${currentIndex + 1} / ${words.length}</span>
          <button class="btn btn-text btn-change-batch" id="btn-change-batch" aria-label="Đổi cụm từ khác" title="Đổi sang 10 từ khác">
            🔀 Đổi cụm khác
          </button>
        </div>
      </div>

      <div class="flashcard-container">
        <div class="flashcard ${isFlipped ? 'flipped' : ''}" role="button" tabindex="0" aria-label="${isFlipped ? 'Mặt sau thẻ' : 'Nhấn để lật thẻ'}" id="flashcard">
          <div class="flashcard-front">
            <div class="word-display">
              <h3 class="word-text">${word.word}</h3>
              ${word.pronunciation ? `<span class="pronunciation-ipa">${word.pronunciation}</span>` : ''}
            </div>
            <p class="flip-hint">Nhấn để xem nghĩa</p>
          </div>
          <div class="flashcard-back">
            <div class="meaning-display">
              <h3 class="meaning-text">${word.meaning}</h3>
              ${word.examples && word.examples.length > 0
                ? `<div class="examples">
                    <p class="example-label">Ví dụ:</p>
                    <ul>${word.examples.map(ex => `<li>${ex}</li>`).join('')}</ul>
                  </div>`
                : ''}
              ${word.memoryTip ? `<p class="memory-tip"><em>Mẹo: ${word.memoryTip}</em></p>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="flashcard-actions">
        <div class="speech-actions">
          <button class="btn btn-icon btn-speaker" id="btn-speak" aria-label="Nghe phát âm" title="Nghe phát âm">
            🔊
          </button>
          <button class="btn btn-icon btn-mic ${isRecording ? 'recording' : ''}" id="btn-mic" aria-label="Ghi âm phát âm" title="Ghi âm phát âm của bạn">
            🎤
          </button>
          <button class="btn btn-icon btn-write" id="btn-write" aria-label="Tập viết từ" title="Tập viết từ">
            ✍️
          </button>
        </div>
        <div class="pronunciation-result" id="pronunciation-result" aria-live="polite">${lastResultHtml}</div>
        <div class="memory-actions" ${!isFlipped ? 'style="display:none"' : ''}>
          <button class="btn btn-success btn-remembered" id="btn-remembered" aria-label="Đã nhớ">
            Đã nhớ
          </button>
          <button class="btn btn-danger btn-not-remembered" id="btn-not-remembered" aria-label="Chưa nhớ">
            Chưa nhớ
          </button>
        </div>
        <div class="nav-buttons">
          <button class="btn btn-secondary btn-prev" id="btn-prev" aria-label="Từ trước" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Trước
          </button>
          <button class="btn btn-secondary btn-next" id="btn-next" aria-label="Từ tiếp theo">
            Tiếp theo →
          </button>
        </div>
      </div>
    </section>
  `;

  setupCardListeners(word);
}

/**
 * Render session complete screen.
 */
function renderSessionComplete() {
  if (!container) return;
  // Keep the batch saved (with currentIndex === words.length so this screen
  // re-appears on return). The batch only changes when the user explicitly
  // chooses "Học 10 từ mới".
  saveSession();
  container.innerHTML = `
    <section class="view flashcard-view" aria-label="Hoàn thành phiên học">
      <h2>Thẻ từ vựng</h2>
      <div class="session-complete">
        <h3>🎉 Hoàn thành!</h3>
        <p>Bạn đã đi hết ${words.length} từ trong phiên này.</p>
        <button class="btn btn-primary" id="btn-match-review" aria-label="Ôn 10 từ này bằng Nối từ">🔗 Ôn bằng Nối từ</button>
        <button class="btn btn-primary" id="btn-restart" aria-label="Học 10 từ mới">Học 10 từ mới</button>
        <button class="btn btn-secondary" id="btn-review-again" aria-label="Lặp lại 10 từ này">Lặp lại 10 từ này</button>
        <a href="#dashboard" class="btn btn-secondary" role="button">Về trang chủ</a>
      </div>
    </section>
  `;

  // Hand the just-finished words to the matching game for reinforcement.
  const matchBtn = container.querySelector('#btn-match-review');
  if (matchBtn) {
    matchBtn.addEventListener('click', () => {
      try {
        localStorage.setItem('match_preset', JSON.stringify(words.map(w => w.id)));
      } catch (_) { /* ignore */ }
      window.location.hash = '#match';
    });
  }

  const restartBtn = container.querySelector('#btn-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      startNewBatch();
      renderCard();
    });
  }

  // Repeat the same 10 words again (keep the batch, restart from the top).
  const reviewBtn = container.querySelector('#btn-review-again');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      currentIndex = 0;
      isFlipped = false;
      lastResultHtml = '';
      saveSession();
      renderCard();
    });
  }
}

/**
 * Set up event listeners for the current card.
 * @param {object} word - Current vocabulary item
 */
function setupCardListeners(word) {
  const flashcard = container.querySelector('#flashcard');
  const speakBtn = container.querySelector('#btn-speak');
  const micBtn = container.querySelector('#btn-mic');
  const rememberedBtn = container.querySelector('#btn-remembered');
  const notRememberedBtn = container.querySelector('#btn-not-remembered');
  const nextBtn = container.querySelector('#btn-next');
  const prevBtn = container.querySelector('#btn-prev');
  const changeBatchBtn = container.querySelector('#btn-change-batch');
  const writeBtn = container.querySelector('#btn-write');

  // Write practice button
  if (writeBtn) {
    writeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openWritePopup(word);
    });
  }

  // Swap the whole 10-word batch for a new one (avoid repeating current words).
  if (changeBatchBtn) {
    changeBatchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentIds = words.map(w => w.id);
      startNewBatch(currentIds);
      renderCard();
    });
  }

  // Flip card on click
  if (flashcard) {
    flashcard.addEventListener('click', () => {
      handleFlip(word);
    });
    flashcard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFlip(word);
      }
    });
  }

  // Speaker button
  if (speakBtn) {
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSpeak(word);
    });
  }

  // Mic button
  if (micBtn) {
    micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleMic(word);
    });
  }

  // Remembered button
  if (rememberedBtn) {
    rememberedBtn.addEventListener('click', () => {
      memorySystem.markRemembered(word.id);
      moveToNext();
    });
  }

  // Not remembered button
  if (notRememberedBtn) {
    notRememberedBtn.addEventListener('click', () => {
      memorySystem.markNotRemembered(word.id);
      moveToNext();
    });
  }

  // Next button
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      moveToNext();
    });
  }

  // Previous button
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      moveToPrev();
    });
  }
}

/**
 * Handle card flip action.
 * @param {object} word - Current vocabulary item
 */
function handleFlip(word) {
  isFlipped = !isFlipped;

  if (isFlipped) {
    // Set meaningViewed in progress
    let progress = storageManager.getProgress(word.id);
    if (!progress) {
      progress = newProgress(word.id);
    }
    progress.meaningViewed = true;
    progress.updatedAt = new Date().toISOString();
    storageManager.saveProgress(word.id, progress);
  }

  renderCard();
}

/**
 * Handle pronunciation playback.
 * @param {object} word - Current vocabulary item
 */
async function handleSpeak(word) {
  // Start playback immediately so the button feels responsive.
  speechModule.speak(word.word).catch(() => {});

  // Mark as listened and refresh the card (does not block the audio above).
  try {
    let progress = storageManager.getProgress(word.id);
    if (!progress) {
      progress = newProgress(word.id);
    }
    progress.pronunciationListened = true;
    progress.updatedAt = new Date().toISOString();
    storageManager.saveProgress(word.id, progress);
    renderCard();
  } catch (err) {
    // Graceful degradation - do nothing on error
  }
}

/**
 * Handle microphone pronunciation validation.
 * @param {object} word - Current vocabulary item
 */
async function handleMic(word) {
  if (isRecording) return;
  isRecording = true;

  const resultEl = container.querySelector('#pronunciation-result');
  const micBtn = container.querySelector('#btn-mic');

  if (micBtn) micBtn.classList.add('recording');

  const setStatus = (status) => {
    if (!resultEl) return;
    if (status === 'loading-model') {
      resultEl.innerHTML = '<span class="result-info">Đang tải mô hình nhận diện (lần đầu, chờ chút)...</span>';
    } else if (status === 'listening') {
      resultEl.innerHTML = '<span class="result-info">🎤 Đang nghe... hãy đọc to, rõ.</span>';
    } else if (status === 'processing') {
      resultEl.innerHTML = '<span class="result-info">Đang xử lý...</span>';
    }
  };

  try {
    const result = await pronunciationValidator.startValidation(word.word, { onStatus: setStatus });
    memorySystem.recordPronunciationAttempt(word.id, result.passed);

    if (result.passed) {
      lastResultHtml = `<span class="result-pass">✓ PASS - Phát âm chính xác!</span>`;
    } else if (result.isClose) {
      lastResultHtml = `<span class="result-fail">✗ GẦN ĐÚNG - Bạn nói: "${result.recognizedText}". Thử lại rõ hơn nhé!</span>`;
    } else {
      lastResultHtml = `<span class="result-fail">✗ THỬ LẠI - Bạn nói: "${result.recognizedText}"</span>`;
    }
  } catch (err) {
    lastResultHtml = `<span class="result-error">${err.message}</span>`;
  } finally {
    isRecording = false;
    if (micBtn) micBtn.classList.remove('recording');
    // Re-render to update the "Đã nhớ" button state and remaining-steps hint
    renderCard();
  }
}

/**
 * Move to the next word in the session.
 */
function moveToNext() {
  currentIndex++;
  isFlipped = false;
  isRecording = false;
  lastResultHtml = '';
  saveSession();
  renderCard();
}

/**
 * Open a popup to practise writing the current word.
 * The user must type it correctly (case-insensitive) before they can close it
 * with a "pass". Wrong attempts show feedback and must be corrected.
 * @param {object} word
 */
function openWritePopup(word) {
  // Remove any existing popup.
  const existing = document.getElementById('write-modal');
  if (existing) existing.remove();

  const target = (word.word || '').trim();

  const overlay = document.createElement('div');
  overlay.className = 'write-modal-overlay';
  overlay.id = 'write-modal';
  overlay.innerHTML = `
    <div class="write-modal" role="dialog" aria-modal="true" aria-label="Tập viết từ">
      <button class="write-close" id="write-close" aria-label="Đóng">✕</button>
      <h3 class="write-title">Tập viết từ</h3>
      <p class="write-meaning">Nghĩa: <strong>${word.meaning || ''}</strong></p>
      ${word.pronunciation ? `<p class="write-ipa">${word.pronunciation}</p>` : ''}
      <div class="write-actions-top">
        <button class="btn btn-icon" id="write-hear" aria-label="Nghe phát âm" title="Nghe">🔊</button>
        <button class="btn btn-text" id="write-hint" aria-label="Gợi ý">💡 Gợi ý</button>
      </div>
      <input type="text" id="write-input" class="write-input" autocomplete="off"
        autocapitalize="off" spellcheck="false" placeholder="Gõ từ tiếng Anh..."
        aria-label="Ô nhập từ" />
      <div class="write-feedback" id="write-feedback" aria-live="polite"></div>
      <div class="write-buttons">
        <button class="btn btn-primary" id="write-check" aria-label="Kiểm tra">Kiểm tra</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#write-input');
  const feedback = overlay.querySelector('#write-feedback');
  const checkBtn = overlay.querySelector('#write-check');
  const closeBtn = overlay.querySelector('#write-close');
  const hearBtn = overlay.querySelector('#write-hear');
  const hintBtn = overlay.querySelector('#write-hint');

  let passed = false;

  const close = () => overlay.remove();

  const check = () => {
    if (passed) { close(); return; }
    const value = (input.value || '').trim();
    if (!value) return;

    if (value.toLowerCase() === target.toLowerCase()) {
      passed = true;
      feedback.innerHTML = `<span class="write-pass">✓ Chính xác! "${target}"</span>`;
      input.classList.remove('write-wrong');
      input.classList.add('write-correct');
      input.disabled = true;
      checkBtn.textContent = 'Xong';
      // Speak the word as positive reinforcement.
      speechModule.speak(target).catch(() => {});
    } else {
      // Show how far off they are and keep them trying.
      feedback.innerHTML = `<span class="write-fail">✗ Chưa đúng. Bạn viết: "${value}". Hãy thử lại cho đúng.</span>`;
      input.classList.add('write-wrong');
      input.focus();
      input.select();
    }
  };

  checkBtn.addEventListener('click', check);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); check(); }
    if (input.classList.contains('write-wrong')) {
      input.classList.remove('write-wrong');
    }
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function escClose(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
  });

  if (hearBtn) {
    hearBtn.addEventListener('click', () => speechModule.speak(target).catch(() => {}));
  }
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      // Reveal the first half of the word as a hint.
      const reveal = Math.ceil(target.length / 2);
      const masked = target.slice(0, reveal) + '•'.repeat(Math.max(target.length - reveal, 0));
      feedback.innerHTML = `<span class="write-hint-text">Gợi ý: ${masked} (${target.length} chữ cái)</span>`;
    });
  }

  setTimeout(() => input.focus(), 50);
}

/**
 * Move to the previous word in the session.
 */
function moveToPrev() {
  if (currentIndex === 0) return;
  currentIndex--;
  isFlipped = false;
  isRecording = false;
  lastResultHtml = '';
  saveSession();
  renderCard();
}
