import { z } from 'zod';

/**
 * Typed environment config with fail-fast validation.
 *
 * Import `env` instead of reading `process.env` directly so the compiler knows
 * which variables exist and what their types are. Missing required vars abort
 * the boot with a human-readable report (see `loadEnv`).
 *
 * Schema is intentionally split by concern:
 *   • required in every environment
 *   • required in production only
 *   • optional with sensible defaults
 *
 * To add a new env var: declare it here, give it a clear error message, then
 * consume it via `env.FOO` everywhere else.
 */
const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  DATABASE_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars (use `npm run generate-jwt-secret`)'),

  // OAuth (optional in dev/test, required in prod)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // Stripe (optional in dev/test, required in prod)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_USD: z.string().optional(),
  STRIPE_PRICE_ID_BRL: z.string().optional(),

  // AI providers
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Networking
  FRONTEND_URL: z.string().optional(),
  VERCEL: z.string().optional(),

  // Observability / telemetry
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TELEMETRY_SINK: z.enum(['file', 'memory', 'remote', 'noop']).default('file'),
  TELEMETRY_REMOTE_URL: z.string().url().optional(),

  // Infra
  DEBUG: z.string().optional(),
});

export type Env = z.infer<typeof baseSchema>;

const productionRequired: Array<keyof Env> = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FRONTEND_URL',
];

let cached: Env | null = null;

/**
 * Parse + validate the environment. Call once at boot.
 *
 * Throws if validation fails — the server MUST NOT continue because partial
 * config leads to subtle runtime failures (webhooks silently dropped, AI
 * calls going to wrong provider, etc.).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = baseSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${issues}\n\nFix .env / .env.local and retry.`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const missing = productionRequired.filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `❌ Missing production env vars:\n${missing.map((k) => `  • ${k}`).join('\n')}\n\nRefusing to boot.`
      );
    }
  }

  cached = env;
  return env;
}

/**
 * The live, typed env. Lazy-loaded so importers don't pay validation cost
 * until the first access. In tests the test harness applies its own env and
 * then reads `env` — same path, deterministic.
 */
export const env = new Proxy({} as Env, {
  get(_t, prop) {
    const e = cached ?? loadEnv();
    return e[prop as keyof Env];
  },
});

/** For tests that need to reset between runs. */
export function _resetEnvCache(): void {
  cached = null;
}
