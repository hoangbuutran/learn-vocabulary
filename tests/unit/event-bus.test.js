import { describe, it, expect, vi } from 'vitest';
import eventBus, { EventBus } from '../../js/utils/event-bus.js';

describe('EventBus', () => {
  it('exports a singleton instance', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });

  describe('on / emit', () => {
    it('calls registered listener when event is emitted', () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.on('test', handler);
      bus.emit('test', { value: 42 });
      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('supports multiple listeners for the same event', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test', handler1);
      bus.on('test', handler2);
      bus.emit('test', 'data');
      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('does not call listeners for other events', () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.on('event-a', handler);
      bus.emit('event-b', 'data');
      expect(handler).not.toHaveBeenCalled();
    });

    it('handles emit with no listeners gracefully', () => {
      const bus = new EventBus();
      expect(() => bus.emit('nonexistent', 'data')).not.toThrow();
    });
  });

  describe('off', () => {
    it('removes a specific listener', () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.on('test', handler);
      bus.off('test', handler);
      bus.emit('test', 'data');
      expect(handler).not.toHaveBeenCalled();
    });

    it('only removes the specified listener, not others', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test', handler1);
      bus.on('test', handler2);
      bus.off('test', handler1);
      bus.emit('test', 'data');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('handles off for nonexistent event gracefully', () => {
      const bus = new EventBus();
      const handler = vi.fn();
      expect(() => bus.off('nonexistent', handler)).not.toThrow();
    });

    it('handles off for unregistered callback gracefully', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test', handler1);
      expect(() => bus.off('test', handler2)).not.toThrow();
      bus.emit('test', 'data');
      expect(handler1).toHaveBeenCalledWith('data');
    });
  });
});
