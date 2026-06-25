/**
 * PronunciationValidator - Validates user pronunciation against target words.
 * Orchestrates speech recognition and compares recognized text with target.
 * Tracks attempt counts and first success dates via StorageManager.
 *
 * Matching strategy (works for ANY word, not a fixed list):
 *  1. Normalize both strings (lowercase, strip punctuation/diacritics).
 *  2. Exact match -> pass.
 *  3. Web Speech often returns a phrase ("base camp") or a homophone; we check
 *     each recognized token against the target and keep the best similarity.
 *  4. Fuzzy similarity via Levenshtein ratio handles near-misses
 *     (e.g. "base" vs "bass", "phone" vs "fone").
 *
 * Requirements: 15.3, 15.4, 15.5, 15.6
 */
import speechModule from './speech-module.js';
import storageManager from './storage-manager.js';

// Similarity at/above this ratio counts as a pass.
const PASS_THRESHOLD = 0.72;
// Similarity in this band is "close" - encourage the user to try again.
const CLOSE_THRESHOLD = 0.55;

class PronunciationValidator {
  /**
   * Normalize a string for comparison: lowercase, remove diacritics,
   * strip anything that is not a letter/number/space, collapse spaces.
   * @param {string} s
   * @returns {string}
   */
  normalize(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accent marks
      .replace(/[^a-z0-9\s']/g, ' ')   // keep letters, digits, apostrophes
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Levenshtein edit distance between two strings.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
      let curr = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,      // deletion
          curr[j - 1] + 1,  // insertion
          prev[j - 1] + cost // substitution
        );
      }
      prev = curr;
    }
    return prev[b.length];
  }

  /**
   * Similarity ratio in [0, 1] based on Levenshtein distance.
   * 1 = identical, 0 = completely different.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  similarity(a, b) {
    if (!a.length && !b.length) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - this.levenshtein(a, b) / maxLen;
  }

  /**
   * Compare recognized speech against the target word and return the best
   * similarity score. Handles multi-word recognition results by scoring the
   * whole phrase and each individual token, keeping the highest.
   * @param {string} targetWord
   * @param {string} recognizedText
   * @returns {number} best similarity in [0, 1]
   */
  bestSimilarity(targetWord, recognizedText) {
    const target = this.normalize(targetWord);
    const recognized = this.normalize(recognizedText);
    if (!target) return 0;

    // Whole-phrase comparison.
    let best = this.similarity(target, recognized);

    // Token-by-token: the API may return "base camp" when the user said "base".
    const tokens = recognized.split(' ').filter(Boolean);
    for (const token of tokens) {
      best = Math.max(best, this.similarity(target, token));
    }

    // If the target itself is multi-word, also compare against the joined form.
    if (target.includes(' ')) {
      best = Math.max(best, this.similarity(target.replace(/\s/g, ''), recognized.replace(/\s/g, '')));
    }

    return best;
  }

  /**
   * Calculate pronunciation score and human-friendly feedback.
   * @param {string} targetWord
   * @param {string} recognizedText
   * @returns {object} { score, passed, isExact, isClose, feedback }
   */
  calculateScore(targetWord, recognizedText) {
    const target = this.normalize(targetWord);
    const recognized = this.normalize(recognizedText);

    if (target && target === recognized) {
      return {
        score: 1,
        passed: true,
        isExact: true,
        isClose: false,
        feedback: 'Hoàn hảo! Phát âm chính xác.'
      };
    }

    const score = this.bestSimilarity(targetWord, recognizedText);

    if (score >= PASS_THRESHOLD) {
      return {
        score,
        passed: true,
        isExact: false,
        isClose: false,
        feedback: `Tốt! Phát âm của bạn khớp với "${(targetWord || '').trim()}".`
      };
    }

    if (score >= CLOSE_THRESHOLD) {
      return {
        score,
        passed: false,
        isExact: false,
        isClose: true,
        feedback: `Gần đúng. Bạn nói "${(recognizedText || '').trim()}", từ cần đọc là "${(targetWord || '').trim()}". Thử lại rõ hơn nhé.`
      };
    }

    return {
      score,
      passed: false,
      isExact: false,
      isClose: false,
      feedback: recognized
        ? `Chưa đúng. Bạn nói "${(recognizedText || '').trim()}" nhưng từ cần phát âm là "${(targetWord || '').trim()}".`
        : `Không nghe rõ. Vui lòng thử lại và phát âm từ "${(targetWord || '').trim()}".`
    };
  }

  /**
   * Validate recognized text against a target word.
   * @param {string} targetWord - The expected word
   * @param {string} recognizedText - The text recognized from speech
   * @returns {object} ValidationResult
   */
  validate(targetWord, recognizedText) {
    const result = this.calculateScore(targetWord, recognizedText);

    return {
      passed: result.passed,
      targetWord: (targetWord || '').trim(),
      recognizedText: (recognizedText || '').trim(),
      confidence: null,
      score: result.score,
      isExact: result.isExact,
      isClose: result.isClose,
      feedback: result.feedback
    };
  }

  /**
   * Start pronunciation validation by recording from the mic and transcribing
   * with Whisper, then validating the result against the target word.
   * @param {string} targetWord - The word the user should pronounce
   * @param {object} [options] - forwarded to speechModule.startRecognition
   *        (e.g. { onStatus, maxMs, silenceMs })
   * @returns {Promise<object>} ValidationResult
   */
  async startValidation(targetWord, options = {}) {
    try {
      const recognizedText = await speechModule.startRecognition(options);
      return this.validate(targetWord, recognizedText);
    } catch (error) {
      return {
        passed: false,
        targetWord: (targetWord || '').trim(),
        recognizedText: '',
        confidence: null,
        score: 0,
        isExact: false,
        isClose: false,
        feedback: error.message,
        error: error.message
      };
    }
  }

  /**
   * Get the number of pronunciation attempts for a vocabulary item.
   * @param {string} itemId - Vocabulary item ID
   * @returns {number} Number of pronunciation attempts
   */
  getAttemptCount(itemId) {
    const progress = storageManager.getProgress(itemId);
    if (!progress) return 0;
    return progress.pronunciationAttempts || 0;
  }

  /**
   * Get the date of first successful pronunciation for a vocabulary item.
   * @param {string} itemId - Vocabulary item ID
   * @returns {Date|null} Date of first success, or null if never succeeded
   */
  getFirstSuccessDate(itemId) {
    const progress = storageManager.getProgress(itemId);
    if (!progress || !progress.firstSuccessDate) return null;
    return new Date(progress.firstSuccessDate);
  }
}

// Export as singleton instance
const pronunciationValidator = new PronunciationValidator();
export default pronunciationValidator;
export { PronunciationValidator };
