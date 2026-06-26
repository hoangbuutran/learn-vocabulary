/**
 * Helpers - Utility functions for the English Vocabulary App.
 * All user-facing messages are in Vietnamese.
 */

/**
 * Generate a unique ID using crypto.randomUUID if available,
 * otherwise falls back to timestamp + random string.
 * @returns {string} Unique identifier
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format a date to a locale-friendly string (Vietnamese locale).
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Standard debounce utility.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Show an error toast notification.
 * @param {string} message - Error message (Vietnamese)
 * @param {number} [duration=3000] - Duration in milliseconds
 */
export function showError(message, duration = 3000) {
  showToast(message, 'error', duration);
}

/**
 * Show a warning toast notification.
 * @param {string} message - Warning message (Vietnamese)
 * @param {number} [duration=3000] - Duration in milliseconds
 */
export function showWarning(message, duration = 3000) {
  showToast(message, 'warning', duration);
}

/**
 * Show a success toast notification.
 * @param {string} message - Success message (Vietnamese)
 * @param {number} [duration=3000] - Duration in milliseconds
 */
export function showSuccess(message, duration = 3000) {
  showToast(message, 'success', duration);
}

/**
 * Internal helper to create and display a toast notification.
 * @param {string} message - Notification message
 * @param {'error'|'warning'|'success'} type - Toast type
 * @param {number} duration - Duration before auto-removal in ms
 */
function showToast(message, type, duration) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duration);
}

/**
 * Escape HTML special characters to prevent broken markup / injection.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a vocabulary item's examples as HTML.
 * Supports both the new format ({ en, vi }) and the legacy plain-string format.
 * Returns '' when there are no examples.
 * @param {Array} examples
 * @returns {string} HTML string
 */
export function renderExamples(examples) {
  if (!Array.isArray(examples) || examples.length === 0) return '';

  const rows = examples.map(ex => {
    if (ex && typeof ex === 'object') {
      const en = escapeHtml(ex.en || '');
      const vi = escapeHtml(ex.vi || '');
      if (!en) return '';
      return `<li class="example-item">
        <span class="example-en">${en}</span>
        ${vi ? `<span class="example-vi">${vi}</span>` : ''}
      </li>`;
    }
    // legacy: plain string
    return `<li class="example-item"><span class="example-en">${escapeHtml(ex)}</span></li>`;
  }).filter(Boolean).join('');

  if (!rows) return '';
  return `<div class="examples">
    <p class="example-label">Ví dụ:</p>
    <ul>${rows}</ul>
  </div>`;
}
