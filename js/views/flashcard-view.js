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
    currentIndex = Math.min(saved.index || 0, Math.max(words.length - 1, 0));
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

  const progress = storageManager.getProgress(word.id) || {};
  const recognitionSupported = speechModule.isRecognitionSupported();
  // Pronunciation via mic is only required when the browser supports it.
  const canComplete = recognitionSupported
    ? memorySystem.canMarkAsCompleted(word.id)
    : (progress.meaningViewed === true && progress.pronunciationListened === true);
  const progressPercent = ((currentIndex) / words.length) * 100;

  // Build a hint listing the remaining steps before "Đã nhớ" unlocks.
  const remainingSteps = [];
  if (!progress.meaningViewed) remainingSteps.push('xem nghĩa (lật thẻ)');
  if (!progress.pronunciationListened) remainingSteps.push('nghe phát âm (🔊)');
  if (recognitionSupported && !progress.pronunciationPassed) remainingSteps.push('phát âm đúng (🎤)');
  const completeHint = canComplete
    ? ''
    : `<p class="complete-hint">Để bật nút "Đã nhớ", hãy: ${remainingSteps.join(', ')}.</p>`;

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
        </div>
        <div class="pronunciation-result" id="pronunciation-result" aria-live="polite">${lastResultHtml}</div>
        ${completeHint}
        <div class="memory-actions" ${!isFlipped ? 'style="display:none"' : ''}>
          <button class="btn btn-success btn-remembered" id="btn-remembered" ${!canComplete ? 'disabled' : ''} aria-label="Đã nhớ">
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
  // The current batch is done — clear it so the next batch is a fresh 10 words.
  clearSession();
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
