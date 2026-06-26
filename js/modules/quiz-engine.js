/**
 * QuizEngine - Generates quizzes and manages quiz sessions.
 * Supports multiple quiz types:
 *  - 'meaning_to_word': show meaning, pick the English word
 *  - 'word_to_meaning': show word, pick the Vietnamese meaning
 *  - 'listen_choose':   hear the word, pick it from options
 *  - 'listen_type':     hear the word, type it
 * All user-facing messages are in Vietnamese.
 */
import storageManager from './storage-manager.js';
import { generateId } from '../utils/helpers.js';

/**
 * @typedef {'meaning_to_word' | 'word_to_meaning' | 'listen_choose' | 'listen_type'} QuizType
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} id
 * @property {QuizType} type
 * @property {string} prompt
 * @property {string} [audioWord] - word to speak aloud (listening questions)
 * @property {string} correctAnswer
 * @property {string[]} options
 * @property {string} targetItemId
 */

/**
 * @typedef {Object} QuizSession
 * @property {string} id
 * @property {QuizType} type
 * @property {QuizQuestion[]} questions
 * @property {number} currentIndex
 * @property {Array<{questionId: string, selected: string, correct: boolean}>} answers
 * @property {string} startedAt
 */

/**
 * @typedef {Object} QuizResult
 * @property {number} totalQuestions
 * @property {number} correctAnswers
 * @property {number} percentage
 * @property {string} completedAt
 */

/**
 * @typedef {Object} AnswerResult
 * @property {boolean} correct
 * @property {string} correctAnswer
 * @property {string} selectedAnswer
 */

class QuizEngine {
  constructor() {
    /** @type {QuizSession|null} */
    this.currentSession = null;
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm.
   * @param {Array} array
   * @returns {Array} The shuffled array
   */
  _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Generate quiz questions from the vocabulary list.
   * @param {QuizType} type
   * @param {number} count - Number of questions to generate
   * @returns {QuizQuestion[]} Array of quiz questions, empty if fewer than 4 vocab items
   */
  generateQuiz(type, count) {
    const vocabulary = storageManager.getActiveVocabulary();

    // Need at least 4 items to generate distractors
    if (vocabulary.length < 4) {
      return [];
    }

    // Store current type for generateDistractors to use
    this._currentType = type;

    // Select random items for questions (up to count)
    const selectedItems = this._shuffle(vocabulary).slice(0, count);

    return selectedItems.map(item => {
      const correctAnswer =
        type === 'word_to_meaning' ? item.meaning : item.word;

      // Listening - type the word: no options, just hear and type.
      if (type === 'listen_type') {
        return {
          id: generateId(),
          type,
          prompt: 'Nghe và gõ lại từ bạn nghe được',
          audioWord: item.word,
          meaning: item.meaning,
          correctAnswer: item.word,
          options: [],
          targetItemId: item.id
        };
      }

      // Listening - choose the word: hear it, pick from English words.
      if (type === 'listen_choose') {
        const distractors = this.generateDistractors(item, 3);
        const options = this._shuffle([item.word, ...distractors]);
        return {
          id: generateId(),
          type,
          prompt: 'Nghe và chọn từ đúng',
          audioWord: item.word,
          meaning: item.meaning,
          correctAnswer: item.word,
          options,
          targetItemId: item.id
        };
      }

      // Text-based multiple choice (original behaviour).
      const distractors = this.generateDistractors(item, 3);
      const options = this._shuffle([correctAnswer, ...distractors]);
      const prompt = type === 'word_to_meaning' ? item.word : item.meaning;

      return {
        id: generateId(),
        type,
        prompt,
        correctAnswer,
        options,
        targetItemId: item.id
      };
    });
  }

  /**
   * Generate distractor options for a quiz question.
   * Picks random incorrect options from the vocabulary list.
   * Uses _currentType to determine whether to return words or meanings.
   * - word_to_meaning: distractors are Vietnamese meanings
   * - meaning_to_word: distractors are English words
   * @param {Object} correctItem - The correct VocabularyItem
   * @param {number} count - Number of distractors to generate (typically 3)
   * @returns {string[]} Array of distractor strings
   */
  generateDistractors(correctItem, count) {
    const vocabulary = storageManager.getActiveVocabulary();
    const others = vocabulary.filter(item => item.id !== correctItem.id);
    const shuffled = this._shuffle(others);
    const selected = shuffled.slice(0, count);

    // These types need English-word distractors; word_to_meaning needs meanings.
    if (this._currentType === 'meaning_to_word' || this._currentType === 'listen_choose') {
      return selected.map(item => item.word);
    }
    return selected.map(item => item.meaning);
  }

  /**
   * Start a new quiz session.
   * @param {QuizType} type - 'meaning_to_word' or 'word_to_meaning'
   * @param {number} [count=10] - Number of questions
   * @returns {QuizSession} The created session
   */
  startSession(type, count = 10) {
    this._currentType = type;
    const questions = this.generateQuiz(type, count);

    this.currentSession = {
      id: generateId(),
      type,
      questions,
      currentIndex: 0,
      answers: [],
      startedAt: new Date().toISOString()
    };

    return this.currentSession;
  }

  /**
   * Submit an answer for a question in the current session.
   * @param {string} questionId - ID of the question being answered
   * @param {string} answer - The user's selected answer
   * @returns {AnswerResult} Result indicating if the answer was correct
   */
  submitAnswer(questionId, answer) {
    if (!this.currentSession) {
      throw new Error('Không có phiên trắc nghiệm nào đang hoạt động.');
    }

    const question = this.currentSession.questions.find(q => q.id === questionId);
    if (!question) {
      throw new Error('Không tìm thấy câu hỏi.');
    }

    // Typed answers: compare case-insensitively, ignoring surrounding spaces.
    let correct;
    if (question.type === 'listen_type') {
      const norm = (s) => (s || '').trim().toLowerCase();
      correct = norm(answer) === norm(question.correctAnswer);
    } else {
      correct = answer === question.correctAnswer;
    }

    this.currentSession.answers.push({
      questionId,
      selected: answer,
      correct
    });

    this.currentSession.currentIndex = this.currentSession.answers.length;

    return {
      correct,
      correctAnswer: question.correctAnswer,
      selectedAnswer: answer
    };
  }

  /**
   * End the current quiz session and calculate final score.
   * @returns {QuizResult} Final quiz results with score and percentage
   */
  endSession() {
    if (!this.currentSession) {
      throw new Error('Không có phiên trắc nghiệm nào đang hoạt động.');
    }

    const totalQuestions = this.currentSession.questions.length;
    const correctAnswers = this.currentSession.answers.filter(a => a.correct).length;
    const percentage = totalQuestions > 0
      ? (correctAnswers / totalQuestions) * 100
      : 0;

    const result = {
      totalQuestions,
      correctAnswers,
      percentage,
      completedAt: new Date().toISOString()
    };

    this.currentSession = null;
    this._currentType = null;

    return result;
  }
}

// Export as singleton
const quizEngine = new QuizEngine();
export default quizEngine;
export { QuizEngine };
