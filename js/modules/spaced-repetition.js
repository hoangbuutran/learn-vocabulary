/**
 * SpacedRepetitionEngine - Implements SM-2 spaced repetition algorithm.
 * Schedules vocabulary reviews based on recall performance.
 * All user-facing messages are in Vietnamese.
 */
import storageManager from './storage-manager.js';
import eventBus from '../utils/event-bus.js';

/**
 * Default progress record for an item that has no prior review history.
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

/**
 * Add days to a date and return an ISO date string (date only: YYYY-MM-DD).
 */
function addDays(date, days) {
  const result = new Date(date);
  const safeDays = (typeof days === 'number' && !isNaN(days)) ? days : 0;
  result.setDate(result.getDate() + safeDays);
  return result.toISOString().split('T')[0];
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
function getToday() {
  return new Date().toISOString().split('T')[0];
}

class SpacedRepetitionEngine {
  /**
   * Calculate the next review schedule for an item using the SM-2 algorithm.
   *
   * Quality mapping:
   *   - "Đã nhớ" (remembered) → quality = 4
   *   - "Chưa nhớ" (not remembered) → quality = 1
   *
   * @param {string} itemId - Vocabulary item ID
   * @param {number} quality - Quality of recall (0-5 scale)
   * @returns {object} ReviewSchedule { itemId, nextReviewDate, interval, easeFactor }
   */
  calculateNextReview(itemId, quality) {
    // Get current progress or create default
    let progress = storageManager.getProgress(itemId);
    if (!progress) {
      progress = createDefaultProgress(itemId);
    }

    // Defensive defaults: a progress record may have been created elsewhere
    // (e.g. flashcard view tracking meaningViewed) without SM-2 fields.
    let easeFactor = typeof progress.easeFactor === 'number' && !isNaN(progress.easeFactor)
      ? progress.easeFactor : 2.5;
    let interval = typeof progress.interval === 'number' && !isNaN(progress.interval)
      ? progress.interval : 0;
    let repetitions = typeof progress.repetitions === 'number' && !isNaN(progress.repetitions)
      ? progress.repetitions : 0;

    // SM-2 interval logic
    if (quality >= 3) {
      // Correct recall
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      // Incorrect recall — reset
      repetitions = 0;
      interval = 1;
    }

    // Update ease factor (SM-2 formula)
    easeFactor = easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    // Clamp minimum at 1.3
    easeFactor = Math.max(1.3, easeFactor);

    // Calculate next review date
    const today = getToday();
    const nextReviewDate = addDays(new Date(), interval);

    // Update progress record
    const updatedProgress = {
      ...progress,
      easeFactor,
      interval,
      repetitions,
      nextReviewDate,
      lastReviewDate: today,
      updatedAt: new Date().toISOString()
    };

    // Update status based on quality
    if (quality >= 3) {
      updatedProgress.status = 'remembered';
    } else {
      updatedProgress.status = 'not_remembered';
    }

    // Persist updated progress
    storageManager.saveProgress(itemId, updatedProgress);

    // Emit review:due event if there are items due
    eventBus.emit('review:due', { itemId, nextReviewDate, interval });

    return {
      itemId,
      nextReviewDate,
      interval,
      easeFactor
    };
  }

  /**
   * Get all vocabulary items that are due for review on or before the given date.
   * @param {Date} [date] - Date to check against (defaults to today)
   * @returns {Array} Array of VocabularyItem objects due for review
   */
  getItemsDueForReview(date) {
    const checkDate = date
      ? (date instanceof Date ? date.toISOString().split('T')[0] : date)
      : getToday();

    const allProgress = storageManager.getAllProgress();
    const allVocabulary = storageManager.getAllVocabulary();

    // Build a lookup map for vocabulary items
    const vocabMap = new Map();
    for (const item of allVocabulary) {
      vocabMap.set(item.id, item);
    }

    // Find items where nextReviewDate <= checkDate
    const dueItems = [];
    for (const [itemId, progress] of Object.entries(allProgress)) {
      if (progress.nextReviewDate && progress.nextReviewDate <= checkDate) {
        const vocabItem = vocabMap.get(itemId);
        if (vocabItem) {
          dueItems.push(vocabItem);
        }
      }
    }

    return dueItems;
  }

  /**
   * Get the complete review schedule for all items with progress records.
   * @returns {object} Map of itemId → ReviewSchedule
   */
  getReviewSchedule() {
    const allProgress = storageManager.getAllProgress();
    const schedule = {};

    for (const [itemId, progress] of Object.entries(allProgress)) {
      if (progress.nextReviewDate) {
        schedule[itemId] = {
          itemId,
          nextReviewDate: progress.nextReviewDate,
          interval: progress.interval,
          easeFactor: progress.easeFactor
        };
      }
    }

    return schedule;
  }

  /**
   * Reset the review interval for an item back to initial state.
   * Used when an item needs to be relearned from scratch.
   * @param {string} itemId - Vocabulary item ID
   */
  resetInterval(itemId) {
    let progress = storageManager.getProgress(itemId);
    if (!progress) {
      progress = createDefaultProgress(itemId);
    }

    const today = getToday();
    const updatedProgress = {
      ...progress,
      interval: 1,
      repetitions: 0,
      nextReviewDate: addDays(new Date(), 1),
      lastReviewDate: today,
      updatedAt: new Date().toISOString()
    };

    storageManager.saveProgress(itemId, updatedProgress);
  }

  /**
   * Manually increase the review interval for an item.
   * Applies the ease factor to the current interval.
   * @param {string} itemId - Vocabulary item ID
   */
  increaseInterval(itemId) {
    let progress = storageManager.getProgress(itemId);
    if (!progress) {
      progress = createDefaultProgress(itemId);
    }

    const currentInterval = progress.interval || 1;
    const easeFactor = progress.easeFactor || 2.5;
    const newInterval = Math.round(currentInterval * easeFactor);

    const updatedProgress = {
      ...progress,
      interval: newInterval,
      repetitions: (progress.repetitions || 0) + 1,
      nextReviewDate: addDays(new Date(), newInterval),
      lastReviewDate: getToday(),
      updatedAt: new Date().toISOString()
    };

    storageManager.saveProgress(itemId, updatedProgress);
  }
}

// Export as singleton
const spacedRepetitionEngine = new SpacedRepetitionEngine();
export default spacedRepetitionEngine;
export { SpacedRepetitionEngine, createDefaultProgress, addDays, getToday };
