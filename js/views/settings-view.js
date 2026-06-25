/**
 * SettingsView - App settings: dark mode, accent, daily words, auto-play.
 * Persists settings via StorageManager and applies theme immediately.
 * Requirements: 8.2, 8.3, 4.3, 10.1
 */
import storageManager from '../modules/storage-manager.js';
import speechModule from '../modules/speech-module.js';

let container = null;

/**
 * Render the settings view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  renderContent();
}

/**
 * Destroy the settings view and clean up resources.
 */
export function destroy() {
  if (container) {
    container.innerHTML = '';
  }
  container = null;
}

/**
 * Render the full settings form.
 */
function renderContent() {
  if (!container) return;

  const settings = storageManager.getSettings();

  container.innerHTML = `
    <section class="view settings-view" aria-label="Cài đặt">
      <h2>Cài đặt</h2>

      <div class="settings-form">
        <div class="setting-group" role="group" aria-labelledby="theme-label">
          <label id="theme-label" class="setting-label" for="toggle-dark-mode">Chế độ tối</label>
          <div class="toggle-switch">
            <input type="checkbox" id="toggle-dark-mode" class="toggle-input" ${settings.theme === 'dark' ? 'checked' : ''} aria-label="Bật/tắt chế độ tối" />
            <label for="toggle-dark-mode" class="toggle-slider"></label>
          </div>
        </div>

        <div class="setting-group" role="group" aria-labelledby="accent-label">
          <span id="accent-label" class="setting-label">Giọng phát âm</span>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="accent" value="en-US" ${settings.accent === 'en-US' ? 'checked' : ''} aria-label="Giọng Mỹ" />
              <span>Giọng Mỹ (American English)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="accent" value="en-GB" ${settings.accent === 'en-GB' ? 'checked' : ''} aria-label="Giọng Anh" />
              <span>Giọng Anh (British English)</span>
            </label>
          </div>
        </div>

        <div class="setting-group" role="group" aria-labelledby="daily-count-label">
          <label id="daily-count-label" class="setting-label" for="daily-word-count">Số từ mỗi ngày</label>
          <input type="number" id="daily-word-count" class="setting-input" min="1" max="50" value="${settings.dailyWordCount}" aria-label="Số từ học mỗi ngày" />
        </div>

        <div class="setting-group" role="group" aria-labelledby="autoplay-label">
          <label id="autoplay-label" class="setting-label" for="toggle-autoplay">Tự động phát âm</label>
          <div class="toggle-switch">
            <input type="checkbox" id="toggle-autoplay" class="toggle-input" ${settings.autoPlayPronunciation ? 'checked' : ''} aria-label="Bật/tắt tự động phát âm" />
            <label for="toggle-autoplay" class="toggle-slider"></label>
          </div>
        </div>
      </div>
    </section>
  `;

  setupListeners();
}

/**
 * Set up event listeners for settings controls.
 */
function setupListeners() {
  if (!container) return;

  const darkModeToggle = container.querySelector('#toggle-dark-mode');
  const accentRadios = container.querySelectorAll('input[name="accent"]');
  const dailyWordInput = container.querySelector('#daily-word-count');
  const autoplayToggle = container.querySelector('#toggle-autoplay');

  // Dark mode toggle
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      const settings = storageManager.getSettings();
      settings.theme = e.target.checked ? 'dark' : 'light';
      storageManager.saveSettings(settings);
      applyThemeImmediately(settings.theme);
    });
  }

  // Accent radio buttons
  accentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const settings = storageManager.getSettings();
      settings.accent = e.target.value;
      storageManager.saveSettings(settings);
      speechModule.setAccent(settings.accent);
    });
  });

  // Daily word count
  if (dailyWordInput) {
    dailyWordInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (value >= 1 && value <= 50) {
        const settings = storageManager.getSettings();
        settings.dailyWordCount = value;
        storageManager.saveSettings(settings);
      } else {
        // Reset to stored value if invalid
        e.target.value = storageManager.getSettings().dailyWordCount;
      }
    });
  }

  // Auto-play pronunciation toggle
  if (autoplayToggle) {
    autoplayToggle.addEventListener('change', (e) => {
      const settings = storageManager.getSettings();
      settings.autoPlayPronunciation = e.target.checked;
      storageManager.saveSettings(settings);
    });
  }
}

/**
 * Apply theme change immediately to the document.
 * @param {'light'|'dark'} theme
 */
function applyThemeImmediately(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}
