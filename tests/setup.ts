import { beforeAll, afterEach, afterAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Global cleanup
});
