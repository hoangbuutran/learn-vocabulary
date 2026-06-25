/**
 * Unit tests for StorageManager module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager, DEFAULT_SETTINGS, KEYS } from '../../js/modules/storage-manager.js';

describe('StorageManager', () => {
  let storageManager;

  beforeEach(() => {
    localStorage.clear();
    storageManager = new StorageManager();
  });

  describe('Vocabulary operations', () => {
    const sampleItems = [
      {
        id: 'test_001',
        word: 'hello',
        meaning: 'xin chào',
        examples: ['Hello, how are you?'],
        category: 'A1',
        groupIndex: 1
      },
      {
        id: 'test_002',
        word: 'world',
        meaning: 'thế giới',
        examples: ['The world is beautiful.'],
        category: 'A2',
        groupIndex: 1
      }
    ];

    it('getAllVocabulary returns empty array when no data', () => {
      expect(storageManager.getAllVocabulary()).toEqual([]);
    });

    it('saveVocabulary stores items and getAllVocabulary retrieves them', () => {
      storageManager.saveVocabulary(sampleItems);
      const result = storageManager.getAllVocabulary();
      expect(result).toEqual(sampleItems);
    });

    it('getVocabularyByCategory filters items correctly', () => {
      storageManager.saveVocabulary(sampleItems);
      const a1Items = storageManager.getVocabularyByCategory('A1');
      expect(a1Items).toHaveLength(1);
      expect(a1Items[0].word).toBe('hello');
    });

    it('getVocabularyByCategory returns empty array for non-existent category', () => {
      storageManager.saveVocabulary(sampleItems);
      expect(storageManager.getVocabularyByCategory('C1')).toEqual([]);
    });
  });

  describe('Progress operations', () => {
    const sampleProgress = {
      itemId: 'test_001',
      status: 'remembered',
      easeFactor: 2.5,
      interval: 6,
      repetitions: 2,
      nextReviewDate: '2024-01-15',
      pronunciationAttempts: 3,
      pronunciationPassed: true,
      meaningViewed: true,
      pronunciationListened: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-10T00:00:00.000Z'
    };

    it('getProgress returns null for non-existent item', () => {
      expect(storageManager.getProgress('non_existent')).toBeNull();
    });

    it('saveProgress and getProgress round-trip correctly', () => {
      storageManager.saveProgress('test_001', sampleProgress);
      const result = storageManager.getProgress('test_001');
      expect(result).toEqual(sampleProgress);
    });

    it('getAllProgress returns empty object when no data', () => {
      expect(storageManager.getAllProgress()).toEqual({});
    });

    it('getAllProgress returns all saved progress', () => {
      storageManager.saveProgress('test_001', sampleProgress);
      storageManager.saveProgress('test_002', { ...sampleProgress, itemId: 'test_002' });
      const all = storageManager.getAllProgress();
      expect(Object.keys(all)).toHaveLength(2);
    });
  });

  describe('Settings operations', () => {
    it('getSettings returns defaults when nothing saved', () => {
      expect(storageManager.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('saveSettings persists and retrieves settings', () => {
      const custom = { theme: 'dark', accent: 'en-GB', dailyWordCount: 20, autoPlayPronunciation: true };
      storageManager.saveSettings(custom);
      expect(storageManager.getSettings()).toEqual(custom);
    });

    it('getSettings merges with defaults for partial saved settings', () => {
      // Manually write partial settings
      localStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify({ theme: 'dark' }));
      const result = storageManager.getSettings();
      expect(result.theme).toBe('dark');
      expect(result.accent).toBe('en-US');
      expect(result.dailyWordCount).toBe(10);
      expect(result.autoPlayPronunciation).toBe(false);
    });
  });

  describe('First run detection', () => {
    it('isFirstRun returns true when data_loaded is not set', () => {
      expect(storageManager.isFirstRun()).toBe(true);
    });

    it('isFirstRun returns false after data_loaded is set to true', () => {
      localStorage.setItem(KEYS.DATA_LOADED, 'true');
      expect(storageManager.isFirstRun()).toBe(false);
    });
  });

  describe('Export/Import operations', () => {
    const sampleVocab = [
      { id: 'v1', word: 'test', meaning: 'kiểm tra', examples: ['This is a test.'], category: 'A1', groupIndex: 1 }
    ];
    const sampleProgress = {
      itemId: 'v1',
      status: 'remembered',
      easeFactor: 2.5,
      interval: 1,
      repetitions: 1,
      nextReviewDate: '2024-01-02',
      pronunciationAttempts: 0,
      pronunciationPassed: false,
      meaningViewed: true,
      pronunciationListened: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };

    it('exportAllData produces correct structure', () => {
      storageManager.saveVocabulary(sampleVocab);
      storageManager.saveProgress('v1', sampleProgress);

      const exported = storageManager.exportAllData();
      expect(exported.version).toBe('1.0.0');
      expect(exported.exportedAt).toBeDefined();
      expect(exported.vocabulary).toEqual(sampleVocab);
      expect(exported.progress).toEqual([sampleProgress]);
      expect(exported.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('importData restores vocabulary and progress', () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        vocabulary: sampleVocab,
        progress: [sampleProgress],
        settings: { theme: 'dark', accent: 'en-GB', dailyWordCount: 15, autoPlayPronunciation: true }
      };

      const result = storageManager.importData(exportData);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.errors).toHaveLength(0);

      expect(storageManager.getAllVocabulary()).toEqual(sampleVocab);
      expect(storageManager.getProgress('v1')).toEqual(sampleProgress);
      expect(storageManager.getSettings().theme).toBe('dark');
    });

    it('importData rejects null input', () => {
      const result = storageManager.importData(null);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('importData rejects missing vocabulary array', () => {
      const result = storageManager.importData({ version: '1.0.0' });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('importData skips items without word or meaning', () => {
      const data = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        vocabulary: [
          { id: 'v1', word: 'test', meaning: 'kiểm tra', examples: [], category: 'A1', groupIndex: 1 },
          { id: 'v2', word: '', meaning: 'thiếu từ', examples: [], category: 'A1', groupIndex: 2 },
          { id: 'v3', meaning: 'no word field', examples: [], category: 'A1', groupIndex: 3 }
        ],
        progress: [],
        settings: DEFAULT_SETTINGS
      };

      const result = storageManager.importData(data);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.errors).toHaveLength(2);
    });

    it('importData does not corrupt state on invalid data', () => {
      // Pre-populate valid data
      storageManager.saveVocabulary(sampleVocab);

      // Try to import invalid data
      const result = storageManager.importData({ vocabulary: 'not an array' });
      expect(result.success).toBe(false);

      // Original data should still be intact
      expect(storageManager.getAllVocabulary()).toEqual(sampleVocab);
    });
  });

  describe('QuotaExceededError handling', () => {
    it('handles QuotaExceededError gracefully', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = Storage.prototype.setItem;
      const error = new DOMException('quota exceeded', 'QuotaExceededError');
      Object.defineProperty(error, 'name', { value: 'QuotaExceededError' });

      Storage.prototype.setItem = vi.fn(() => { throw error; });

      // Should not throw
      expect(() => storageManager.saveVocabulary([{ word: 'test', meaning: 'test' }])).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('Corrupted data handling', () => {
    it('returns default when localStorage has invalid JSON', () => {
      localStorage.setItem(KEYS.VOCAB_ITEMS, '{invalid json');
      expect(storageManager.getAllVocabulary()).toEqual([]);
    });

    it('returns default settings when settings are corrupted', () => {
      localStorage.setItem(KEYS.APP_SETTINGS, 'not json');
      expect(storageManager.getSettings()).toEqual(DEFAULT_SETTINGS);
    });
  });
});
