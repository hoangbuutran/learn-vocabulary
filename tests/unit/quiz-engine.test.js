/**
 * Unit tests for QuizEngine module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuizEngine } from '../../js/modules/quiz-engine.js';

// Mock storageManager
vi.mock('../../js/modules/storage-manager.js', () => {
  const mockVocabulary = [
    { id: 'item_1', word: 'abandon', meaning: 'từ bỏ', examples: ['He abandoned the plan.'], category: 'A1' },
    { id: 'item_2', word: 'ability', meaning: 'khả năng', examples: ['She has great ability.'], category: 'A1' },
    { id: 'item_3', word: 'accept', meaning: 'chấp nhận', examples: ['I accept your offer.'], category: 'A1' },
    { id: 'item_4', word: 'achieve', meaning: 'đạt được', examples: ['He achieved his goal.'], category: 'A1' },
    { id: 'item_5', word: 'across', meaning: 'qua, ngang qua', examples: ['Walk across the bridge.'], category: 'A2' },
    { id: 'item_6', word: 'action', meaning: 'hành động', examples: ['Take action now.'], category: 'A2' }
  ];

  return {
    default: {
      getAllVocabulary: vi.fn(() => mockVocabulary)
    }
  };
});

describe('QuizEngine', () => {
  let quizEngine;

  beforeEach(() => {
    quizEngine = new QuizEngine();
  });

  describe('generateQuiz', () => {
    it('should generate questions of type word_to_meaning', () => {
      quizEngine._currentType = 'word_to_meaning';
      const questions = quizEngine.generateQuiz('word_to_meaning', 3);

      expect(questions).toHaveLength(3);
      questions.forEach(q => {
        expect(q.type).toBe('word_to_meaning');
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.correctAnswer);
        expect(q.id).toBeDefined();
        expect(q.targetItemId).toBeDefined();
      });
    });

    it('should generate questions of type meaning_to_word', () => {
      quizEngine._currentType = 'meaning_to_word';
      const questions = quizEngine.generateQuiz('meaning_to_word', 3);

      expect(questions).toHaveLength(3);
      questions.forEach(q => {
        expect(q.type).toBe('meaning_to_word');
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.correctAnswer);
      });
    });

    it('should return empty array when vocabulary has fewer than 4 items', async () => {
      const { default: storageManager } = await import('../../js/modules/storage-manager.js');
      storageManager.getAllVocabulary.mockReturnValueOnce([
        { id: '1', word: 'a', meaning: 'b' },
        { id: '2', word: 'c', meaning: 'd' },
        { id: '3', word: 'e', meaning: 'f' }
      ]);

      const questions = quizEngine.generateQuiz('word_to_meaning', 5);
      expect(questions).toHaveLength(0);
    });

    it('should not generate more questions than available vocabulary', () => {
      const questions = quizEngine.generateQuiz('word_to_meaning', 100);
      // Can't have more questions than vocabulary items (6)
      expect(questions.length).toBeLessThanOrEqual(6);
    });

    it('should set prompt as the word for word_to_meaning type', () => {
      quizEngine._currentType = 'word_to_meaning';
      const questions = quizEngine.generateQuiz('word_to_meaning', 2);

      questions.forEach(q => {
        // prompt should be a word from our mock vocabulary
        const validWords = ['abandon', 'ability', 'accept', 'achieve', 'across', 'action'];
        expect(validWords).toContain(q.prompt);
      });
    });

    it('should set prompt as the meaning for meaning_to_word type', () => {
      quizEngine._currentType = 'meaning_to_word';
      const questions = quizEngine.generateQuiz('meaning_to_word', 2);

      questions.forEach(q => {
        const validMeanings = ['từ bỏ', 'khả năng', 'chấp nhận', 'đạt được', 'qua, ngang qua', 'hành động'];
        expect(validMeanings).toContain(q.prompt);
      });
    });
  });

  describe('generateDistractors', () => {
    it('should return 3 distractors for word_to_meaning', () => {
      quizEngine._currentType = 'word_to_meaning';
      const correctItem = { id: 'item_1', word: 'abandon', meaning: 'từ bỏ' };
      const distractors = quizEngine.generateDistractors(correctItem, 3);

      expect(distractors).toHaveLength(3);
      // Distractors should be meanings (Vietnamese) for word_to_meaning
      expect(distractors).not.toContain('từ bỏ');
    });

    it('should return 3 distractors for meaning_to_word', () => {
      quizEngine._currentType = 'meaning_to_word';
      const correctItem = { id: 'item_1', word: 'abandon', meaning: 'từ bỏ' };
      const distractors = quizEngine.generateDistractors(correctItem, 3);

      expect(distractors).toHaveLength(3);
      // Distractors should be words (English) for meaning_to_word
      expect(distractors).not.toContain('abandon');
    });

    it('should not include the correct item in distractors', () => {
      quizEngine._currentType = 'word_to_meaning';
      const correctItem = { id: 'item_1', word: 'abandon', meaning: 'từ bỏ' };
      const distractors = quizEngine.generateDistractors(correctItem, 3);

      expect(distractors).not.toContain('từ bỏ');
    });
  });

  describe('startSession', () => {
    it('should create a new quiz session', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('word_to_meaning');
      expect(session.questions).toHaveLength(3);
      expect(session.currentIndex).toBe(0);
      expect(session.answers).toHaveLength(0);
      expect(session.startedAt).toBeDefined();
    });

    it('should store the session as currentSession', () => {
      const session = quizEngine.startSession('meaning_to_word', 2);
      expect(quizEngine.currentSession).toBe(session);
    });

    it('should default to 10 questions when count not provided', () => {
      const session = quizEngine.startSession('word_to_meaning');
      // With only 6 vocab items, it should cap at 6
      expect(session.questions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('submitAnswer', () => {
    it('should return correct=true when answer matches correctAnswer', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);
      const question = session.questions[0];

      const result = quizEngine.submitAnswer(question.id, question.correctAnswer);

      expect(result.correct).toBe(true);
      expect(result.correctAnswer).toBe(question.correctAnswer);
      expect(result.selectedAnswer).toBe(question.correctAnswer);
    });

    it('should return correct=false when answer does not match', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);
      const question = session.questions[0];
      const wrongAnswer = question.options.find(o => o !== question.correctAnswer);

      const result = quizEngine.submitAnswer(question.id, wrongAnswer);

      expect(result.correct).toBe(false);
      expect(result.correctAnswer).toBe(question.correctAnswer);
      expect(result.selectedAnswer).toBe(wrongAnswer);
    });

    it('should record the answer in session answers array', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);
      const question = session.questions[0];

      quizEngine.submitAnswer(question.id, question.correctAnswer);

      expect(session.answers).toHaveLength(1);
      expect(session.answers[0].questionId).toBe(question.id);
      expect(session.answers[0].correct).toBe(true);
    });

    it('should increment currentIndex after each answer', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);

      quizEngine.submitAnswer(session.questions[0].id, session.questions[0].correctAnswer);
      expect(session.currentIndex).toBe(1);

      quizEngine.submitAnswer(session.questions[1].id, 'wrong');
      expect(session.currentIndex).toBe(2);
    });

    it('should throw error when no session is active', () => {
      expect(() => quizEngine.submitAnswer('q1', 'answer')).toThrow();
    });

    it('should throw error when question ID not found', () => {
      quizEngine.startSession('word_to_meaning', 3);
      expect(() => quizEngine.submitAnswer('nonexistent', 'answer')).toThrow();
    });
  });

  describe('endSession', () => {
    it('should calculate correct score and percentage', () => {
      const session = quizEngine.startSession('word_to_meaning', 4);

      // Answer 2 correctly, 2 incorrectly
      quizEngine.submitAnswer(session.questions[0].id, session.questions[0].correctAnswer);
      quizEngine.submitAnswer(session.questions[1].id, session.questions[1].correctAnswer);
      quizEngine.submitAnswer(session.questions[2].id, 'wrong');
      quizEngine.submitAnswer(session.questions[3].id, 'wrong');

      const result = quizEngine.endSession();

      expect(result.totalQuestions).toBe(4);
      expect(result.correctAnswers).toBe(2);
      expect(result.percentage).toBe(50);
      expect(result.completedAt).toBeDefined();
    });

    it('should return 100% when all answers are correct', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);

      session.questions.forEach(q => {
        quizEngine.submitAnswer(q.id, q.correctAnswer);
      });

      const result = quizEngine.endSession();

      expect(result.correctAnswers).toBe(3);
      expect(result.percentage).toBe(100);
    });

    it('should return 0% when all answers are incorrect', () => {
      const session = quizEngine.startSession('word_to_meaning', 3);

      session.questions.forEach(q => {
        quizEngine.submitAnswer(q.id, 'definitely_wrong_answer');
      });

      const result = quizEngine.endSession();

      expect(result.correctAnswers).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should clear the current session after ending', () => {
      quizEngine.startSession('word_to_meaning', 3);
      quizEngine.endSession();

      expect(quizEngine.currentSession).toBeNull();
    });

    it('should throw error when no session is active', () => {
      expect(() => quizEngine.endSession()).toThrow();
    });
  });
});
