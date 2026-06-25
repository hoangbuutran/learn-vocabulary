/**
 * SpeechModule - Handles text-to-speech pronunciation and speech recognition
 * using the Web Speech API. Provides graceful degradation when APIs are unavailable.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 15.1, 15.2
 */

class SpeechModule {
  constructor() {
    /** @type {'en-US' | 'en-GB'} */
    this._accent = 'en-US';
    /** @type {SpeechRecognition|null} */
    this._recognition = null;
    /** @type {boolean} */
    this._isRecognizing = false;
  }

  /**
   * Check if SpeechSynthesis API is available.
   * @returns {boolean}
   */
  _isSynthesisSupported() {
    return typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Check if SpeechRecognition API is available.
   * @returns {boolean}
   */
  isRecognitionSupported() {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Speak a word using Web Speech API SpeechSynthesis.
   * If SpeechSynthesis is not supported, resolves immediately without error.
   * @param {string} word - The word to speak
   * @param {'en-US' | 'en-GB'} [accent] - Optional accent override
   * @returns {Promise<void>}
   */
  speak(word, accent) {
    return new Promise((resolve, reject) => {
      if (!this._isSynthesisSupported()) {
        // Graceful degradation: resolve immediately if API unavailable
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(word);
      const lang = accent || this._accent;
      utterance.lang = lang;

      // Try to find a matching voice for the accent
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang === lang) ||
        voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        // Still resolve on error for graceful degradation
        if (event.error === 'canceled' || event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`Lỗi phát âm: ${event.error}`));
        }
      };

      // Cancel any ongoing speech before starting new one
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Set the accent for speech synthesis and recognition.
   * @param {'en-US' | 'en-GB'} accent
   */
  setAccent(accent) {
    if (accent === 'en-US' || accent === 'en-GB') {
      this._accent = accent;
    }
  }

  /**
   * Get available speech synthesis voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  getAvailableVoices() {
    if (!this._isSynthesisSupported()) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  /**
   * Start speech recognition and return a promise that resolves with
   * the recognized text.
   * If SpeechRecognition is not supported, rejects with a Vietnamese error message.
   * @returns {Promise<string>}
   */
  startRecognition() {
    return new Promise((resolve, reject) => {
      if (!this.isRecognitionSupported()) {
        reject(new Error('Trình duyệt không hỗ trợ nhận diện giọng nói'));
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this._recognition = new SpeechRecognition();
      this._recognition.lang = this._accent;
      this._recognition.interimResults = false;
      this._recognition.maxAlternatives = 1;
      this._recognition.continuous = false;

      this._isRecognizing = true;

      this._recognition.onresult = (event) => {
        this._isRecognizing = false;
        const result = event.results[0][0].transcript;
        resolve(result.trim());
      };

      this._recognition.onerror = (event) => {
        this._isRecognizing = false;
        if (event.error === 'aborted' || event.error === 'no-speech') {
          reject(new Error('Không nhận được giọng nói. Vui lòng thử lại.'));
        } else {
          reject(new Error(`Lỗi nhận diện giọng nói: ${event.error}`));
        }
      };

      this._recognition.onend = () => {
        this._isRecognizing = false;
      };

      this._recognition.start();
    });
  }

  /**
   * Stop any ongoing speech recognition.
   */
  stopRecognition() {
    if (this._recognition && this._isRecognizing) {
      this._recognition.abort();
      this._isRecognizing = false;
    }
  }
}

// Export as singleton instance
const speechModule = new SpeechModule();
export default speechModule;
export { SpeechModule };
