import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { applyTestEnv } from './helpers/env.js';
import { mswServer } from './mocks/server.js';

// Must run before any server module is imported.
applyTestEnv();

beforeAll(() => {
  // Fail loudly on unmocked outbound HTTP — catches tests leaking real calls.
  mswServer.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  mswServer.close();
});
