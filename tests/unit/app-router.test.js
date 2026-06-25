/**
 * Unit tests for the app router (js/app.js).
 * Tests hash-based routing, view lifecycle, and navigation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock storage-manager module
vi.mock('../../js/modules/storage-manager.js', () => ({
  default: {
    isFirstRun: vi.fn(() => false),
    loadPreGeneratedData: vi.fn(() => Promise.resolve()),
    getSettings: vi.fn(() => ({
      theme: 'light',
      accent: 'en-US',
      dailyWordCount: 10,
      autoPlayPronunciation: false
    }))
  }
}));

// Mock event-bus module
vi.mock('../../js/utils/event-bus.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

// Mock view modules
vi.mock('../../js/views/dashboard-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../../js/views/flashcard-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../../js/views/quiz-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../../js/views/import-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../../js/views/review-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../../js/views/settings-view.js', () => ({
  render: vi.fn(),
  destroy: vi.fn()
}));

describe('App Router', () => {
  let navigateTo, getCurrentRoute, applyTheme, routes, DEFAULT_ROUTE;

  beforeEach(async () => {
    // Set up DOM
    document.body.innerHTML = `
      <header class="app-header">
        <nav class="app-nav">
          <ul class="nav-list">
            <li><a href="#dashboard" class="nav-link active" data-view="dashboard">Trang chủ</a></li>
            <li><a href="#flashcard" class="nav-link" data-view="flashcard">Flashcard</a></li>
            <li><a href="#quiz" class="nav-link" data-view="quiz">Trắc nghiệm</a></li>
            <li><a href="#review" class="nav-link" data-view="review">Ôn tập</a></li>
            <li><a href="#import" class="nav-link" data-view="import">Nhập/Xuất</a></li>
            <li><a href="#settings" class="nav-link" data-view="settings">Cài đặt</a></li>
          </ul>
        </nav>
        <button class="nav-toggle" aria-label="Mở menu" aria-expanded="false">
          <span class="nav-toggle-icon">☰</span>
        </button>
      </header>
      <main id="app-content" class="app-content"></main>
    `;

    // Reset hash
    window.location.hash = '';

    // Import the module (re-imports to pick up mocks)
    const appModule = await import('../../js/app.js');
    navigateTo = appModule.navigateTo;
    getCurrentRoute = appModule.getCurrentRoute;
    applyTheme = appModule.applyTheme;
    routes = appModule.routes;
    DEFAULT_ROUTE = appModule.DEFAULT_ROUTE;
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  describe('getCurrentRoute', () => {
    it('returns default route when no hash is set', () => {
      window.location.hash = '';
      expect(getCurrentRoute()).toBe('#dashboard');
    });

    it('returns the hash when it matches a valid route', () => {
      window.location.hash = '#flashcard';
      expect(getCurrentRoute()).toBe('#flashcard');
    });

    it('returns default route for unknown hash', () => {
      window.location.hash = '#nonexistent';
      expect(getCurrentRoute()).toBe('#dashboard');
    });
  });

  describe('routes configuration', () => {
    it('has all 6 routes defined', () => {
      expect(Object.keys(routes)).toHaveLength(6);
    });

    it('maps correct hash fragments', () => {
      expect(routes['#dashboard']).toBeDefined();
      expect(routes['#flashcard']).toBeDefined();
      expect(routes['#quiz']).toBeDefined();
      expect(routes['#review']).toBeDefined();
      expect(routes['#import']).toBeDefined();
      expect(routes['#settings']).toBeDefined();
    });

    it('has default route set to #dashboard', () => {
      expect(DEFAULT_ROUTE).toBe('#dashboard');
    });
  });

  describe('applyTheme', () => {
    it('adds dark-theme class when theme is dark', async () => {
      const { default: storageManager } = await import('../../js/modules/storage-manager.js');
      storageManager.getSettings.mockReturnValue({ theme: 'dark' });

      applyTheme();
      expect(document.body.classList.contains('dark-theme')).toBe(true);
    });

    it('removes dark-theme class when theme is light', async () => {
      document.body.classList.add('dark-theme');
      const { default: storageManager } = await import('../../js/modules/storage-manager.js');
      storageManager.getSettings.mockReturnValue({ theme: 'light' });

      applyTheme();
      expect(document.body.classList.contains('dark-theme')).toBe(false);
    });
  });

  describe('navigateTo', () => {
    it('renders the target view when called after init dispatches DOMContentLoaded', async () => {
      const dashboardView = await import('../../js/views/dashboard-view.js');

      // Trigger DOMContentLoaded to initialize appContent
      document.dispatchEvent(new Event('DOMContentLoaded'));
      // Wait for async init
      await new Promise(resolve => setTimeout(resolve, 50));

      dashboardView.render.mockClear();
      navigateTo('#dashboard');
      expect(dashboardView.render).toHaveBeenCalledWith(document.getElementById('app-content'));
    });

    it('destroys previous view before rendering new one', async () => {
      const dashboardView = await import('../../js/views/dashboard-view.js');
      const flashcardView = await import('../../js/views/flashcard-view.js');

      // Trigger init
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 50));

      dashboardView.render.mockClear();
      navigateTo('#dashboard');
      navigateTo('#flashcard');

      expect(dashboardView.destroy).toHaveBeenCalled();
      expect(flashcardView.render).toHaveBeenCalled();
    });

    it('defaults to dashboard for unknown route', async () => {
      const dashboardView = await import('../../js/views/dashboard-view.js');

      // Trigger init
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 50));

      dashboardView.render.mockClear();
      navigateTo('#unknown');
      expect(dashboardView.render).toHaveBeenCalled();
    });

    it('updates active nav link', async () => {
      // Trigger init
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 50));

      navigateTo('#quiz');
      const activeLink = document.querySelector('.nav-link.active');
      expect(activeLink.getAttribute('href')).toBe('#quiz');
    });

    it('removes active class from previous nav link', async () => {
      // Trigger init
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 50));

      navigateTo('#flashcard');
      const links = document.querySelectorAll('.nav-link.active');
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toBe('#flashcard');
    });
  });

  describe('mobile navigation', () => {
    it('toggles nav-open class on toggle button click after init', async () => {
      // Trigger init so setupMobileNav runs
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 50));

      const navToggle = document.querySelector('.nav-toggle');
      const appNav = document.querySelector('.app-nav');

      navToggle.click();
      expect(appNav.classList.contains('nav-open')).toBe(true);
      expect(navToggle.getAttribute('aria-expanded')).toBe('true');

      navToggle.click();
      expect(appNav.classList.contains('nav-open')).toBe(false);
      expect(navToggle.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
