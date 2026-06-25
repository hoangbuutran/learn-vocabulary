/**
 * Unit tests for SpeechModule
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SpeechModule } from '../../js/modules/speech-module.js';

describe('SpeechModule', () => {
  let speechModule;
  let mockUtterance;
  let mockSynthesis;

  beforeEach(() => {
    speechModule = new SpeechModule();

    // Mock SpeechSynthesisUtterance
    mockUtterance = {
      lang: '',
      voice: null,
      onend: null,
      onerror: null
    };

    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => mockUtterance));

    // Mock speechSynthesis
    mockSynthesis = {
      getVoices: vi.fn(() => [
        { lang: 'en-US', name: 'US English' },
        { lang: 'en-GB', name: 'British English' },
        { lang: 'vi-VN', name: 'Vietnamese' }
      ]),
      speak: vi.fn((utterance) => {
        // Simulate immediate speech end
        setTimeout(() => utterance.onend && utterance.onend(), 0);
      }),
      cancel: vi.fn()
    };

    vi.stubGlobal('speechSynthesis', mockSynthesis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('speak', () => {
    it('should create an utterance with the given word', async () => {
      const promise = speechModule.speak('hello');
      await promise;

      expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('hello');
    });

    it('should use default accent en-US when no accent provided', async () => {
      const promise = speechModule.speak('hello');
      await promise;

      expect(mockUtterance.lang).toBe('en-US');
    });

    it('should use provided accent when specified', async () => {
      const promise = speechModule.speak('hello', 'en-GB');
      await promise;

      expect(mockUtterance.lang).toBe('en-GB');
    });

    it('should cancel ongoing speech before starting new', async () => {
      const promise = speechModule.speak('hello');
      await promise;

      expect(mockSynthesis.cancel).toHaveBeenCalled();
    });

    it('should call speechSynthesis.speak', async () => {
      const promise = speechModule.speak('hello');
      await promise;

      expect(mockSynthesis.speak).toHaveBeenCalledWith(mockUtterance);
    });

    it('should set a matching voice when available', async () => {
      const promise = speechModule.speak('hello', 'en-GB');
      await promise;

      expect(mockUtterance.voice).toEqual({ lang: 'en-GB', name: 'British English' });
    });

    it('should resolve immediately if SpeechSynthesis not supported', async () => {
      // Remove speechSynthesis from window
      delete window.speechSynthesis;
      vi.stubGlobal('speechSynthesis', undefined);
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });

      // Create a new module that checks support fresh
      const mod = new SpeechModule();
      // Override the internal check
      mod._isSynthesisSupported = () => false;

      const result = await mod.speak('hello');
      expect(result).toBeUndefined();
    });

    it('should resolve on utterance error with canceled/interrupted', async () => {
      mockSynthesis.speak = vi.fn((utterance) => {
        setTimeout(() => utterance.onerror && utterance.onerror({ error: 'canceled' }), 0);
      });

      const result = await speechModule.speak('hello');
      expect(result).toBeUndefined();
    });

    it('should reject on utterance error with other errors', async () => {
      mockSynthesis.speak = vi.fn((utterance) => {
        setTimeout(() => utterance.onerror && utterance.onerror({ error: 'network' }), 0);
      });

      await expect(speechModule.speak('hello')).rejects.toThrow('Lỗi phát âm: network');
    });
  });

  describe('setAccent', () => {
    it('should set accent to en-US', () => {
      speechModule.setAccent('en-US');
      // Verify by speaking and checking the lang
      speechModule.speak('test');
      expect(mockUtterance.lang).toBe('en-US');
    });

    it('should set accent to en-GB', () => {
      speechModule.setAccent('en-GB');
      speechModule.speak('test');
      expect(mockUtterance.lang).toBe('en-GB');
    });

    it('should not change accent for invalid values', () => {
      speechModule.setAccent('fr-FR');
      speechModule.speak('test');
      // Should remain default 'en-US'
      expect(mockUtterance.lang).toBe('en-US');
    });

    it('should affect subsequent speak calls', async () => {
      speechModule.setAccent('en-GB');
      const promise = speechModule.speak('world');
      await promise;

      expect(mockUtterance.lang).toBe('en-GB');
    });
  });

  describe('getAvailableVoices', () => {
    it('should return voices from speechSynthesis.getVoices()', () => {
      const voices = speechModule.getAvailableVoices();
      expect(voices).toHaveLength(3);
      expect(voices[0]).toEqual({ lang: 'en-US', name: 'US English' });
    });

    it('should return empty array if synthesis not supported', () => {
      const mod = new SpeechModule();
      mod._isSynthesisSupported = () => false;

      const voices = mod.getAvailableVoices();
      expect(voices).toEqual([]);
    });
  });

  describe('isRecognitionSupported', () => {
    it('should return true when SpeechRecognition is available', () => {
      vi.stubGlobal('SpeechRecognition', vi.fn());

      const mod = new SpeechModule();
      expect(mod.isRecognitionSupported()).toBe(true);
    });

    it('should return true when webkitSpeechRecognition is available', () => {
      // Remove standard API
      delete window.SpeechRecognition;
      vi.stubGlobal('webkitSpeechRecognition', vi.fn());

      const mod = new SpeechModule();
      expect(mod.isRecognitionSupported()).toBe(true);
    });

    it('should return false when neither API is available', () => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;

      const mod = new SpeechModule();
      expect(mod.isRecognitionSupported()).toBe(false);
    });
  });

  describe('startRecognition', () => {
    let MockRecognition;
    let mockRecognitionInstance;

    beforeEach(() => {
      mockRecognitionInstance = {
        lang: '',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        onresult: null,
        onerror: null,
        onend: null,
        start: vi.fn(),
        abort: vi.fn()
      };

      MockRecognition = vi.fn(() => mockRecognitionInstance);
      vi.stubGlobal('SpeechRecognition', MockRecognition);
    });

    it('should reject with Vietnamese error when not supported', async () => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;

      const mod = new SpeechModule();
      await expect(mod.startRecognition()).rejects.toThrow('Trình duyệt không hỗ trợ nhận diện giọng nói');
    });

    it('should create recognition instance and start it', () => {
      speechModule.startRecognition();

      expect(MockRecognition).toHaveBeenCalled();
      expect(mockRecognitionInstance.start).toHaveBeenCalled();
    });

    it('should set recognition language to current accent', () => {
      speechModule.setAccent('en-GB');
      speechModule.startRecognition();

      expect(mockRecognitionInstance.lang).toBe('en-GB');
    });

    it('should set interimResults to false', () => {
      speechModule.startRecognition();
      expect(mockRecognitionInstance.interimResults).toBe(false);
    });

    it('should set continuous to false', () => {
      speechModule.startRecognition();
      expect(mockRecognitionInstance.continuous).toBe(false);
    });

    it('should resolve with recognized text on result', async () => {
      const promise = speechModule.startRecognition();

      // Simulate a result event
      mockRecognitionInstance.onresult({
        results: [[{ transcript: '  hello  ' }]]
      });

      const result = await promise;
      expect(result).toBe('hello');
    });

    it('should reject with Vietnamese error on no-speech', async () => {
      const promise = speechModule.startRecognition();

      mockRecognitionInstance.onerror({ error: 'no-speech' });

      await expect(promise).rejects.toThrow('Không nhận được giọng nói. Vui lòng thử lại.');
    });

    it('should reject with Vietnamese error on aborted', async () => {
      const promise = speechModule.startRecognition();

      mockRecognitionInstance.onerror({ error: 'aborted' });

      await expect(promise).rejects.toThrow('Không nhận được giọng nói. Vui lòng thử lại.');
    });

    it('should reject with error description for other errors', async () => {
      const promise = speechModule.startRecognition();

      mockRecognitionInstance.onerror({ error: 'network' });

      await expect(promise).rejects.toThrow('Lỗi nhận diện giọng nói: network');
    });
  });

  describe('stopRecognition', () => {
    let mockRecognitionInstance;

    beforeEach(() => {
      mockRecognitionInstance = {
        lang: '',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        onresult: null,
        onerror: null,
        onend: null,
        start: vi.fn(),
        abort: vi.fn()
      };

      const MockRecognition = vi.fn(() => mockRecognitionInstance);
      vi.stubGlobal('SpeechRecognition', MockRecognition);
    });

    it('should call abort on active recognition', () => {
      speechModule.startRecognition();
      speechModule.stopRecognition();

      expect(mockRecognitionInstance.abort).toHaveBeenCalled();
    });

    it('should not throw when no recognition is active', () => {
      expect(() => speechModule.stopRecognition()).not.toThrow();
    });

    it('should not abort if recognition already ended', () => {
      speechModule.startRecognition();

      // Simulate end event
      mockRecognitionInstance.onend();

      // Reset abort mock to check it's not called after stop
      mockRecognitionInstance.abort.mockClear();
      speechModule.stopRecognition();

      expect(mockRecognitionInstance.abort).not.toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('speak resolves without error when synthesis unavailable', async () => {
      const mod = new SpeechModule();
      mod._isSynthesisSupported = () => false;

      const result = await mod.speak('test');
      expect(result).toBeUndefined();
    });

    it('getAvailableVoices returns empty array when synthesis unavailable', () => {
      const mod = new SpeechModule();
      mod._isSynthesisSupported = () => false;

      expect(mod.getAvailableVoices()).toEqual([]);
    });

    it('startRecognition rejects with Vietnamese message when recognition unavailable', async () => {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;

      const mod = new SpeechModule();
      await expect(mod.startRecognition()).rejects.toThrow('Trình duyệt không hỗ trợ nhận diện giọng nói');
    });
  });
});
