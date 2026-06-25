import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateId,
  formatDate,
  debounce,
  showError,
  showWarning,
  showSuccess
} from '../../js/utils/helpers.js';

describe('helpers', () => {
  describe('generateId', () => {
    it('should return a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should return unique IDs on consecutive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('formatDate', () => {
    it('should format a Date object in Vietnamese locale (dd/mm/yyyy)', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      const result = formatDate(date);
      expect(result).toContain('15');
      expect(result).toContain('01');
      expect(result).toContain('2024');
    });

    it('should accept an ISO date string', () => {
      const result = formatDate('2024-06-01T00:00:00.000Z');
      expect(result).toContain('2024');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution by the specified delay', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset the delay if called again within the delay window', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced();
      vi.advanceTimersByTime(100);
      debounced();
      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('toast notifications', () => {
    let container;

    beforeEach(() => {
      vi.useFakeTimers();
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    });

    afterEach(() => {
      vi.useRealTimers();
      container.remove();
    });

    it('showError should add an error toast to the container', () => {
      showError('Có lỗi xảy ra');
      const toast = container.querySelector('.toast-error');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Có lỗi xảy ra');
    });

    it('showWarning should add a warning toast to the container', () => {
      showWarning('Cảnh báo dung lượng');
      const toast = container.querySelector('.toast-warning');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Cảnh báo dung lượng');
    });

    it('showSuccess should add a success toast to the container', () => {
      showSuccess('Nhập dữ liệu thành công');
      const toast = container.querySelector('.toast-success');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Nhập dữ liệu thành công');
    });

    it('toast should auto-remove after the default duration (3000ms)', () => {
      showSuccess('Thành công');
      expect(container.children.length).toBe(1);

      vi.advanceTimersByTime(3000);
      expect(container.children.length).toBe(0);
    });

    it('toast should auto-remove after a custom duration', () => {
      showError('Lỗi', 1000);
      expect(container.children.length).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(container.children.length).toBe(0);
    });

    it('should not throw if toast-container is missing', () => {
      container.remove();
      expect(() => showError('Test')).not.toThrow();
    });

    it('toast should have role="alert" for accessibility', () => {
      showSuccess('Thông báo');
      const toast = container.querySelector('.toast');
      expect(toast.getAttribute('role')).toBe('alert');
    });
  });
});
