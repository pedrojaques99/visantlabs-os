/**
 * Deterministic test env vars.
 *
 * Loaded by tests/setup.ts before any server module imports so that
 * route files see these values at module evaluation time.
 */
export const TEST_JWT_SECRET = 'test-jwt-secret-deterministic-do-not-use-in-prod';
export const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_test_deterministic';
export const TEST_GEMINI_API_KEY = 'test-gemini-key';

export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_WEBHOOK_SECRET;
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test-google-client';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test-google-secret';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? TEST_GEMINI_API_KEY;
  process.env.FRONTEND_URL = 'http://localhost:3000';
  // Satisfy env.ts fail-fast. Integration tests overwrite with the real
  // in-memory Mongo URI once startTestMongo() runs; unit tests just need the
  // validator to accept boot.
  process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://test-placeholder/visant-test';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
  process.env.TELEMETRY_SINK = process.env.TELEMETRY_SINK ?? 'memory';
}
