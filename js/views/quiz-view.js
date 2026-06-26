/**
 * QuizView - Multiple choice quiz interface with type selection,
 * question display, scoring, and final results.
 * Includes listening modes (hear the word, choose or type it).
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import quizEngine from '../modules/quiz-engine.js';
import speechModule from '../modules/speech-module.js';

let container = null;

/** Quiz session state */
let session = null;
let currentQuestion = null;
let answered = false;
let selectedAnswer = null;

/**
 * Render the quiz view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  session = null;
  currentQuestion = null;
  answered = false;
  selectedAnswer = null;
  renderTypeSelection();
}

/**
 * Destroy the quiz view and clean up resources.
 */
export function destroy() {
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  session = null;
  currentQuestion = null;
  answered = false;
  selectedAnswer = null;
}

/**
 * Render quiz type selection screen.
 */
function renderTypeSelection() {
  if (!container) return;

  container.innerHTML = `
    <section class="view quiz-view" aria-label="Trắc nghiệm">
      <h2>Trắc nghiệm</h2>
      <div class="quiz-type-selection">
        <p class="quiz-instruction">Chọn loại trắc nghiệm:</p>
        <div class="quiz-type-buttons">
          <button class="btn btn-primary btn-quiz-type" id="btn-word-to-meaning" aria-label="Chọn nghĩa đúng">
            📖 Chọn nghĩa đúng
          </button>
          <button class="btn btn-primary btn-quiz-type" id="btn-meaning-to-word" aria-label="Chọn từ đúng">
            🔤 Chọn từ đúng
          </button>
          <button class="btn btn-primary btn-quiz-type" id="btn-listen-choose" aria-label="Nghe và chọn từ">
            🔊 Nghe và chọn từ
          </button>
          <button class="btn btn-primary btn-quiz-type" id="btn-listen-type" aria-label="Nghe và gõ từ">
            ⌨️ Nghe và gõ từ
          </button>
        </div>
        <p class="quiz-description">
          <strong>Chọn nghĩa đúng:</strong> Xem từ tiếng Anh, chọn nghĩa tiếng Việt đúng.<br>
          <strong>Chọn từ đúng:</strong> Xem nghĩa tiếng Việt, chọn từ tiếng Anh đúng.<br>
          <strong>Nghe và chọn từ:</strong> Nghe phát âm, chọn từ đúng trong các lựa chọn.<br>
          <strong>Nghe và gõ từ:</strong> Nghe phát âm, gõ lại từ bạn nghe được.
        </p>
      </div>
    </section>
  `;

  const wordToMeaningBtn = container.querySelector('#btn-word-to-meaning');
  const meaningToWordBtn = container.querySelector('#btn-meaning-to-word');
  const listenChooseBtn = container.querySelector('#btn-listen-choose');
  const listenTypeBtn = container.querySelector('#btn-listen-type');

  if (wordToMeaningBtn) {
    wordToMeaningBtn.addEventListener('click', () => startQuiz('word_to_meaning'));
  }
  if (meaningToWordBtn) {
    meaningToWordBtn.addEventListener('click', () => startQuiz('meaning_to_word'));
  }
  if (listenChooseBtn) {
    listenChooseBtn.addEventListener('click', () => startQuiz('listen_choose'));
  }
  if (listenTypeBtn) {
    listenTypeBtn.addEventListener('click', () => startQuiz('listen_type'));
  }
}

/**
 * Start a quiz session of the given type.
 * @param {string} type - 'word_to_meaning' or 'meaning_to_word'
 */
function startQuiz(type) {
  session = quizEngine.startSession(type, 10);

  if (!session || session.questions.length === 0) {
    renderNoQuestions();
    return;
  }

  answered = false;
  selectedAnswer = null;
  currentQuestion = session.questions[0];
  renderQuestion();
  maybeAutoPlay();
}

/**
 * Auto-play the word audio for listening questions.
 */
function maybeAutoPlay() {
  if (currentQuestion && currentQuestion.audioWord && !answered) {
    // Small delay so the view is painted before audio starts.
    setTimeout(() => {
      speechModule.speak(currentQuestion.audioWord).catch(() => {});
    }, 250);
  }
}

/**
 * Render a message when there aren't enough words for a quiz.
 */
function renderNoQuestions() {
  if (!container) return;

  container.innerHTML = `
    <section class="view quiz-view" aria-label="Trắc nghiệm">
      <h2>Trắc nghiệm</h2>
      <div class="quiz-container">
        <p class="empty-message">Cần ít nhất 4 từ vựng để tạo trắc nghiệm. Hãy nhập thêm dữ liệu.</p>
        <a href="#import" class="btn btn-primary" role="button">Nhập dữ liệu</a>
      </div>
    </section>
  `;
}

/**
 * Render the current question.
 */
function renderQuestion() {
  if (!container || !session || !currentQuestion) return;

  const questionNumber = session.currentIndex + 1;
  const totalQuestions = session.questions.length;
  const correctSoFar = session.answers.filter(a => a.correct).length;

  const isListening = !!currentQuestion.audioWord;
  const isTyping = currentQuestion.type === 'listen_type';

  // Question card: for listening modes, show a big replay button instead of text.
  const questionCardHtml = isListening
    ? `<div class="question-card question-card-listen" aria-label="Câu hỏi nghe">
         <button class="btn btn-replay-audio" id="btn-replay-audio" aria-label="Nghe lại">
           🔊 Nghe lại
         </button>
         <p class="listen-hint">${currentQuestion.prompt}</p>
       </div>`
    : `<div class="question-card" aria-label="Câu hỏi">
         <p class="question-prompt">${currentQuestion.prompt}</p>
       </div>`;

  // Answer area: typed input for listen_type, otherwise option buttons.
  let answerAreaHtml;
  if (isTyping) {
    answerAreaHtml = `
      <div class="type-answer">
        <input type="text" id="type-input" class="type-input" placeholder="Gõ từ bạn nghe được..."
          autocomplete="off" autocapitalize="off" spellcheck="false"
          aria-label="Gõ từ bạn nghe được" ${answered ? 'disabled' : ''}
          value="${answered && selectedAnswer ? selectedAnswer.replace(/"/g, '&quot;') : ''}" />
        ${!answered ? '<button class="btn btn-primary" id="btn-submit-typed" aria-label="Kiểm tra">Kiểm tra</button>' : ''}
      </div>`;
  } else {
    answerAreaHtml = `
      <div class="options-grid" role="group" aria-label="Các lựa chọn">
        ${currentQuestion.options.map((option, idx) => {
          let optionClass = 'btn-option';
          if (answered) {
            if (option === currentQuestion.correctAnswer) {
              optionClass += ' correct';
            } else if (option === selectedAnswer && option !== currentQuestion.correctAnswer) {
              optionClass += ' incorrect';
            }
          }
          return `<button class="btn ${optionClass}" data-option="${idx}" aria-label="Lựa chọn ${idx + 1}: ${option}" ${answered ? 'disabled' : ''}>
            ${option}
          </button>`;
        }).join('')}
      </div>`;
  }

  container.innerHTML = `
    <section class="view quiz-view" aria-label="Trắc nghiệm">
      <h2>Trắc nghiệm</h2>

      <div class="quiz-header">
        <span class="quiz-progress">Câu ${questionNumber} / ${totalQuestions}</span>
        <span class="quiz-score">Điểm: ${correctSoFar} / ${session.answers.length}</span>
      </div>

      <div class="quiz-container">
        ${questionCardHtml}

        ${answerAreaHtml}

        ${answered ? `
          <div class="quiz-feedback" aria-live="polite">
            ${selectedAnswer === currentQuestion.correctAnswer
              || (isTyping && (selectedAnswer || '').trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase())
              ? '<p class="feedback-correct">✓ Chính xác!</p>'
              : `<p class="feedback-incorrect">✗ Sai. Đáp án đúng: <strong>${currentQuestion.correctAnswer}</strong></p>`
            }
            <button class="btn btn-primary btn-next-question" id="btn-next-question" aria-label="Câu tiếp theo">
              ${questionNumber >= totalQuestions ? 'Xem kết quả' : 'Câu tiếp theo →'}
            </button>
          </div>
        ` : ''}
      </div>
    </section>
  `;

  setupQuestionListeners();
}

/**
 * Set up event listeners for the question view.
 */
function setupQuestionListeners() {
  if (!container) return;

  // Replay audio button (listening questions)
  const replayBtn = container.querySelector('#btn-replay-audio');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (currentQuestion && currentQuestion.audioWord) {
        speechModule.speak(currentQuestion.audioWord).catch(() => {});
      }
    });
  }

  // Option buttons
  if (!answered) {
    const optionBtns = container.querySelectorAll('.btn-option');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-option'), 10);
        handleAnswer(currentQuestion.options[idx]);
      });
    });
  }

  // Typed answer (listen_type)
  if (!answered) {
    const typeInput = container.querySelector('#type-input');
    const submitBtn = container.querySelector('#btn-submit-typed');
    const submitTyped = () => {
      const value = typeInput ? typeInput.value.trim() : '';
      if (!value) return;
      handleAnswer(value);
    };
    if (submitBtn) {
      submitBtn.addEventListener('click', submitTyped);
    }
    if (typeInput) {
      typeInput.focus();
      typeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTyped();
        }
      });
    }
  }

  // Next question button
  const nextBtn = container.querySelector('#btn-next-question');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      handleNextQuestion();
    });
  }
}

/**
 * Handle an answer selection.
 * @param {string} answer - The selected answer text
 */
function handleAnswer(answer) {
  if (answered) return;

  answered = true;
  selectedAnswer = answer;
  quizEngine.submitAnswer(currentQuestion.id, answer);

  // Re-render to show feedback
  renderQuestion();
}

/**
 * Handle moving to the next question or showing results.
 */
function handleNextQuestion() {
  if (!session) return;

  if (session.currentIndex >= session.questions.length) {
    // End of quiz
    renderResults();
    return;
  }

  currentQuestion = session.questions[session.currentIndex];
  answered = false;
  selectedAnswer = null;
  renderQuestion();
  maybeAutoPlay();
}

/**
 * Render the final quiz results.
 */
function renderResults() {
  if (!container || !session) return;

  const result = quizEngine.endSession();

  container.innerHTML = `
    <section class="view quiz-view" aria-label="Kết quả trắc nghiệm">
      <h2>Trắc nghiệm</h2>
      <div class="quiz-results">
        <h3>🏆 Kết quả</h3>
        <div class="results-stats">
          <div class="result-item">
            <span class="result-label">Số câu đúng:</span>
            <span class="result-value">${result.correctAnswers} / ${result.totalQuestions}</span>
          </div>
          <div class="result-item">
            <span class="result-label">Tỉ lệ:</span>
            <span class="result-value">${result.percentage.toFixed(1)}%</span>
          </div>
        </div>
        <div class="results-actions">
          <button class="btn btn-primary" id="btn-retry" aria-label="Làm lại">Làm lại</button>
          <a href="#dashboard" class="btn btn-secondary" role="button">Về trang chủ</a>
        </div>
      </div>
    </section>
  `;

  const retryBtn = container.querySelector('#btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      session = null;
      currentQuestion = null;
      answered = false;
      selectedAnswer = null;
      renderTypeSelection();
    });
  }
}
