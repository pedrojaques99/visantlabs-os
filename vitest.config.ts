import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Environment
    environment: 'node',
    globals: true,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
        'server/mcp/**',
      ],
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },

    // Performance
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporters
    reporters: ['default'],

    // Include patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],

    // Setup files
    setupFiles: ['tests/setup.ts'],

    // Alias resolution
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
