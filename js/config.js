/**
 * Frontend configuration.
 *
 * API_BASE points to the optional backend (see /server). When the backend is
 * not running, features that need it (e.g. auto-fetching YouTube transcripts)
 * degrade gracefully — the app still works fully offline without it.
 *
 * Change this to your deployed backend URL in production.
 */
export const API_BASE = 'http://localhost:3001';

/** Whether a backend base URL is configured at all. */
export const HAS_BACKEND = typeof API_BASE === 'string' && API_BASE.length > 0;
