/**
 * App Router and Shell - Entry point for the English Vocabulary App.
 * Implements hash-based routing, module initialization, and navigation.
 */

// Core modules
import storageManager from './modules/storage-manager.js';
import eventBus from './utils/event-bus.js';

// View modules
import * as dashboardView from './views/dashboard-view.js';
import * as flashcardView from './views/flashcard-view.js';
import * as quizView from './views/quiz-view.js';
import * as matchView from './views/match-view.js';
import * as importView from './views/import-view.js';
import * as reviewView from './views/review-view.js';
import * as settingsView from './views/settings-view.js';

// --- Route Configuration ---

const routes = {
  '#dashboard': dashboardView,
  '#flashcard': flashcardView,
  '#quiz': quizView,
  '#match': matchView,
  '#review': reviewView,
  '#import': importView,
  '#settings': settingsView
};

const DEFAULT_ROUTE = '#dashboard';

// --- Router State ---

let currentView = null;
let appContent = null;

// --- Router ---

/**
 * Get the current hash route, defaulting to dashboard.
 * @returns {string} Current hash or default route
 */
function getCurrentRoute() {
  const hash = window.location.hash || DEFAULT_ROUTE;
  return routes[hash] ? hash : DEFAULT_ROUTE;
}

/**
 * Navigate to a hash route. Destroys the current view and renders the new one.
 * @param {string} hash - Target route hash
 */
function navigateTo(hash) {
  if (!routes[hash]) {
    hash = DEFAULT_ROUTE;
  }

  // Destroy current view
  if (currentView && currentView.destroy) {
    currentView.destroy();
  }

  // Render new view
  currentView = routes[hash];
  if (currentView && currentView.render) {
    currentView.render(appContent);
  }

  // Update active nav link
  updateActiveNav(hash);
}

/**
 * Update the active state on navigation links.
 * @param {string} activeHash - The currently active route hash
 */
function updateActiveNav(activeHash) {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === activeHash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/**
 * Handle hashchange events for route navigation.
 */
function onHashChange() {
  const route = getCurrentRoute();
  navigateTo(route);
}

// --- Theme ---

/**
 * Apply the saved theme setting (dark/light mode).
 */
function applyTheme() {
  const settings = storageManager.getSettings();
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// --- Mobile Navigation ---

/**
 * Set up the mobile nav toggle button behavior.
 */
function setupMobileNav() {
  const navToggle = document.querySelector('.nav-toggle');
  const appNav = document.querySelector('.app-nav');

  if (navToggle && appNav) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isExpanded));
      appNav.classList.toggle('nav-open');
    });

    // Close mobile nav when a link is clicked
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        appNav.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

// --- First Run ---

/**
 * Load pre-generated vocabulary data on first run.
 */
async function handleFirstRun() {
  if (storageManager.isFirstRun()) {
    await storageManager.loadPreGeneratedData();
  }
}

// --- Event Listeners ---

/**
 * Listen for theme changes from settings and apply immediately.
 */
function setupEventListeners() {
  eventBus.on('settings:changed', (settings) => {
    if (settings && settings.theme) {
      applyTheme();
    }
  });
}

// --- Initialization ---

/**
 * Initialize the application on DOMContentLoaded.
 */
async function init() {
  appContent = document.getElementById('app-content');

  if (!appContent) {
    console.error('App content container not found');
    return;
  }

  // Apply saved theme
  applyTheme();

  // Set up mobile navigation
  setupMobileNav();

  // Set up event listeners
  setupEventListeners();

  // Handle first-run data loading
  await handleFirstRun();

  // Listen for hash changes
  window.addEventListener('hashchange', onHashChange);

  // Navigate to current route (or default)
  const initialRoute = getCurrentRoute();
  if (window.location.hash !== initialRoute) {
    window.location.hash = initialRoute;
  } else {
    navigateTo(initialRoute);
  }
}

document.addEventListener('DOMContentLoaded', init);

// Export for testing
export { navigateTo, getCurrentRoute, applyTheme, routes, DEFAULT_ROUTE };
