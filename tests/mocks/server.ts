import { setupServer } from 'msw/node';
import { aiHandlers } from './ai.js';

/**
 * Shared MSW server. Lifecycle is wired in tests/setup.ts so every test
 * project gets automatic start/reset/close.
 */
export const mswServer = setupServer(...aiHandlers);
