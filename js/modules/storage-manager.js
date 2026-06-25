/**
 * StorageManager - Manages all LocalStorage persistence for the vocabulary app.
 * Handles vocabulary data, progress records, settings, and data import/export.
 * All user-facing messages are in Vietnamese.
 */
import eventBus from '../utils/event-bus.js';
import { showWarning } from '../utils/helpers.js';

// LocalStorage keys
const KEYS = {
  VOCAB_ITEMS: 'vocab_items',
  VOCAB_PROGRESS: 'vocab_progress',
  APP_SETTINGS: 'app_settings',
  DAILY_SESSIONS: 'daily_sessions',
  DATA_LOADED: 'data_loaded',
  DATA_VERSION: 'data_version'
};

// Bump this whenever the bundled vocabulary data changes so existing users
// automatically get the new data on next load.
const DATA_VERSION = '2';

// Default application settings
const DEFAULT_SETTINGS = {
  theme: 'light',
  accent: 'en-US',
  dailyWordCount: 10,
  autoPlayPronunciation: false
};

class StorageManager {
  /**
   * Safely write to LocalStorage with QuotaExceededError handling.
   * @param {string} key - LocalStorage key
   * @param {*} value - Value to serialize and store
   * @returns {boolean} true if write succeeded
   */
  _safeSetItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        showWarning('Bộ nhớ trình duyệt đã đầy. Vui lòng xuất dữ liệu và xóa bớt dữ liệu cũ.');
      }
      return false;
    }
  }

  /**
   * Safely read from LocalStorage with JSON parse error handling.
   * @param {string} key - LocalStorage key
   * @param {*} defaultValue - Fallback value if key not found or parse fails
   * @returns {*} Parsed value or default
   */
  _safeGetItem(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  // --- Vocabulary Data ---

  /**
   * Get all vocabulary items from storage.
   * @returns {Array} Array of VocabularyItem objects
   */
  getAllVocabulary() {
    return this._safeGetItem(KEYS.VOCAB_ITEMS, []);
  }

  /**
   * Get vocabulary items filtered by category.
   * @param {string} category - Category to filter by
   * @returns {Array} Filtered array of VocabularyItem objects
   */
  getVocabularyByCategory(category) {
    const items = this.getAllVocabulary();
    return items.filter(item => item.category === category);
  }

  /**
   * Save vocabulary items to storage.
   * Emits 'vocab:imported' event on success.
   * @param {Array} items - Array of VocabularyItem objects
   */
  saveVocabulary(items) {
    const success = this._safeSetItem(KEYS.VOCAB_ITEMS, items);
    if (success) {
      eventBus.emit('vocab:imported', { count: items.length });
    }
  }

  // --- Progress Data ---

  /**
   * Get progress record for a specific item.
   * @param {string} itemId - Vocabulary item ID
   * @returns {object|null} ProgressRecord or null if not found
   */
  getProgress(itemId) {
    const allProgress = this._safeGetItem(KEYS.VOCAB_PROGRESS, {});
    return allProgress[itemId] || null;
  }

  /**
   * Get all progress records as a Map-like object.
   * @returns {object} Map of itemId → ProgressRecord
   */
  getAllProgress() {
    return this._safeGetItem(KEYS.VOCAB_PROGRESS, {});
  }

  /**
   * Save progress record for a specific item.
   * @param {string} itemId - Vocabulary item ID
   * @param {object} progress - ProgressRecord object
   */
  saveProgress(itemId, progress) {
    const allProgress = this._safeGetItem(KEYS.VOCAB_PROGRESS, {});
    allProgress[itemId] = progress;
    this._safeSetItem(KEYS.VOCAB_PROGRESS, allProgress);
  }

  // --- Settings ---

  /**
   * Get application settings. Returns defaults if none saved.
   * @returns {object} AppSettings object
   */
  getSettings() {
    const settings = this._safeGetItem(KEYS.APP_SETTINGS, null);
    if (!settings) {
      return { ...DEFAULT_SETTINGS };
    }
    // Merge with defaults to ensure all keys exist
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Save application settings.
   * Emits 'settings:changed' event on success.
   * @param {object} settings - AppSettings object
   */
  saveSettings(settings) {
    const success = this._safeSetItem(KEYS.APP_SETTINGS, settings);
    if (success) {
      eventBus.emit('settings:changed', settings);
    }
  }

  // --- First Run / Pre-Generated Data ---

  /**
   * Check if pre-generated data needs to be loaded.
   * Returns true on first run OR when the bundled data version has changed
   * (so existing users automatically receive updated vocabulary).
   * @returns {boolean}
   */
  isFirstRun() {
    const loaded = localStorage.getItem(KEYS.DATA_LOADED) === 'true';
    const version = localStorage.getItem(KEYS.DATA_VERSION);
    return !loaded || version !== DATA_VERSION;
  }

  /**
   * Load pre-generated vocabulary data from static JSON files.
   * Fetches /data/vocabulary-3000.json and /data/vocabulary-a1-a2.json,
   * then stores all items in LocalStorage.
   * @returns {Promise<void>}
   */
  async loadPreGeneratedData() {
    try {
      const [response3000, responseA1A2] = await Promise.all([
        fetch('data/vocabulary-3000.json'),
        fetch('data/vocabulary-a1-a2.json')
      ]);

      const allItems = [];

      if (response3000.ok) {
        const data3000 = await response3000.json();
        if (data3000.items && Array.isArray(data3000.items)) {
          allItems.push(...data3000.items);
        }
      }

      if (responseA1A2.ok) {
        const dataA1A2 = await responseA1A2.json();
        if (dataA1A2.items && Array.isArray(dataA1A2.items)) {
          allItems.push(...dataA1A2.items);
        }
      }

      if (allItems.length > 0) {
        this.saveVocabulary(allItems);
      }

      localStorage.setItem(KEYS.DATA_LOADED, 'true');
      localStorage.setItem(KEYS.DATA_VERSION, DATA_VERSION);
    } catch (error) {
      showWarning('Không thể tải dữ liệu từ vựng ban đầu. Bạn vẫn có thể nhập dữ liệu thủ công.');
    }
  }

  /**
   * Force a reload of the bundled vocabulary data, replacing the current
   * vocabulary. Progress and settings are preserved.
   * @returns {Promise<void>}
   */
  async reloadPreGeneratedData() {
    localStorage.removeItem(KEYS.DATA_LOADED);
    localStorage.removeItem(KEYS.DATA_VERSION);
    await this.loadPreGeneratedData();
  }

  // --- Export / Import ---

  /**
   * Export all app data as a structured ExportData object.
   * @returns {object} ExportData with version, exportedAt, vocabulary, progress, settings
   */
  exportAllData() {
    const vocabulary = this.getAllVocabulary();
    const progressMap = this.getAllProgress();
    const settings = this.getSettings();

    // Convert progress map to array for export
    const progress = Object.values(progressMap);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      vocabulary,
      progress,
      settings
    };
  }

  /**
   * Import data from an ExportData object.
   * Validates structure before importing. Does not corrupt existing data on failure.
   * @param {object} data - ExportData object
   * @returns {object} ImportResult with success, importedCount, errors, warnings
   */
  importData(data) {
    const errors = [];
    const warnings = [];

    // Validate top-level structure
    if (!data || typeof data !== 'object') {
      errors.push({ line: 0, message: 'Dữ liệu không hợp lệ: không phải đối tượng JSON' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    if (!data.version) {
      warnings.push('Không tìm thấy thông tin phiên bản, sẽ thử nhập dữ liệu.');
    }

    // Validate vocabulary array
    if (!Array.isArray(data.vocabulary)) {
      errors.push({ line: 0, message: 'Dữ liệu không hợp lệ: thiếu danh sách từ vựng (vocabulary)' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    // Validate each vocabulary item (basic validation)
    const validItems = [];
    for (let i = 0; i < data.vocabulary.length; i++) {
      const item = data.vocabulary[i];
      if (!item.word || !item.meaning) {
        errors.push({ line: i + 1, message: `Mục ${i + 1}: thiếu từ (word) hoặc nghĩa (meaning)` });
        continue;
      }
      validItems.push(item);
    }

    if (validItems.length === 0 && data.vocabulary.length > 0) {
      errors.push({ line: 0, message: 'Không có mục từ vựng hợp lệ nào để nhập' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    // Import vocabulary
    if (validItems.length > 0) {
      this.saveVocabulary(validItems);
    }

    // Import progress if present
    if (Array.isArray(data.progress)) {
      const progressMap = {};
      for (const record of data.progress) {
        if (record.itemId) {
          progressMap[record.itemId] = record;
        }
      }
      this._safeSetItem(KEYS.VOCAB_PROGRESS, progressMap);
    }

    // Import settings if present
    if (data.settings && typeof data.settings === 'object') {
      this.saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    }

    return {
      success: true,
      importedCount: validItems.length,
      errors,
      warnings
    };
  }
}

// Export as singleton
const storageManager = new StorageManager();
export default storageManager;
export { StorageManager, DEFAULT_SETTINGS, KEYS };
