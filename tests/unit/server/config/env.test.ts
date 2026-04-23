import { describe, it, expect } from 'vitest';
import { loadEnv, _resetEnvCache } from '../../../../server/config/env.js';

const base = {
  NODE_ENV: 'test' as const,
  MONGODB_URI: 'mongodb://localhost/x',
  JWT_SECRET: 'a'.repeat(48),
};

describe('loadEnv', () => {
  it('accepts a minimal valid env', () => {
    _resetEnvCache();
    expect(() => loadEnv({ ...base } as any)).not.toThrow();
  });

  it('rejects short JWT_SECRET', () => {
    _resetEnvCache();
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' } as any)).toThrow(/JWT_SECRET/);
  });

  it('rejects missing MONGODB_URI', () => {
    _resetEnvCache();
    const { MONGODB_URI: _omit, ...rest } = base;
    expect(() => loadEnv({ ...rest } as any)).toThrow(/MONGODB_URI/);
  });

  it('demands production secrets when NODE_ENV=production', () => {
    _resetEnvCache();
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production' } as any)
    ).toThrow(/GOOGLE_CLIENT_ID|STRIPE_SECRET_KEY|FRONTEND_URL/);
  });

  it('coerces PORT from string', () => {
    _resetEnvCache();
    const env = loadEnv({ ...base, PORT: '4000' } as any);
    expect(env.PORT).toBe(4000);
  });
});
