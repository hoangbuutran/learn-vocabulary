/**
 * Backend configuration. Reads from environment variables with sensible
 * defaults so it runs out of the box in development.
 */
export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,

  // Allowed CORS origins (the frontend). Comma-separated env, or allow all in dev.
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['*'],

  // Max characters of recognized text we'll accept in compare requests.
  maxCompareTextLength: 500
};
