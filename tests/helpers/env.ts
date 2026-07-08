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
  // Force deterministic Stripe config — tests must never use the developer's
  // real key from .env (MSW mocks api.stripe.com; see tests/mocks/stripe-api.ts)
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_PRICE_ID_USD = 'price_test_usd';
  process.env.STRIPE_PRICE_ID_BRL = 'price_test_brl';
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
  // Tests must not inherit captcha config from the developer's local .env —
  // signup would demand a captcha token the tests don't send. Empty string
  // (not delete): server modules re-run dotenv.config() at import time, which
  // would refill a deleted var but never overrides an existing one.
  process.env.HCAPTCHA_SECRET_KEY = '';
  // server/lib/featureFlags.ts defaults an unset flag to ON outside production
  // (dev convenience) — tests run with NODE_ENV=test, so without an explicit
  // default here every integration test would suddenly get FEATURE_COPILOT /
  // FEATURE_BRAND_BILLING mounted/enforced. Default both OFF for determinism;
  // specific test files (brand-quota, brand-seats, copilot, onboarding-brand-first)
  // set their own explicit 'true' after this runs, which wins.
  process.env.FEATURE_COPILOT = process.env.FEATURE_COPILOT ?? 'false';
  process.env.FEATURE_BRAND_BILLING = process.env.FEATURE_BRAND_BILLING ?? 'false';
}
