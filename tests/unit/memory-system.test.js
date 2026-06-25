/**
 * Unit tests for MemorySystem
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemorySystem, createDefaultProgress } from '../../js/modules/memory-system.js';

// Mock storageManager
vi.mock('../../js/modules/storage-manager.js', () => {
  const progressStore = {};
  const vocabStore = [];
  const settingsStore = { theme: 'light', accent: 'en-US', dailyWordCount: 10, autoPlayPronunciation: false };
  return {
    default: {
      getProgress: vi.fn((itemId) => progressStore[itemId] || null),
      getAllProgress: vi.fn(() => ({ ...progressStore })),
      saveProgress: vi.fn((itemId, progress) => { progressStore[itemId] = progress; }),
      getAllVocabulary: vi.fn(() => [...vocabStore]),
      getSettings: vi.fn(() => ({ ...settingsStore })),
      _progressStore: progressStore,
      _vocabStore: vocabStore,
      _settingsStore: settingsStore,
      _reset: () => {
        Object.keys(progressStore).forEach(k => delete progressStore[k]);
        vocabStore.length = 0;
      }
    }
  };
});

// Mock spaced-repetition
vi.mock('../../js/modules/spaced-repetition.js', () => ({
  default: {
    calculateNextReview: vi.fn((itemId, quality) => {
      return { itemId, interval: 1, nextReviewDate: '2024-06-16', easeFactor: 2.5 };
    }),
    getItemsDueForReview: vi.fn(() => [])
  }
}));

// Mock eventBus
vi.mock('../../js/utils/event-bus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}));

import storageManager from '../../js/modules/storage-manager.js';
import spacedRepetitionEngine from '../../js/modules/spaced-repetition.js';
import eventBus from '../../js/utils/event-bus.js';

describe('MemorySystem', () => {
  let memorySystem;

  beforeEach(() => {
    memorySystem = new MemorySystem();
    storageManager._reset();
    vi.clearAllMocks();

    // Reset localStorage mock for daily sessions
    const localStorageMock = {
      store: {},
      getItem: vi.fn((key) => localStorageMock.store[key] || null),
      setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
      removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
      clear: vi.fn(() => { localStorageMock.store = {}; })
    };
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
  });

  describe('markRemembered', () => {
    it('should call spacedRepetitionEngine.calculateNextReview with quality=4', () => {
      memorySystem.markRemembered('item1');

      expect(spacedRepetitionEngine.calculateNextReview).toHaveBeenCalledWith('item1', 4);
    });

    it('should emit progress:updated event with remembered status', () => {
      memorySystem.markRemembered('item1');

      expect(eventBus.emit).toHaveBeenCalledWith('progress:updated', {
        itemId: 'item1',
        status: 'remembered'
      });
    });
  });

  describe('markNotRemembered', () => {
    it('should call spacedRepetitionEngine.calculateNextReview with quality=1', () => {
      memorySystem.markNotRemembered('item1');

      expect(spacedRepetitionEngine.calculateNextReview).toHaveBeenCalledWith('item1', 1);
    });

    it('should emit progress:updated event with not_remembered status', () => {
      memorySystem.markNotRemembered('item1');

      expect(eventBus.emit).toHaveBeenCalledWith('progress:updated', {
        itemId: 'item1',
        status: 'not_remembered'
      });
    });
  });

  describe('getStatus', () => {
    it('should return not_studied for item with no progress', () => {
      expect(memorySystem.getStatus('item1')).toBe('not_studied');
    });

    it('should return remembered for remembered item', () => {
      storageManager._progressStore['item1'] = { status: 'remembered' };
      expect(memorySystem.getStatus('item1')).toBe('remembered');
    });

    it('should return not_remembered for not-remembered item', () => {
      storageManager._progressStore['item1'] = { status: 'not_remembered' };
      expect(memorySystem.getStatus('item1')).toBe('not_remembered');
    });

    it('should return not_studied when status field is missing', () => {
      storageManager._progressStore['item1'] = { itemId: 'item1' };
      expect(memorySystem.getStatus('item1')).toBe('not_studied');
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no vocabulary exists', () => {
      const stats = memorySystem.getStats();

      expect(stats).toEqual({
        total: 0,
        studied: 0,
        remembered: 0,
        notRemembered: 0,
        progressPercentage: 0
      });
    });

    it('should correctly count remembered and not-remembered items', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello' },
        { id: 'item2', word: 'world' },
        { id: 'item3', word: 'test' },
        { id: 'item4', word: 'foo' }
      );
      storageManager._progressStore['item1'] = { status: 'remembered' };
      storageManager._progressStore['item2'] = { status: 'not_remembered' };
      storageManager._progressStore['item3'] = { status: 'remembered' };

      const stats = memorySystem.getStats();

      expect(stats.total).toBe(4);
      expect(stats.studied).toBe(3);
      expect(stats.remembered).toBe(2);
      expect(stats.notRemembered).toBe(1);
      expect(stats.progressPercentage).toBe(50); // 2/4 * 100
    });

    it('should calculate progressPercentage as (remembered / total) * 100', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' },
        { id: 'item4', word: 'd' },
        { id: 'item5', word: 'e' }
      );
      storageManager._progressStore['item1'] = { status: 'remembered' };
      storageManager._progressStore['item2'] = { status: 'remembered' };
      storageManager._progressStore['item3'] = { status: 'remembered' };

      const stats = memorySystem.getStats();
      expect(stats.progressPercentage).toBe(60); // 3/5 * 100
    });
  });

  describe('getWordsForStudy', () => {
    it('should return empty array when no vocabulary exists', () => {
      const result = memorySystem.getWordsForStudy(5);
      expect(result).toEqual([]);
    });

    it('should return at most count items', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' },
        { id: 'item4', word: 'd' },
        { id: 'item5', word: 'e' }
      );

      const result = memorySystem.getWordsForStudy(3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should return unique items (no duplicates)', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' }
      );

      const result = memorySystem.getWordsForStudy(3);
      const ids = result.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include items from vocabulary', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello' },
        { id: 'item2', word: 'world' }
      );

      const result = memorySystem.getWordsForStudy(2);
      expect(result.length).toBe(2);
      for (const item of result) {
        expect(['item1', 'item2']).toContain(item.id);
      }
    });
  });

  describe('getWordsForReview', () => {
    it('should delegate to spacedRepetitionEngine.getItemsDueForReview', () => {
      const mockItems = [{ id: 'item1', word: 'test' }];
      spacedRepetitionEngine.getItemsDueForReview.mockReturnValue(mockItems);

      const result = memorySystem.getWordsForReview();
      expect(result).toEqual(mockItems);
      expect(spacedRepetitionEngine.getItemsDueForReview).toHaveBeenCalled();
    });
  });

  describe('getDailyWords', () => {
    it('should assign up to dailyWordCount words for a new date', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' },
        { id: 'item4', word: 'd' },
        { id: 'item5', word: 'e' },
        { id: 'item6', word: 'f' },
        { id: 'item7', word: 'g' },
        { id: 'item8', word: 'h' },
        { id: 'item9', word: 'i' },
        { id: 'item10', word: 'j' },
        { id: 'item11', word: 'k' },
        { id: 'item12', word: 'l' }
      );

      const result = memorySystem.getDailyWords('2024-06-15');
      expect(result.length).toBe(10); // default dailyWordCount
    });

    it('should return the same words for the same date', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' }
      );

      const result1 = memorySystem.getDailyWords('2024-06-15');
      const result2 = memorySystem.getDailyWords('2024-06-15');

      expect(result1.map(i => i.id).sort()).toEqual(result2.map(i => i.id).sort());
    });

    it('should not assign same words to different dates', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' },
        { id: 'item4', word: 'd' },
        { id: 'item5', word: 'e' },
        { id: 'item6', word: 'f' },
        { id: 'item7', word: 'g' },
        { id: 'item8', word: 'h' },
        { id: 'item9', word: 'i' },
        { id: 'item10', word: 'j' },
        { id: 'item11', word: 'k' },
        { id: 'item12', word: 'l' },
        { id: 'item13', word: 'm' },
        { id: 'item14', word: 'n' },
        { id: 'item15', word: 'o' },
        { id: 'item16', word: 'p' },
        { id: 'item17', word: 'q' },
        { id: 'item18', word: 'r' },
        { id: 'item19', word: 's' },
        { id: 'item20', word: 't' }
      );

      const day1 = memorySystem.getDailyWords('2024-06-15');
      const day2 = memorySystem.getDailyWords('2024-06-16');

      const day1Ids = new Set(day1.map(i => i.id));
      const day2Ids = new Set(day2.map(i => i.id));

      // No overlap
      for (const id of day2Ids) {
        expect(day1Ids.has(id)).toBe(false);
      }
    });

    it('should persist daily session to localStorage', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' }
      );

      memorySystem.getDailyWords('2024-06-15');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'daily_sessions',
        expect.any(String)
      );
    });

    it('should return fewer words if not enough unassigned items exist', () => {
      storageManager._vocabStore.push(
        { id: 'item1', word: 'a' },
        { id: 'item2', word: 'b' },
        { id: 'item3', word: 'c' }
      );

      const result = memorySystem.getDailyWords('2024-06-15');
      expect(result.length).toBe(3); // Only 3 available, less than dailyWordCount=10
    });
  });

  describe('recordPronunciationAttempt', () => {
    it('should increment pronunciation attempts', () => {
      storageManager._progressStore['item1'] = createDefaultProgress('item1');

      memorySystem.recordPronunciationAttempt('item1', false);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ pronunciationAttempts: 1 })
      );
    });

    it('should set pronunciationPassed to true on success', () => {
      storageManager._progressStore['item1'] = createDefaultProgress('item1');

      memorySystem.recordPronunciationAttempt('item1', true);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ pronunciationPassed: true })
      );
    });

    it('should set firstSuccessDate on first successful attempt', () => {
      storageManager._progressStore['item1'] = createDefaultProgress('item1');

      memorySystem.recordPronunciationAttempt('item1', true);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({
          firstSuccessDate: expect.any(String)
        })
      );
    });

    it('should not overwrite firstSuccessDate on subsequent successes', () => {
      const firstDate = '2024-01-01T00:00:00.000Z';
      storageManager._progressStore['item1'] = {
        ...createDefaultProgress('item1'),
        firstSuccessDate: firstDate,
        pronunciationAttempts: 1,
        pronunciationPassed: true
      };

      memorySystem.recordPronunciationAttempt('item1', true);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ firstSuccessDate: firstDate })
      );
    });

    it('should create default progress for item with no record', () => {
      memorySystem.recordPronunciationAttempt('new-item', false);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'new-item',
        expect.objectContaining({
          itemId: 'new-item',
          pronunciationAttempts: 1,
          pronunciationPassed: false
        })
      );
    });

    it('should emit progress:updated event', () => {
      storageManager._progressStore['item1'] = createDefaultProgress('item1');

      memorySystem.recordPronunciationAttempt('item1', true);

      expect(eventBus.emit).toHaveBeenCalledWith('progress:updated', expect.objectContaining({
        itemId: 'item1'
      }));
    });
  });

  describe('isPronunciationPassed', () => {
    it('should return false for item with no progress', () => {
      expect(memorySystem.isPronunciationPassed('item1')).toBe(false);
    });

    it('should return false when pronunciationPassed is false', () => {
      storageManager._progressStore['item1'] = { pronunciationPassed: false };
      expect(memorySystem.isPronunciationPassed('item1')).toBe(false);
    });

    it('should return true when pronunciationPassed is true', () => {
      storageManager._progressStore['item1'] = { pronunciationPassed: true };
      expect(memorySystem.isPronunciationPassed('item1')).toBe(true);
    });
  });

  describe('canMarkAsCompleted', () => {
    it('should return false for item with no progress', () => {
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(false);
    });

    it('should return false when only meaningViewed is true', () => {
      storageManager._progressStore['item1'] = {
        meaningViewed: true,
        pronunciationListened: false,
        pronunciationPassed: false
      };
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(false);
    });

    it('should return false when only pronunciationListened is true', () => {
      storageManager._progressStore['item1'] = {
        meaningViewed: false,
        pronunciationListened: true,
        pronunciationPassed: false
      };
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(false);
    });

    it('should return false when only pronunciationPassed is true', () => {
      storageManager._progressStore['item1'] = {
        meaningViewed: false,
        pronunciationListened: false,
        pronunciationPassed: true
      };
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(false);
    });

    it('should return false when two conditions are met but not the third', () => {
      storageManager._progressStore['item1'] = {
        meaningViewed: true,
        pronunciationListened: true,
        pronunciationPassed: false
      };
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(false);
    });

    it('should return true when all three conditions are met', () => {
      storageManager._progressStore['item1'] = {
        meaningViewed: true,
        pronunciationListened: true,
        pronunciationPassed: true
      };
      expect(memorySystem.canMarkAsCompleted('item1')).toBe(true);
    });
  });

  describe('getDailyProgress', () => {
    it('should return stats for today', () => {
      const today = new Date().toISOString().split('T')[0];
      storageManager._progressStore['item1'] = { lastReviewDate: today, status: 'remembered' };
      storageManager._progressStore['item2'] = { lastReviewDate: today, status: 'not_remembered' };
      storageManager._progressStore['item3'] = { lastReviewDate: '2024-01-01', status: 'remembered' };

      const dailyProgress = memorySystem.getDailyProgress();

      expect(dailyProgress.date).toBe(today);
      expect(dailyProgress.studiedToday).toBe(2);
      expect(dailyProgress.rememberedToday).toBe(1);
    });
  });
});
