/**
 * SettingsView - App settings: dark mode, accent, daily words, auto-play.
 * Persists settings via StorageManager and applies theme immediately.
 * Requirements: 8.2, 8.3, 4.3, 10.1
 */
import storageManager from '../modules/storage-manager.js';
import speechModule from '../modules/speech-module.js';
import eventBus from '../utils/event-bus.js';
import { showSuccess, showError } from '../utils/helpers.js';

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

        <div class="setting-group" role="group" aria-labelledby="vocabset-label">
          <span id="vocabset-label" class="setting-label">Bộ từ vựng</span>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="vocabset" value="a1-a2" ${settings.vocabularySet === 'a1-a2' ? 'checked' : ''} aria-label="Bộ 1000 từ A1-A2" />
              <span>1000 từ cơ bản (A1-A2)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="vocabset" value="essential-3000" ${settings.vocabularySet === 'essential-3000' ? 'checked' : ''} aria-label="Bộ 3000 từ" />
              <span>3000 từ thông dụng</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="vocabset" value="all" ${(settings.vocabularySet === 'all' || !settings.vocabularySet) ? 'checked' : ''} aria-label="Tất cả các từ" />
              <span>Tất cả</span>
            </label>
          </div>
          <p class="setting-hint">Chọn bộ từ muốn học. Đổi bộ sẽ làm mới phiên học hiện tại.</p>
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

        <div class="setting-group" role="group" aria-labelledby="audio-label">
          <div>
            <span id="audio-label" class="setting-label">Tải audio để dùng offline</span>
            <p class="setting-hint">Tải sẵn toàn bộ file phát âm (~70-90MB) để nghe được khi mất mạng. Nên bấm khi đang dùng wifi.</p>
            <div class="audio-dl-status" id="audio-dl-status"></div>
          </div>
          <button class="btn btn-secondary" id="btn-download-audio" aria-label="Tải audio offline">
            📥 Tải audio
          </button>
        </div>

        <div class="setting-group" role="group" aria-labelledby="reload-label">
          <div>
            <span id="reload-label" class="setting-label">Dữ liệu từ vựng</span>
            <p class="setting-hint">Tải lại toàn bộ từ vựng gốc (giữ nguyên tiến độ học).</p>
          </div>
          <button class="btn btn-secondary" id="btn-reload-data" aria-label="Tải lại dữ liệu gốc">
            Tải lại dữ liệu
          </button>
        </div>

        <div class="setting-group setting-group-danger" role="group" aria-labelledby="clear-label">
          <div>
            <span id="clear-label" class="setting-label">Xóa toàn bộ dữ liệu</span>
            <p class="setting-hint">Xóa sạch tiến độ, cài đặt và phiên học — như mở app lần đầu. Không thể hoàn tác!</p>
          </div>
          <button class="btn btn-danger" id="btn-clear-data" aria-label="Xóa toàn bộ dữ liệu">
            Xóa hết & tải lại
          </button>
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

  // Vocabulary set radio buttons
  const vocabSetRadios = container.querySelectorAll('input[name="vocabset"]');
  vocabSetRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const settings = storageManager.getSettings();
      settings.vocabularySet = e.target.value;
      storageManager.saveSettings(settings);

      // Reset the fixed flashcard batch so it pulls from the newly chosen set.
      try { localStorage.removeItem('flashcard_session'); } catch (_) { /* ignore */ }

      const labels = {
        'a1-a2': '1000 từ cơ bản (A1-A2)',
        'essential-3000': '3000 từ thông dụng',
        'all': 'Tất cả'
      };
      const count = storageManager.getActiveVocabulary().length;
      showSuccess(`Đã chuyển sang "${labels[e.target.value]}" (${count} từ).`);
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

  // Reload pre-generated data
  const reloadBtn = container.querySelector('#btn-reload-data');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      reloadBtn.textContent = 'Đang tải...';
      try {
        await storageManager.reloadPreGeneratedData();
        const count = storageManager.getAllVocabulary().length;
        eventBus.emit('vocab:imported', { count });
        showSuccess(`Đã tải lại ${count} từ vựng.`);
      } catch (err) {
        showError('Không thể tải lại dữ liệu. Vui lòng thử lại.');
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.textContent = 'Tải lại dữ liệu';
      }
    });
  }

  // Clear ALL data and reload from scratch (like a first-time visit).
  const clearBtn = container.querySelector('#btn-clear-data');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ok = window.confirm(
        'Xóa toàn bộ dữ liệu? Mọi tiến độ học, cài đặt và phiên học sẽ bị xóa. Hành động này không thể hoàn tác.'
      );
      if (!ok) return;
      try {
        localStorage.clear();
      } catch (_) { /* ignore */ }
      // Reload the page so the app re-initializes from a clean state.
      window.location.reload();
    });
  }

  // Download all audio for offline use.
  const dlBtn = container.querySelector('#btn-download-audio');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => downloadAllAudio(dlBtn));
  }
}

/**
 * Fetch every audio file referenced by the manifests so the Service Worker
 * caches them, enabling fully offline pronunciation. Shows live progress.
 * @param {HTMLButtonElement} btn
 */
async function downloadAllAudio(btn) {
  const statusEl = container && container.querySelector('#audio-dl-status');
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Đang tải...';
  setStatus('Đang chuẩn bị danh sách...');

  // Build the list of audio URLs from both manifests.
  const urls = [];
  try {
    const wordRes = await fetch('assets/audio/manifest.json');
    if (wordRes.ok) {
      const m = await wordRes.json();
      for (const file of Object.values(m)) {
        if (file) urls.push('assets/audio/' + file);
      }
    }
  } catch (_) { /* ignore */ }
  try {
    const ipaRes = await fetch('assets/audio/ipa/manifest.json');
    if (ipaRes.ok) {
      const m = await ipaRes.json();
      for (const file of Object.values(m)) {
        if (file) urls.push('assets/audio/ipa/' + file);
      }
    }
  } catch (_) { /* ignore */ }

  if (urls.length === 0) {
    setStatus('Không tìm thấy file audio nào.');
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }

  let done = 0, failed = 0;
  const total = urls.length;
  const CONCURRENCY = 6;
  let idx = 0;

  const worker = async () => {
    while (idx < urls.length) {
      const myUrl = urls[idx++];
      try {
        // GET so the Service Worker's fetch handler caches it.
        const r = await fetch(myUrl);
        if (!r.ok) failed++;
      } catch (_) {
        failed++;
      }
      done++;
      if (done % 15 === 0 || done === total) {
        setStatus(`Đã tải ${done}/${total}${failed ? ` (lỗi ${failed})` : ''}...`);
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setStatus(`✓ Hoàn tất! Đã lưu ${done - failed}/${total} file. Giờ có thể nghe offline.`);
    showSuccess('Đã tải xong audio. Bạn có thể dùng offline.');
  } catch (e) {
    setStatus('Có lỗi khi tải. Vui lòng thử lại khi mạng ổn định.');
    showError('Tải audio chưa hoàn tất. Thử lại khi có wifi.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
