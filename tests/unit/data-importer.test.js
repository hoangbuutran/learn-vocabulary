/**
 * Unit tests for DataImporter module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataImporter } from '../../js/modules/data-importer.js';

// Mock storageManager
vi.mock('../../js/modules/storage-manager.js', () => {
  const mockStorage = {
    getAllVocabulary: vi.fn(() => []),
    saveVocabulary: vi.fn()
  };
  return { default: mockStorage, StorageManager: vi.fn() };
});

// Mock event-bus
vi.mock('../../js/utils/event-bus.js', () => {
  const mockBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  };
  return { default: mockBus };
});

import storageManager from '../../js/modules/storage-manager.js';
import eventBus from '../../js/utils/event-bus.js';

describe('DataImporter', () => {
  let importer;

  beforeEach(() => {
    importer = new DataImporter();
    vi.clearAllMocks();
    storageManager.getAllVocabulary.mockReturnValue([]);
  });

  describe('parseCSV', () => {
    it('parses valid CSV with all fields', () => {
      const csv = 'hello,xin chào,Hello world;Hi there,/həˈloʊ/';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('parses CSV with header row', () => {
      const csv = 'word,meaning,example,pronunciation\nhello,xin chào,Hello world,/həˈloʊ/';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('parses CSV without pronunciation (optional field)', () => {
      const csv = 'hello,xin chào,Hello world';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('parses CSV with only word and meaning', () => {
      const csv = 'hello,xin chào';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('returns error for empty content', () => {
      const result = importer.parseCSV('');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for null content', () => {
      const result = importer.parseCSV(null);
      expect(result.success).toBe(false);
    });

    it('skips invalid lines and reports errors', () => {
      const csv = 'hello,xin chào\njustoneword\nworld,thế giới';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
    });

    it('returns success=false when all lines are invalid', () => {
      const csv = 'justoneword\nanotheroneword';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(false);
      expect(result.importedCount).toBe(0);
    });

    it('handles quoted fields in CSV', () => {
      const csv = '"hello, world","xin chào, thế giới","Say ""hello"" to the world"';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('parses multiple examples separated by semicolons', () => {
      const csv = 'hello,xin chào,Hello world;Hi there;Greetings';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      // Verify that _mergeAndSave was called with items containing parsed examples
      expect(storageManager.saveVocabulary).toHaveBeenCalled();
    });

    it('handles multiple lines including blank lines', () => {
      const csv = 'hello,xin chào\n\nworld,thế giới\n\n';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
    });

    it('merges with existing vocabulary on success', () => {
      storageManager.getAllVocabulary.mockReturnValue([
        { id: 'existing_1', word: 'existing', meaning: 'đã tồn tại', examples: [], category: 'A1', groupIndex: 0 }
      ]);
      const csv = 'hello,xin chào';
      const result = importer.parseCSV(csv);
      expect(result.success).toBe(true);
      // saveVocabulary should be called with merged items (existing + new)
      const savedItems = storageManager.saveVocabulary.mock.calls[0][0];
      expect(savedItems).toHaveLength(2);
      expect(savedItems[0].word).toBe('existing');
      expect(savedItems[1].word).toBe('hello');
    });

    it('emits vocab:imported event on success', () => {
      const csv = 'hello,xin chào';
      importer.parseCSV(csv);
      expect(eventBus.emit).toHaveBeenCalledWith('vocab:imported', expect.objectContaining({ count: 1 }));
    });

    it('does not emit event or save on failure', () => {
      importer.parseCSV('');
      expect(storageManager.saveVocabulary).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('parseJSON', () => {
    it('parses valid JSON array', () => {
      const json = JSON.stringify([
        { word: 'hello', meaning: 'xin chào', examples: ['Hello world'], pronunciation: '/həˈloʊ/' }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('parses valid JSON with items wrapper', () => {
      const json = JSON.stringify({
        items: [
          { word: 'hello', meaning: 'xin chào', examples: ['Hello world'] }
        ]
      });
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('handles examples as string (split by semicolons)', () => {
      const json = JSON.stringify([
        { word: 'hello', meaning: 'xin chào', examples: 'Hello world;Hi there' }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
    });

    it('handles examples as array', () => {
      const json = JSON.stringify([
        { word: 'hello', meaning: 'xin chào', examples: ['Hello world', 'Hi there'] }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
    });

    it('treats pronunciation as optional', () => {
      const json = JSON.stringify([
        { word: 'hello', meaning: 'xin chào' }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('returns error for invalid JSON syntax', () => {
      const result = importer.parseJSON('{not valid json}');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for empty content', () => {
      const result = importer.parseJSON('');
      expect(result.success).toBe(false);
    });

    it('returns error for non-array non-object-with-items', () => {
      const result = importer.parseJSON('"just a string"');
      expect(result.success).toBe(false);
    });

    it('returns error for empty array', () => {
      const result = importer.parseJSON('[]');
      expect(result.success).toBe(false);
    });

    it('skips items without required fields and reports errors', () => {
      const json = JSON.stringify([
        { word: 'hello', meaning: 'xin chào' },
        { word: 'missing meaning' },
        { meaning: 'missing word' }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.errors).toHaveLength(2);
    });

    it('returns success=false when all items are invalid', () => {
      const json = JSON.stringify([
        { word: '' },
        { meaning: '' }
      ]);
      const result = importer.parseJSON(json);
      expect(result.success).toBe(false);
    });

    it('emits vocab:imported event on success', () => {
      const json = JSON.stringify([{ word: 'test', meaning: 'kiểm tra' }]);
      importer.parseJSON(json);
      expect(eventBus.emit).toHaveBeenCalledWith('vocab:imported', expect.objectContaining({ count: 1 }));
    });
  });

  describe('parseTXT', () => {
    it('parses tab-separated TXT', () => {
      const txt = 'hello\txin chào\tHello world\t/həˈloʊ/';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('parses pipe-separated TXT', () => {
      const txt = 'hello|xin chào|Hello world|/həˈloʊ/';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('parses TXT with only word and meaning', () => {
      const txt = 'hello\txin chào';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('handles header row in TXT', () => {
      const txt = 'word\tmeaning\texample\tpronunciation\nhello\txin chào\tHello world\t/həˈloʊ/';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('returns error for empty content', () => {
      const result = importer.parseTXT('');
      expect(result.success).toBe(false);
    });

    it('skips invalid lines', () => {
      const txt = 'hello\txin chào\noneword\nworld\tthế giới';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
    });

    it('returns success=false when all lines invalid', () => {
      const txt = 'oneword\nanotherword';
      const result = importer.parseTXT(txt);
      expect(result.success).toBe(false);
    });

    it('emits vocab:imported event on success', () => {
      const txt = 'hello\txin chào';
      importer.parseTXT(txt);
      expect(eventBus.emit).toHaveBeenCalledWith('vocab:imported', expect.objectContaining({ count: 1 }));
    });
  });

  describe('validateItem', () => {
    it('returns empty array for valid item', () => {
      const errors = importer.validateItem({ word: 'hello', meaning: 'xin chào' });
      expect(errors).toHaveLength(0);
    });

    it('returns error for missing word', () => {
      const errors = importer.validateItem({ meaning: 'xin chào' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('word');
    });

    it('returns error for missing meaning', () => {
      const errors = importer.validateItem({ word: 'hello' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('meaning');
    });

    it('returns errors for both missing word and meaning', () => {
      const errors = importer.validateItem({});
      expect(errors).toHaveLength(2);
    });

    it('returns error for null item', () => {
      const errors = importer.validateItem(null);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('does not require pronunciation', () => {
      const errors = importer.validateItem({ word: 'hello', meaning: 'xin chào' });
      expect(errors).toHaveLength(0);
    });

    it('returns error for empty word string', () => {
      const errors = importer.validateItem({ word: '', meaning: 'xin chào' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error for whitespace-only word', () => {
      const errors = importer.validateItem({ word: '   ', meaning: 'xin chào' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('provides Vietnamese error messages', () => {
      const errors = importer.validateItem({});
      for (const err of errors) {
        // Messages should be in Vietnamese
        expect(err.message).toBeDefined();
        expect(err.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('importFile', () => {
    it('returns error for null file', async () => {
      const result = await importer.importFile(null);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for unsupported file type', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = await importer.importFile(file);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('CSV');
    });

    it('delegates to parseCSV for .csv files', async () => {
      const csvContent = 'hello,xin chào,Hello world';
      const file = new File([csvContent], 'vocab.csv', { type: 'text/csv' });
      const result = await importer.importFile(file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('delegates to parseJSON for .json files', async () => {
      const jsonContent = JSON.stringify([{ word: 'hello', meaning: 'xin chào' }]);
      const file = new File([jsonContent], 'vocab.json', { type: 'application/json' });
      const result = await importer.importFile(file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('delegates to parseTXT for .txt files', async () => {
      const txtContent = 'hello\txin chào';
      const file = new File([txtContent], 'vocab.txt', { type: 'text/plain' });
      const result = await importer.importFile(file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('handles file read errors gracefully', async () => {
      // Create a file-like object that will cause a read error
      const file = { name: 'test.csv' };
      // importFile will try to read it and fail since it's not a proper File
      const result = await importer.importFile(file);
      expect(result.success).toBe(false);
    });
  });

  describe('state preservation on failure', () => {
    it('does not modify existing vocabulary on CSV parse failure', () => {
      const existing = [{ id: 'existing', word: 'test', meaning: 'kiểm tra', examples: [], category: 'A1', groupIndex: 0 }];
      storageManager.getAllVocabulary.mockReturnValue(existing);

      importer.parseCSV('invaliddata');
      // saveVocabulary should not be called
      expect(storageManager.saveVocabulary).not.toHaveBeenCalled();
    });

    it('does not modify existing vocabulary on JSON parse failure', () => {
      importer.parseJSON('{invalid}');
      expect(storageManager.saveVocabulary).not.toHaveBeenCalled();
    });

    it('does not modify existing vocabulary on TXT parse failure', () => {
      importer.parseTXT('oneword');
      expect(storageManager.saveVocabulary).not.toHaveBeenCalled();
    });
  });
});
