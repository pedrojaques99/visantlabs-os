import { describe, it, expect, beforeEach } from 'vitest';
import { _resetEnvCache, loadEnv } from '../../../server/config/env.js';
import { TEST_JWT_SECRET } from '../../helpers/env.js';

/**
 * Validates the fail-fast env guard that runs before the server binds to a port.
 * These are the exact failure modes seen when deploying to a new VPS with
 * an incomplete .env — the server refuses to boot with a human-readable error
 * instead of crashing at the first DB query.
 */

const VALID_BASE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/visant-test',
  JWT_SECRET: TEST_JWT_SECRET, // 32+ chars — passes the min-length check
};

beforeEach(() => {
  _resetEnvCache();
});

describe('loadEnv — happy path', () => {
  it('accepts a minimal valid config', () => {
    const e = loadEnv({ ...VALID_BASE });
    expect(e.NODE_ENV).toBe('test');
    expect(e.PORT).toBe(3001); // default
    expect(e.DEFAULT_LLM_PROVIDER).toBe('gemini'); // default
  });

  it('applies PORT coercion (string → number)', () => {
    const e = loadEnv({ ...VALID_BASE, PORT: '8080' });
    expect(e.PORT).toBe(8080);
    expect(typeof e.PORT).toBe('number');
  });

  it('caches the result — subsequent calls return the same object reference', () => {
    const first = loadEnv({ ...VALID_BASE });
    const second = loadEnv({ ...VALID_BASE, PORT: '9999' }); // ignored — already cached
    expect(first).toBe(second);
    expect(second.PORT).toBe(3001);
  });
});

describe('loadEnv — missing critical vars (VPS deploy failures)', () => {
  it('throws when MONGODB_URI is absent', () => {
    const src = { ...VALID_BASE };
    delete src.MONGODB_URI;
    expect(() => loadEnv(src)).toThrow(/MONGODB_URI/);
  });

  it('throws when JWT_SECRET is absent', () => {
    const src = { ...VALID_BASE };
    delete src.JWT_SECRET;
    expect(() => loadEnv(src)).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short (< 32 chars)', () => {
    expect(() => loadEnv({ ...VALID_BASE, JWT_SECRET: 'tooshort' })).toThrow(/JWT_SECRET/);
  });

  it('throws when NODE_ENV is an unsupported value', () => {
    expect(() => loadEnv({ ...VALID_BASE, NODE_ENV: 'staging' as any })).toThrow();
  });

  it('error message lists ALL missing vars at once — not one at a time', () => {
    const src: NodeJS.ProcessEnv = {};
    let message = '';
    try {
      loadEnv(src);
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toMatch(/MONGODB_URI/);
    expect(message).toMatch(/JWT_SECRET/);
  });
});

describe('loadEnv — production-only guard', () => {
  const prodBase: NodeJS.ProcessEnv = {
    ...VALID_BASE,
    NODE_ENV: 'production',
  };

  it('refuses to boot in production without GOOGLE_CLIENT_ID', () => {
    expect(() => loadEnv({ ...prodBase })).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('refuses to boot in production without STRIPE_SECRET_KEY', () => {
    expect(() =>
      loadEnv({
        ...prodBase,
        GOOGLE_CLIENT_ID: 'g-client',
        GOOGLE_CLIENT_SECRET: 'g-secret',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        FRONTEND_URL: 'https://app.visantlabs.com',
        // STRIPE_SECRET_KEY intentionally missing
      })
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('boots successfully in production when all required vars are present', () => {
    const e = loadEnv({
      ...prodBase,
      GOOGLE_CLIENT_ID: 'g-client',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      STRIPE_SECRET_KEY: 'sk_live_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      FRONTEND_URL: 'https://app.visantlabs.com',
    });
    expect(e.NODE_ENV).toBe('production');
  });
});

describe('loadEnv — TELEMETRY_SINK and LOG_LEVEL defaults', () => {
  it('defaults LOG_LEVEL to info and TELEMETRY_SINK to file', () => {
    const e = loadEnv({ ...VALID_BASE });
    expect(e.LOG_LEVEL).toBe('info');
    expect(e.TELEMETRY_SINK).toBe('file');
  });

  it('accepts all valid LOG_LEVEL values', () => {
    const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
    for (const level of levels) {
      _resetEnvCache();
      const e = loadEnv({ ...VALID_BASE, LOG_LEVEL: level });
      expect(e.LOG_LEVEL).toBe(level);
    }
  });

  it('rejects invalid LOG_LEVEL value', () => {
    expect(() => loadEnv({ ...VALID_BASE, LOG_LEVEL: 'verbose' as any })).toThrow();
  });
});
