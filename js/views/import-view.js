/**
 * ImportExportView - File import (CSV, JSON, TXT) with drag-and-drop,
 * data export, and full state restore.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 12.1, 12.2, 12.3
 */
import dataImporter from '../modules/data-importer.js';
import storageManager from '../modules/storage-manager.js';

let container = null;

/** Event handler references for cleanup */
let dragOverHandler = null;
let dragLeaveHandler = null;
let dropHandler = null;

/**
 * Render the import/export view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  renderContent();
}

/**
 * Destroy the import/export view and clean up resources.
 */
export function destroy() {
  cleanupDragDrop();
  if (container) {
    container.innerHTML = '';
  }
  container = null;
}

/**
 * Render the full import/export content.
 */
function renderContent() {
  if (!container) return;

  container.innerHTML = `
    <section class="view import-view" aria-label="Nhập và xuất dữ liệu">
      <h2>Nhập / Xuất dữ liệu</h2>

      <div class="import-section" role="region" aria-label="Nhập từ vựng">
        <h3>Nhập từ vựng</h3>
        <div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Kéo thả file hoặc nhấn để chọn file">
          <div class="drop-zone-content">
            <span class="drop-icon">📂</span>
            <p>Kéo thả file CSV, JSON hoặc TXT vào đây</p>
            <p class="drop-hint">hoặc nhấn để chọn file</p>
          </div>
          <input type="file" id="file-input" accept=".csv,.json,.txt" class="file-input-hidden" aria-label="Chọn file" />
        </div>

        <div class="format-instructions">
          <h4>Định dạng hỗ trợ:</h4>
          <ul>
            <li><strong>CSV:</strong> word,meaning,example,pronunciation (phân cách bằng dấu phẩy)</li>
            <li><strong>JSON:</strong> Mảng hoặc đối tượng có trường "items" với các mục {word, meaning, examples, pronunciation}</li>
            <li><strong>TXT:</strong> word&lt;tab&gt;meaning&lt;tab&gt;example&lt;tab&gt;pronunciation (phân cách bằng tab hoặc |)</li>
          </ul>
          <p class="format-note"><em>Trường pronunciation là tùy chọn. Ít nhất cần có word và meaning.</em></p>
        </div>

        <div class="import-results" id="import-results" aria-live="polite"></div>
      </div>

      <div class="export-section" role="region" aria-label="Xuất và khôi phục dữ liệu">
        <h3>Xuất / Khôi phục dữ liệu</h3>
        <div class="export-actions">
          <button class="btn btn-primary" id="btn-export" aria-label="Xuất dữ liệu dưới dạng JSON">
            📥 Xuất dữ liệu (JSON)
          </button>
          <div class="restore-section">
            <label for="restore-input" class="btn btn-secondary" role="button" aria-label="Khôi phục từ file JSON">
              📤 Khôi phục từ file JSON
            </label>
            <input type="file" id="restore-input" accept=".json" class="file-input-hidden" aria-label="Chọn file JSON để khôi phục" />
          </div>
        </div>
        <div class="restore-results" id="restore-results" aria-live="polite"></div>
      </div>
    </section>
  `;

  setupListeners();
}

/**
 * Set up all event listeners.
 */
function setupListeners() {
  if (!container) return;

  const dropZone = container.querySelector('#drop-zone');
  const fileInput = container.querySelector('#file-input');
  const exportBtn = container.querySelector('#btn-export');
  const restoreInput = container.querySelector('#restore-input');

  // Drop zone click triggers file input
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Drag and drop handlers
    dragOverHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    };

    dragLeaveHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    };

    dropHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileImport(files[0]);
      }
    };

    dropZone.addEventListener('dragover', dragOverHandler);
    dropZone.addEventListener('dragleave', dragLeaveHandler);
    dropZone.addEventListener('drop', dropHandler);
  }

  // File input change
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileImport(e.target.files[0]);
        e.target.value = ''; // Reset for re-upload
      }
    });
  }

  // Export button
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }

  // Restore input
  if (restoreInput) {
    restoreInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleRestore(e.target.files[0]);
        e.target.value = '';
      }
    });
  }
}

/**
 * Handle importing a vocabulary file.
 * @param {File} file - The file to import
 */
async function handleFileImport(file) {
  const resultsEl = container && container.querySelector('#import-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<p class="loading">Đang xử lý file...</p>';

  const result = await dataImporter.importFile(file);
  displayImportResults(resultsEl, result);
}

/**
 * Display import results.
 * @param {HTMLElement} el - Container for results
 * @param {object} result - ImportResult object
 */
function displayImportResults(el, result) {
  if (!el) return;

  let html = '';

  if (result.success) {
    html += `<div class="result-success">
      <p>✓ Nhập thành công <strong>${result.importedCount}</strong> từ vựng.</p>
    </div>`;
  } else {
    html += `<div class="result-error">
      <p>✗ Không thể nhập dữ liệu.</p>
    </div>`;
  }

  if (result.warnings && result.warnings.length > 0) {
    html += `<div class="result-warnings">
      <p><strong>Cảnh báo:</strong></p>
      <ul>${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
    </div>`;
  }

  if (result.errors && result.errors.length > 0) {
    html += `<div class="result-errors">
      <p><strong>Lỗi:</strong></p>
      <ul>${result.errors.slice(0, 10).map(e => `<li>${e.message}</li>`).join('')}</ul>
      ${result.errors.length > 10 ? `<p><em>...và ${result.errors.length - 10} lỗi khác</em></p>` : ''}
    </div>`;
  }

  el.innerHTML = html;
}

/**
 * Handle exporting all app data as JSON.
 */
function handleExport() {
  const exportData = storageManager.exportAllData();
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `vocabulary-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Handle restoring app data from a JSON backup file.
 * @param {File} file - JSON file to restore from
 */
async function handleRestore(file) {
  const resultsEl = container && container.querySelector('#restore-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<p class="loading">Đang khôi phục dữ liệu...</p>';

  try {
    const content = await readFileAsText(file);
    const data = JSON.parse(content);
    const result = storageManager.importData(data);

    if (result.success) {
      resultsEl.innerHTML = `<div class="result-success">
        <p>✓ Khôi phục thành công <strong>${result.importedCount}</strong> từ vựng.</p>
      </div>`;
    } else {
      let html = `<div class="result-error"><p>✗ Không thể khôi phục dữ liệu.</p></div>`;
      if (result.errors && result.errors.length > 0) {
        html += `<ul>${result.errors.map(e => `<li>${e.message}</li>`).join('')}</ul>`;
      }
      resultsEl.innerHTML = html;
    }
  } catch (err) {
    resultsEl.innerHTML = `<div class="result-error">
      <p>✗ File JSON không hợp lệ. Vui lòng chọn file xuất từ ứng dụng.</p>
    </div>`;
  }
}

/**
 * Read a file as text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsText(file);
  });
}

/**
 * Clean up drag/drop event handlers.
 */
function cleanupDragDrop() {
  if (!container) return;
  const dropZone = container.querySelector('#drop-zone');
  if (dropZone) {
    if (dragOverHandler) dropZone.removeEventListener('dragover', dragOverHandler);
    if (dragLeaveHandler) dropZone.removeEventListener('dragleave', dragLeaveHandler);
    if (dropHandler) dropZone.removeEventListener('drop', dropHandler);
  }
  dragOverHandler = null;
  dragLeaveHandler = null;
  dropHandler = null;
}
