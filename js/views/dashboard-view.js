/**
 * DashboardView - Displays learning statistics, review reminders, and daily progress.
 * Listens to progress:updated and review:due events for real-time updates.
 * Requirements: 6.1, 6.2, 6.3, 11.4
 */
import memorySystem from '../modules/memory-system.js';
import spacedRepetitionEngine from '../modules/spaced-repetition.js';
import eventBus from '../utils/event-bus.js';

let container = null;

/** Event handler references for cleanup */
let onProgressUpdated = null;
let onReviewDue = null;

/**
 * Render the dashboard view into the given container element.
 * @param {HTMLElement} el - Container element to render into
 */
export function render(el) {
  container = el;
  renderContent();
  setupEventListeners();
}

/**
 * Destroy the dashboard view and clean up resources.
 */
export function destroy() {
  if (onProgressUpdated) {
    eventBus.off('progress:updated', onProgressUpdated);
    onProgressUpdated = null;
  }
  if (onReviewDue) {
    eventBus.off('review:due', onReviewDue);
    onReviewDue = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  container = null;
}

/**
 * Render the full dashboard content.
 */
function renderContent() {
  if (!container) return;

  const stats = memorySystem.getStats();
  const dailyProgress = memorySystem.getDailyProgress();
  const dueItems = spacedRepetitionEngine.getItemsDueForReview();
  const dueCount = dueItems.length;

  container.innerHTML = `
    <section class="view dashboard-view" aria-label="Trang chủ">
      <h2>Trang chủ</h2>

      <div class="stats-cards" role="region" aria-label="Thống kê học tập">
        <div class="stat-card" aria-label="Tổng số từ">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">Tổng số từ</span>
        </div>
        <div class="stat-card" aria-label="Đã nhớ">
          <span class="stat-value">${stats.remembered}</span>
          <span class="stat-label">Đã nhớ</span>
        </div>
        <div class="stat-card" aria-label="Cần ôn tập">
          <span class="stat-value">${dueCount}</span>
          <span class="stat-label">Cần ôn tập</span>
        </div>
        <div class="stat-card" aria-label="Tiến độ">
          <span class="stat-value">${stats.progressPercentage.toFixed(1)}%</span>
          <span class="stat-label">Tiến độ</span>
        </div>
      </div>

      <div class="review-reminder" role="region" aria-label="Nhắc nhở ôn tập">
        <h3>Nhắc nhở ôn tập</h3>
        ${dueCount > 0
          ? `<p class="reminder-text">Bạn có <strong>${dueCount}</strong> từ cần ôn tập hôm nay.</p>
             <a href="#review" class="btn btn-primary" role="button">Bắt đầu ôn tập</a>`
          : `<p class="reminder-text">Không có từ nào cần ôn tập hôm nay. Tuyệt vời!</p>`
        }
      </div>

      <div class="daily-progress" role="region" aria-label="Tiến độ hôm nay">
        <h3>Tiến độ hôm nay</h3>
        <div class="daily-stats">
          <p>Đã học: <strong>${dailyProgress.studiedToday}</strong> từ</p>
          <p>Đã nhớ: <strong>${dailyProgress.rememberedToday}</strong> từ</p>
        </div>
      </div>
    </section>
  `;
}

/**
 * Set up event listeners for real-time updates.
 */
function setupEventListeners() {
  onProgressUpdated = () => {
    renderContent();
  };
  onReviewDue = () => {
    renderContent();
  };
  eventBus.on('progress:updated', onProgressUpdated);
  eventBus.on('review:due', onReviewDue);
}
