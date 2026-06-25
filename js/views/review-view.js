/**
 * ReviewView - Spaced repetition review session interface.
 * Shows items due for review with flashcard-like interface,
 * pronunciation playback and validation.
 * Requirements: 11.4, 15.1, 15.7
 */
import spacedRepetitionEngine from '../modules/spaced-repetition.js';
import memorySystem from '../modules/memory-system.js';
import speechModule from '../modules/speech-module.js';
import pronunciationValidator from '../modules/pronunciation-validator.js';
import storageManager from '../modules/storage-manager.js';

let container = null;

/** Review session state */
let reviewItems = [];
let currentIndex = 0;
let isFlipped = false;
let isRecording = false;

/**
 * Render the review view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  reviewItems = spacedRepetitionEngine.getItemsDueForReview();
  currentIndex = 0;
  isFlipped = false;
  isRecording = false;

  if (reviewItems.length === 0) {
    renderNoDue();
  } else {
    renderReviewCard();
  }
}

/**
 * Destroy the review view and clean up resources.
 */
export function destroy() {
  speechModule.stopRecognition();
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  reviewItems = [];
  currentIndex = 0;
  isFlipped = false;
  isRecording = false;
}

/**
 * Render the "no items due" state.
 */
function renderNoDue() {
  if (!container) return;

  container.innerHTML = `
    <section class="view review-view" aria-label="Ôn tập">
      <h2>Ôn tập</h2>
      <div class="review-empty">
        <p class="congratulations-message">🎉 Chúc mừng! Không có từ nào cần ôn tập.</p>
        <a href="#dashboard" class="btn btn-secondary" role="button">Về trang chủ</a>
      </div>
    </section>
  `;
}

/**
 * Render the current review card.
 */
function renderReviewCard() {
  if (!container) return;

  if (currentIndex >= reviewItems.length) {
    renderComplete();
    return;
  }

  const word = reviewItems[currentIndex];
  const total = reviewItems.length;

  container.innerHTML = `
    <section class="view review-view" aria-label="Ôn tập">
      <h2>Ôn tập</h2>

      <div class="review-progress" aria-label="Tiến độ ôn tập">
        <span class="review-count">Từ ${currentIndex + 1} / ${total}</span>
      </div>

      <div class="review-card-container">
        <div class="flashcard ${isFlipped ? 'flipped' : ''}" role="button" tabindex="0" aria-label="${isFlipped ? 'Mặt sau thẻ' : 'Nhấn để lật thẻ'}" id="review-card">
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
            </div>
          </div>
        </div>
      </div>

      <div class="review-actions">
        <div class="speech-actions">
          <button class="btn btn-icon btn-speaker" id="btn-speak" aria-label="Nghe phát âm" title="Nghe phát âm">
            🔊
          </button>
          <button class="btn btn-icon btn-mic ${isRecording ? 'recording' : ''}" id="btn-mic" aria-label="Ghi âm phát âm" title="Ghi âm phát âm của bạn">
            🎤
          </button>
        </div>
        <div class="pronunciation-result" id="pronunciation-result" aria-live="polite"></div>
        <div class="memory-actions" ${!isFlipped ? 'style="display:none"' : ''}>
          <button class="btn btn-success btn-remembered" id="btn-remembered" aria-label="Đã nhớ">
            Đã nhớ
          </button>
          <button class="btn btn-danger btn-not-remembered" id="btn-not-remembered" aria-label="Chưa nhớ">
            Chưa nhớ
          </button>
        </div>
      </div>
    </section>
  `;

  setupReviewListeners(word);
}

/**
 * Render the session complete state.
 */
function renderComplete() {
  if (!container) return;

  container.innerHTML = `
    <section class="view review-view" aria-label="Hoàn thành ôn tập">
      <h2>Ôn tập</h2>
      <div class="review-complete">
        <h3>🎉 Hoàn thành!</h3>
        <p>Bạn đã ôn tập xong <strong>${reviewItems.length}</strong> từ.</p>
        <a href="#dashboard" class="btn btn-primary" role="button">Về trang chủ</a>
      </div>
    </section>
  `;
}

/**
 * Set up event listeners for the current review card.
 * @param {object} word - Current vocabulary item
 */
function setupReviewListeners(word) {
  const card = container.querySelector('#review-card');
  const speakBtn = container.querySelector('#btn-speak');
  const micBtn = container.querySelector('#btn-mic');
  const rememberedBtn = container.querySelector('#btn-remembered');
  const notRememberedBtn = container.querySelector('#btn-not-remembered');

  // Flip card
  if (card) {
    card.addEventListener('click', () => handleFlip());
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFlip();
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
}

/**
 * Handle card flip.
 */
function handleFlip() {
  isFlipped = !isFlipped;
  renderReviewCard();
}

/**
 * Handle pronunciation playback.
 * @param {object} word - Current vocabulary item
 */
async function handleSpeak(word) {
  try {
    await speechModule.speak(word.word);
  } catch (err) {
    // Graceful degradation
  }
}

/**
 * Handle microphone pronunciation validation.
 * @param {object} word - Current vocabulary item
 */
async function handleMic(word) {
  if (isRecording) return;
  isRecording = true;

  const resultEl = container && container.querySelector('#pronunciation-result');
  const micBtn = container && container.querySelector('#btn-mic');

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

    if (resultEl) {
      if (result.passed) {
        resultEl.innerHTML = `<span class="result-pass">✓ PASS - Phát âm chính xác!</span>`;
      } else if (result.isClose) {
        resultEl.innerHTML = `<span class="result-fail">✗ GẦN ĐÚNG - Bạn nói: "${result.recognizedText}". Thử lại rõ hơn nhé!</span>`;
      } else {
        resultEl.innerHTML = `<span class="result-fail">✗ THỬ LẠI - Bạn nói: "${result.recognizedText}"</span>`;
      }
    }
  } catch (err) {
    if (resultEl) {
      resultEl.innerHTML = `<span class="result-error">${err.message}</span>`;
    }
  } finally {
    isRecording = false;
    if (micBtn) micBtn.classList.remove('recording');
  }
}

/**
 * Move to the next review item.
 */
function moveToNext() {
  currentIndex++;
  isFlipped = false;
  isRecording = false;
  renderReviewCard();
}
