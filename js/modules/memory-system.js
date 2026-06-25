/**
 * MemorySystem - Tracks learning progress, manages study sessions,
 * pronunciation validation state, and completion gates.
 * Emits 'progress:updated' events via EventBus on status changes.
 */
import storageManager from './storage-manager.js';
import spacedRepetitionEngine from './spaced-repetition.js';
import eventBus from '../utils/event-bus.js';

/**
 * Create a default progress record for a vocabulary item.
 * @param {string} itemId
 * @returns {object} ProgressRecord
 */
function createDefaultProgress(itemId) {
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

class MemorySystem {
  /**
   * Mark a vocabulary item as remembered.
   * Delegates to SpacedRepetitionEngine with quality=4.
   * Emits 'progress:updated' event.
   * @param {string} itemId
   */
  markRemembered(itemId) {
    spacedRepetitionEngine.calculateNextReview(itemId, 4);
    eventBus.emit('progress:updated', { itemId, status: 'remembered' });
  }

  /**
   * Mark a vocabulary item as not remembered.
   * Delegates to SpacedRepetitionEngine with quality=1.
   * Emits 'progress:updated' event.
   * @param {string} itemId
   */
  markNotRemembered(itemId) {
    spacedRepetitionEngine.calculateNextReview(itemId, 1);
    eventBus.emit('progress:updated', { itemId, status: 'not_remembered' });
  }

  /**
   * Get the learning status of a vocabulary item.
   * @param {string} itemId
   * @returns {string} 'not_studied' | 'remembered' | 'not_remembered'
   */
  getStatus(itemId) {
    const progress = storageManager.getProgress(itemId);
    if (!progress) return 'not_studied';
    return progress.status || 'not_studied';
  }

  /**
   * Get aggregate learning statistics.
   * @returns {object} LearningStats { total, studied, remembered, notRemembered, progressPercentage }
   */
  getStats() {
    const allVocabulary = storageManager.getAllVocabulary();
    const allProgress = storageManager.getAllProgress();

    const total = allVocabulary.length;
    let remembered = 0;
    let notRemembered = 0;

    for (const item of allVocabulary) {
      const progress = allProgress[item.id];
      if (progress) {
        if (progress.status === 'remembered') {
          remembered++;
        } else if (progress.status === 'not_remembered') {
          notRemembered++;
        }
      }
    }

    const studied = remembered + notRemembered;
    const progressPercentage = total > 0 ? (remembered / total) * 100 : 0;

    return {
      total,
      studied,
      remembered,
      notRemembered,
      progressPercentage
    };
  }

  /**
   * Get daily progress summary.
   * @returns {object} DailyStats
   */
  getDailyProgress() {
    const today = new Date().toISOString().split('T')[0];
    const allProgress = storageManager.getAllProgress();

    let studiedToday = 0;
    let rememberedToday = 0;

    for (const progress of Object.values(allProgress)) {
      if (progress.lastReviewDate === today) {
        studiedToday++;
        if (progress.status === 'remembered') {
          rememberedToday++;
        }
      }
    }

    return {
      date: today,
      studiedToday,
      rememberedToday
    };
  }

  /**
   * Get words for study with bias toward not-remembered words.
   * Not-remembered words appear with higher frequency.
   * @param {number} count - Number of words to return
   * @returns {Array} Array of VocabularyItem objects
   */
  getWordsForStudy(count) {
    const allVocabulary = storageManager.getAllVocabulary();
    const allProgress = storageManager.getAllProgress();

    if (allVocabulary.length === 0) return [];

    // Separate items by status
    const notRememberedItems = [];
    const notStudiedItems = [];
    const rememberedItems = [];

    for (const item of allVocabulary) {
      const progress = allProgress[item.id];
      if (!progress || progress.status === 'not_studied') {
        notStudiedItems.push(item);
      } else if (progress.status === 'not_remembered') {
        notRememberedItems.push(item);
      } else {
        rememberedItems.push(item);
      }
    }

    // Bias: not-remembered items get 3x weight, not-studied get 2x, remembered get 1x
    const weighted = [];
    for (const item of notRememberedItems) {
      weighted.push(item, item, item);
    }
    for (const item of notStudiedItems) {
      weighted.push(item, item);
    }
    for (const item of rememberedItems) {
      weighted.push(item);
    }

    if (weighted.length === 0) return [];

    // Shuffle and pick unique items up to count
    const shuffled = this._shuffle(weighted);
    const selected = [];
    const selectedIds = new Set();

    for (const item of shuffled) {
      if (selectedIds.has(item.id)) continue;
      selectedIds.add(item.id);
      selected.push(item);
      if (selected.length >= count) break;
    }

    return selected;
  }

  /**
   * Get words due for review (delegates to SpacedRepetitionEngine).
   * @returns {Array} Array of VocabularyItem objects due for review
   */
  getWordsForReview() {
    return spacedRepetitionEngine.getItemsDueForReview();
  }

  /**
   * Get or assign daily words for a specific date.
   * Assigns up to dailyWordCount new unassigned words per day.
   * Persists assignments to 'daily_sessions' in LocalStorage.
   * @param {string} date - ISO date string (YYYY-MM-DD)
   * @returns {Array} Array of VocabularyItem objects for the day
   */
  getDailyWords(date) {
    const settings = storageManager.getSettings();
    const dailyWordCount = settings.dailyWordCount || 10;

    // Load existing daily sessions
    const dailySessions = this._getDailySessions();

    // If this date already has an assignment, return those items
    if (dailySessions[date] && dailySessions[date].length > 0) {
      return this._getItemsByIds(dailySessions[date]);
    }

    // Find unassigned words (items not yet assigned to any daily session)
    const allVocabulary = storageManager.getAllVocabulary();
    const allProgress = storageManager.getAllProgress();
    const assignedIds = new Set();

    for (const ids of Object.values(dailySessions)) {
      for (const id of ids) {
        assignedIds.add(id);
      }
    }

    const unassigned = allVocabulary.filter(item => {
      // Not assigned via daily sessions and not already assigned in progress
      if (assignedIds.has(item.id)) return false;
      const progress = allProgress[item.id];
      if (progress && progress.assignedDay) return false;
      return true;
    });

    // Take up to dailyWordCount items
    const toAssign = unassigned.slice(0, dailyWordCount);
    const assignedItemIds = toAssign.map(item => item.id);

    // Persist the daily session
    dailySessions[date] = assignedItemIds;
    this._saveDailySessions(dailySessions);

    // Update progress records with assignedDay
    for (const itemId of assignedItemIds) {
      let progress = storageManager.getProgress(itemId);
      if (!progress) {
        progress = createDefaultProgress(itemId);
      }
      progress.assignedDay = date;
      progress.updatedAt = new Date().toISOString();
      storageManager.saveProgress(itemId, progress);
    }

    return toAssign;
  }

  /**
   * Record a pronunciation attempt for an item.
   * Increments attempts, sets firstSuccessDate on first success,
   * sets pronunciationPassed=true on success.
   * Emits 'progress:updated' event.
   * @param {string} itemId
   * @param {boolean} success - Whether the attempt was successful
   */
  recordPronunciationAttempt(itemId, success) {
    let progress = storageManager.getProgress(itemId);
    if (!progress) {
      progress = createDefaultProgress(itemId);
    }

    progress.pronunciationAttempts = (progress.pronunciationAttempts || 0) + 1;
    progress.lastPronunciationDate = new Date().toISOString().split('T')[0];

    if (success) {
      if (!progress.firstSuccessDate) {
        progress.firstSuccessDate = new Date().toISOString();
      }
      progress.pronunciationPassed = true;
    }

    progress.updatedAt = new Date().toISOString();
    storageManager.saveProgress(itemId, progress);

    eventBus.emit('progress:updated', { itemId, pronunciationPassed: progress.pronunciationPassed });
  }

  /**
   * Check if pronunciation has been passed for an item.
   * @param {string} itemId
   * @returns {boolean}
   */
  isPronunciationPassed(itemId) {
    const progress = storageManager.getProgress(itemId);
    if (!progress) return false;
    return progress.pronunciationPassed === true;
  }

  /**
   * Check if an item can be marked as completed.
   * Requires: meaningViewed AND pronunciationListened AND pronunciationPassed.
   * @param {string} itemId
   * @returns {boolean}
   */
  canMarkAsCompleted(itemId) {
    const progress = storageManager.getProgress(itemId);
    if (!progress) return false;
    return (
      progress.meaningViewed === true &&
      progress.pronunciationListened === true &&
      progress.pronunciationPassed === true
    );
  }

  // --- Private helpers ---

  /**
   * Get daily sessions from LocalStorage.
   * @returns {object} Map of date → itemId[]
   */
  _getDailySessions() {
    try {
      const raw = localStorage.getItem('daily_sessions');
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Save daily sessions to LocalStorage.
   * @param {object} sessions - Map of date → itemId[]
   */
  _saveDailySessions(sessions) {
    try {
      localStorage.setItem('daily_sessions', JSON.stringify(sessions));
    } catch {
      // Silently fail on quota exceeded
    }
  }

  /**
   * Get vocabulary items by their IDs.
   * @param {string[]} ids
   * @returns {Array} VocabularyItem objects
   */
  _getItemsByIds(ids) {
    const allVocabulary = storageManager.getAllVocabulary();
    const vocabMap = new Map();
    for (const item of allVocabulary) {
      vocabMap.set(item.id, item);
    }
    return ids.map(id => vocabMap.get(id)).filter(Boolean);
  }

  /**
   * Fisher-Yates shuffle.
   * @param {Array} array
   * @returns {Array} Shuffled copy
   */
  _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Export as singleton
const memorySystem = new MemorySystem();
export default memorySystem;
export { MemorySystem, createDefaultProgress };
