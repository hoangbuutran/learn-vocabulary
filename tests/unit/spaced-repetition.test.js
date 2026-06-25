/**
 * Unit tests for SpacedRepetitionEngine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpacedRepetitionEngine, createDefaultProgress, addDays } from '../../js/modules/spaced-repetition.js';

// Mock storageManager
vi.mock('../../js/modules/storage-manager.js', () => {
  const progressStore = {};
  const vocabStore = [];
  return {
    default: {
      getProgress: vi.fn((itemId) => progressStore[itemId] || null),
      getAllProgress: vi.fn(() => ({ ...progressStore })),
      saveProgress: vi.fn((itemId, progress) => { progressStore[itemId] = progress; }),
      getAllVocabulary: vi.fn(() => [...vocabStore]),
      _progressStore: progressStore,
      _vocabStore: vocabStore,
      _reset: () => {
        Object.keys(progressStore).forEach(k => delete progressStore[k]);
        vocabStore.length = 0;
      }
    }
  };
});

// Mock eventBus
vi.mock('../../js/utils/event-bus.js', () => ({
  default: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}));

import storageManager from '../../js/modules/storage-manager.js';
import eventBus from '../../js/utils/event-bus.js';

describe('SpacedRepetitionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SpacedRepetitionEngine();
    storageManager._reset();
    vi.clearAllMocks();
  });

  describe('calculateNextReview', () => {
    it('should set interval to 1 day for first correct recall (repetitions=0)', () => {
      const result = engine.calculateNextReview('item1', 4);

      expect(result.itemId).toBe('item1');
      expect(result.interval).toBe(1);
      expect(result.nextReviewDate).toBeDefined();
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('should set interval to 6 days for second correct recall (repetitions=1)', () => {
      // First review
      engine.calculateNextReview('item1', 4);
      // Second review
      const result = engine.calculateNextReview('item1', 4);

      expect(result.interval).toBe(6);
    });

    it('should multiply interval by easeFactor for repetitions > 1', () => {
      // First review (interval=1, rep=1)
      engine.calculateNextReview('item1', 4);
      // Second review (interval=6, rep=2)
      engine.calculateNextReview('item1', 4);
      // Third review (interval=round(6 * easeFactor), rep=3)
      const result = engine.calculateNextReview('item1', 4);

      // easeFactor after two reviews with quality=4:
      // initial: 2.5
      // after q=4: 2.5 + 0.1 - (5-4)*(0.08+(5-4)*0.02) = 2.5 + 0.1 - 0.1 = 2.5
      // after q=4: 2.5 + 0.1 - 0.1 = 2.5
      // interval = round(6 * 2.5) = 15
      expect(result.interval).toBe(15);
    });

    it('should reset repetitions to 0 and interval to 1 for incorrect recall (quality < 3)', () => {
      // Build up some repetitions
      engine.calculateNextReview('item1', 4);
      engine.calculateNextReview('item1', 4);

      // Now fail
      const result = engine.calculateNextReview('item1', 1);

      expect(result.interval).toBe(1);
    });

    it('should never allow easeFactor below 1.3', () => {
      // Set up a progress record with easeFactor already near the minimum
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        easeFactor: 1.4,
        interval: 1,
        repetitions: 0,
        nextReviewDate: null,
        lastReviewDate: null,
        status: 'not_studied',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Quality 0 would reduce from 1.4: 1.4 + 0.1 - 5*(0.08+0.10) = 1.5 - 0.9 = 0.6 → clamped to 1.3
      const result = engine.calculateNextReview('item1', 0);

      expect(result.easeFactor).toBe(1.3);
    });

    it('should save progress to storageManager', () => {
      engine.calculateNextReview('item1', 4);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({
          itemId: 'item1',
          interval: 1,
          repetitions: 1,
          status: 'remembered'
        })
      );
    });

    it('should emit review:due event', () => {
      engine.calculateNextReview('item1', 4);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'review:due',
        expect.objectContaining({ itemId: 'item1' })
      );
    });

    it('should set status to remembered for quality >= 3', () => {
      engine.calculateNextReview('item1', 3);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ status: 'remembered' })
      );
    });

    it('should set status to not_remembered for quality < 3', () => {
      engine.calculateNextReview('item1', 2);

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({ status: 'not_remembered' })
      );
    });

    it('should handle quality=4 (remembered) correctly as per design mapping', () => {
      const result = engine.calculateNextReview('item1', 4);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(2.5); // 2.5 + 0.1 - (1)*(0.08+1*0.02) = 2.5 + 0.1 - 0.1 = 2.5
    });

    it('should handle quality=1 (not remembered) correctly as per design mapping', () => {
      const result = engine.calculateNextReview('item1', 1);
      expect(result.interval).toBe(1);
      // easeFactor = max(1.3, 2.5 + 0.1 - (5-1)*(0.08+(5-1)*0.02)) = max(1.3, 2.5 + 0.1 - 4*(0.08+0.08))
      // = max(1.3, 2.6 - 4*0.16) = max(1.3, 2.6 - 0.64) = max(1.3, 1.96) = 1.96
      expect(result.easeFactor).toBeCloseTo(1.96, 2);
    });
  });

  describe('getItemsDueForReview', () => {
    it('should return items where nextReviewDate <= given date', () => {
      // Set up progress with past review dates
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: '2024-01-01',
        interval: 1,
        easeFactor: 2.5
      };
      storageManager._progressStore['item2'] = {
        itemId: 'item2',
        nextReviewDate: '2024-06-15',
        interval: 6,
        easeFactor: 2.5
      };
      storageManager._progressStore['item3'] = {
        itemId: 'item3',
        nextReviewDate: '2024-12-31',
        interval: 15,
        easeFactor: 2.5
      };

      // Set up vocabulary
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello', meaning: 'xin chào' },
        { id: 'item2', word: 'world', meaning: 'thế giới' },
        { id: 'item3', word: 'future', meaning: 'tương lai' }
      );

      const dueItems = engine.getItemsDueForReview(new Date('2024-06-15'));

      expect(dueItems).toHaveLength(2);
      const dueIds = dueItems.map(item => item.id);
      expect(dueIds).toContain('item1');
      expect(dueIds).toContain('item2');
      expect(dueIds).not.toContain('item3');
    });

    it('should return empty array when no items are due', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: '2099-12-31',
        interval: 1,
        easeFactor: 2.5
      };
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello', meaning: 'xin chào' }
      );

      const dueItems = engine.getItemsDueForReview(new Date('2024-01-01'));
      expect(dueItems).toHaveLength(0);
    });

    it('should handle items with no nextReviewDate', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: null,
        interval: 0,
        easeFactor: 2.5
      };
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello', meaning: 'xin chào' }
      );

      const dueItems = engine.getItemsDueForReview(new Date('2024-06-15'));
      expect(dueItems).toHaveLength(0);
    });

    it('should default to today when no date is provided', () => {
      const today = new Date().toISOString().split('T')[0];
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: today,
        interval: 1,
        easeFactor: 2.5
      };
      storageManager._vocabStore.push(
        { id: 'item1', word: 'hello', meaning: 'xin chào' }
      );

      const dueItems = engine.getItemsDueForReview();
      expect(dueItems).toHaveLength(1);
    });
  });

  describe('getReviewSchedule', () => {
    it('should return schedule for all items with nextReviewDate', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: '2024-06-15',
        interval: 1,
        easeFactor: 2.5
      };
      storageManager._progressStore['item2'] = {
        itemId: 'item2',
        nextReviewDate: '2024-06-20',
        interval: 6,
        easeFactor: 2.3
      };

      const schedule = engine.getReviewSchedule();

      expect(schedule['item1']).toEqual({
        itemId: 'item1',
        nextReviewDate: '2024-06-15',
        interval: 1,
        easeFactor: 2.5
      });
      expect(schedule['item2']).toEqual({
        itemId: 'item2',
        nextReviewDate: '2024-06-20',
        interval: 6,
        easeFactor: 2.3
      });
    });

    it('should exclude items without nextReviewDate', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        nextReviewDate: null,
        interval: 0,
        easeFactor: 2.5
      };

      const schedule = engine.getReviewSchedule();
      expect(Object.keys(schedule)).toHaveLength(0);
    });
  });

  describe('resetInterval', () => {
    it('should reset interval to 1 and repetitions to 0', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        interval: 15,
        repetitions: 5,
        easeFactor: 2.5,
        nextReviewDate: '2024-12-01'
      };

      engine.resetInterval('item1');

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({
          interval: 1,
          repetitions: 0
        })
      );
    });

    it('should create default progress if item has no prior record', () => {
      engine.resetInterval('new-item');

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'new-item',
        expect.objectContaining({
          interval: 1,
          repetitions: 0
        })
      );
    });
  });

  describe('increaseInterval', () => {
    it('should multiply interval by easeFactor', () => {
      storageManager._progressStore['item1'] = {
        itemId: 'item1',
        interval: 6,
        repetitions: 2,
        easeFactor: 2.5,
        nextReviewDate: '2024-06-15'
      };

      engine.increaseInterval('item1');

      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'item1',
        expect.objectContaining({
          interval: 15, // round(6 * 2.5)
          repetitions: 3
        })
      );
    });

    it('should use default values for item with no prior record', () => {
      engine.increaseInterval('new-item');

      // default interval=0 → 1, easeFactor=2.5 → round(1*2.5) = 3
      expect(storageManager.saveProgress).toHaveBeenCalledWith(
        'new-item',
        expect.objectContaining({
          interval: 3, // round(1 * 2.5)
          repetitions: 1
        })
      );
    });
  });

  describe('createDefaultProgress helper', () => {
    it('should create a progress record with expected defaults', () => {
      const progress = createDefaultProgress('test-item');

      expect(progress.itemId).toBe('test-item');
      expect(progress.status).toBe('not_studied');
      expect(progress.easeFactor).toBe(2.5);
      expect(progress.interval).toBe(0);
      expect(progress.repetitions).toBe(0);
      expect(progress.nextReviewDate).toBeNull();
      expect(progress.lastReviewDate).toBeNull();
      expect(progress.pronunciationAttempts).toBe(0);
      expect(progress.pronunciationPassed).toBe(false);
      expect(progress.meaningViewed).toBe(false);
      expect(progress.pronunciationListened).toBe(false);
    });
  });

  describe('addDays helper', () => {
    it('should add days correctly', () => {
      const result = addDays(new Date('2024-01-01'), 5);
      expect(result).toBe('2024-01-06');
    });

    it('should handle month boundaries', () => {
      const result = addDays(new Date('2024-01-30'), 3);
      expect(result).toBe('2024-02-02');
    });
  });
});
