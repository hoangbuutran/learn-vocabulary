/**
 * Unit tests for PronunciationValidator
 * Requirements: 15.3, 15.4, 15.5, 15.6
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PronunciationValidator } from '../../js/modules/pronunciation-validator.js';

// Mock speechModule
vi.mock('../../js/modules/speech-module.js', () => ({
  default: {
    startRecognition: vi.fn()
  }
}));

// Mock storageManager
vi.mock('../../js/modules/storage-manager.js', () => ({
  default: {
    getProgress: vi.fn()
  }
}));

import speechModule from '../../js/modules/speech-module.js';
import storageManager from '../../js/modules/storage-manager.js';

describe('PronunciationValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new PronunciationValidator();
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return passed=true when words match exactly', () => {
      const result = validator.validate('hello', 'hello');

      expect(result.passed).toBe(true);
      expect(result.targetWord).toBe('hello');
      expect(result.recognizedText).toBe('hello');
      expect(result.confidence).toBeNull();
    });

    it('should return passed=true for case-insensitive match', () => {
      const result = validator.validate('Hello', 'hello');
      expect(result.passed).toBe(true);
    });

    it('should return passed=true for UPPERCASE vs lowercase match', () => {
      const result = validator.validate('HELLO', 'hello');
      expect(result.passed).toBe(true);
    });

    it('should return passed=true for mixed case match', () => {
      const result = validator.validate('HeLLo', 'hEllO');
      expect(result.passed).toBe(true);
    });

    it('should return passed=true after trimming whitespace', () => {
      const result = validator.validate('  hello  ', '  hello  ');
      expect(result.passed).toBe(true);
    });

    it('should return passed=true with leading/trailing whitespace on recognized text', () => {
      const result = validator.validate('hello', '  hello  ');
      expect(result.passed).toBe(true);
    });

    it('should return passed=true with leading/trailing whitespace on target word', () => {
      const result = validator.validate('  hello  ', 'hello');
      expect(result.passed).toBe(true);
    });

    it('should return passed=false when words differ', () => {
      const result = validator.validate('hello', 'world');

      expect(result.passed).toBe(false);
      expect(result.targetWord).toBe('hello');
      expect(result.recognizedText).toBe('world');
    });

    it('should return passed=false for partial match', () => {
      const result = validator.validate('hello', 'hell');
      expect(result.passed).toBe(false);
    });

    it('should return passed=false for extra characters', () => {
      const result = validator.validate('hello', 'helloo');
      expect(result.passed).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = validator.validate('', '');
      expect(result.passed).toBe(true);
    });

    it('should return passed=false for empty recognized vs non-empty target', () => {
      const result = validator.validate('hello', '');
      expect(result.passed).toBe(false);
    });

    it('should return passed=false for non-empty recognized vs empty target', () => {
      const result = validator.validate('', 'hello');
      expect(result.passed).toBe(false);
    });

    it('should handle null targetWord gracefully', () => {
      const result = validator.validate(null, 'hello');
      expect(result.passed).toBe(false);
      expect(result.targetWord).toBe('');
    });

    it('should handle null recognizedText gracefully', () => {
      const result = validator.validate('hello', null);
      expect(result.passed).toBe(false);
      expect(result.recognizedText).toBe('');
    });

    it('should return trimmed targetWord in result', () => {
      const result = validator.validate('  hello  ', 'hello');
      expect(result.targetWord).toBe('hello');
    });

    it('should return trimmed recognizedText in result', () => {
      const result = validator.validate('hello', '  hello  ');
      expect(result.recognizedText).toBe('hello');
    });

    it('should set confidence to null (not available from pure validation)', () => {
      const result = validator.validate('hello', 'hello');
      expect(result.confidence).toBeNull();
    });

    it('should handle multi-word phrases', () => {
      const result = validator.validate('good morning', 'Good Morning');
      expect(result.passed).toBe(true);
    });
  });

  describe('startValidation', () => {
    it('should call speechModule.startRecognition', async () => {
      speechModule.startRecognition.mockResolvedValue('hello');

      await validator.startValidation('hello');

      expect(speechModule.startRecognition).toHaveBeenCalledOnce();
    });

    it('should return passed=true when recognized matches target', async () => {
      speechModule.startRecognition.mockResolvedValue('hello');

      const result = await validator.startValidation('hello');

      expect(result.passed).toBe(true);
      expect(result.targetWord).toBe('hello');
      expect(result.recognizedText).toBe('hello');
    });

    it('should return passed=true with case-insensitive recognition', async () => {
      speechModule.startRecognition.mockResolvedValue('Hello');

      const result = await validator.startValidation('hello');

      expect(result.passed).toBe(true);
    });

    it('should return passed=false when recognized does not match', async () => {
      speechModule.startRecognition.mockResolvedValue('world');

      const result = await validator.startValidation('hello');

      expect(result.passed).toBe(false);
      expect(result.recognizedText).toBe('world');
    });

    it('should propagate errors from speechModule.startRecognition', async () => {
      speechModule.startRecognition.mockRejectedValue(
        new Error('Trình duyệt không hỗ trợ nhận diện giọng nói')
      );

      await expect(validator.startValidation('hello')).rejects.toThrow(
        'Trình duyệt không hỗ trợ nhận diện giọng nói'
      );
    });

    it('should handle trimmed recognition result', async () => {
      speechModule.startRecognition.mockResolvedValue('  hello  ');

      const result = await validator.startValidation('hello');

      expect(result.passed).toBe(true);
      expect(result.recognizedText).toBe('hello');
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 when no progress exists', () => {
      storageManager.getProgress.mockReturnValue(null);

      const count = validator.getAttemptCount('item-1');

      expect(count).toBe(0);
      expect(storageManager.getProgress).toHaveBeenCalledWith('item-1');
    });

    it('should return 0 when progress has no pronunciationAttempts', () => {
      storageManager.getProgress.mockReturnValue({ itemId: 'item-1' });

      const count = validator.getAttemptCount('item-1');

      expect(count).toBe(0);
    });

    it('should return the pronunciationAttempts value from progress', () => {
      storageManager.getProgress.mockReturnValue({
        itemId: 'item-1',
        pronunciationAttempts: 5
      });

      const count = validator.getAttemptCount('item-1');

      expect(count).toBe(5);
    });

    it('should return 0 for pronunciationAttempts set to 0', () => {
      storageManager.getProgress.mockReturnValue({
        itemId: 'item-1',
        pronunciationAttempts: 0
      });

      const count = validator.getAttemptCount('item-1');

      expect(count).toBe(0);
    });
  });

  describe('getFirstSuccessDate', () => {
    it('should return null when no progress exists', () => {
      storageManager.getProgress.mockReturnValue(null);

      const date = validator.getFirstSuccessDate('item-1');

      expect(date).toBeNull();
      expect(storageManager.getProgress).toHaveBeenCalledWith('item-1');
    });

    it('should return null when progress has no firstSuccessDate', () => {
      storageManager.getProgress.mockReturnValue({
        itemId: 'item-1',
        firstSuccessDate: null
      });

      const date = validator.getFirstSuccessDate('item-1');

      expect(date).toBeNull();
    });

    it('should return a Date object when firstSuccessDate exists', () => {
      const isoDate = '2024-03-15T10:30:00.000Z';
      storageManager.getProgress.mockReturnValue({
        itemId: 'item-1',
        firstSuccessDate: isoDate
      });

      const date = validator.getFirstSuccessDate('item-1');

      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(isoDate);
    });

    it('should return null when firstSuccessDate is empty string', () => {
      storageManager.getProgress.mockReturnValue({
        itemId: 'item-1',
        firstSuccessDate: ''
      });

      const date = validator.getFirstSuccessDate('item-1');

      expect(date).toBeNull();
    });
  });
});
