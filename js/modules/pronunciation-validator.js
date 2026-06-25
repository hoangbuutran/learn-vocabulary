/**
 * PronunciationValidator - Validates user pronunciation against target words.
 * Orchestrates speech recognition and compares recognized text with target.
 * Tracks attempt counts and first success dates via StorageManager.
 *
 * Requirements: 15.3, 15.4, 15.5, 15.6
 */
import speechModule from './speech-module.js';
import storageManager from './storage-manager.js';

class PronunciationValidator {
  /**
   * Validate recognized text against a target word.
   * Performs case-insensitive, trimmed comparison.
   * @param {string} targetWord - The expected word
   * @param {string} recognizedText - The text recognized from speech
   * @returns {object} ValidationResult { passed, targetWord, recognizedText, confidence }
   */
  validate(targetWord, recognizedText) {
    const normalizedTarget = (targetWord || '').trim().toLowerCase();
    const normalizedRecognized = (recognizedText || '').trim().toLowerCase();

    const passed = normalizedTarget === normalizedRecognized;

    return {
      passed,
      targetWord: (targetWord || '').trim(),
      recognizedText: (recognizedText || '').trim(),
      confidence: null
    };
  }

  /**
   * Start pronunciation validation by initiating speech recognition
   * and then validating the result against the target word.
   * @param {string} targetWord - The word the user should pronounce
   * @returns {Promise<object>} ValidationResult
   */
  async startValidation(targetWord) {
    const recognizedText = await speechModule.startRecognition();
    return this.validate(targetWord, recognizedText);
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
