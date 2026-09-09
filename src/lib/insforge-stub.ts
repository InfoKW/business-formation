/**
 * Stub for @insforge/sdk used during local mock-mode development (MOCK_DB=true).
 *
 * This module is wired in via the webpack alias in next.config.ts.
 * createClient() should NEVER be called in mock mode — all API routes
 * return early via isMockMode() before reaching any Insforge call.
 *
 * If this error fires at runtime, you either forgot to set MOCK_DB=true
 * or there's a code path that bypasses the mock check.
 */
export function createClient(_config: unknown) {
  throw new Error(
    '[insforge-stub] createClient() was called in MOCK_DB mode. ' +
    'This should never happen — all routes should return early via isMockMode(). ' +
    'Check for a missing mock-mode guard in an API route or server component.',
  )
}
