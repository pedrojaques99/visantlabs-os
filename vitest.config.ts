import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config — three projects:
 *   • unit         fast, no external services, runs on every push
 *   • integration  in-memory MongoDB + MSW, runs on PRs touching server/
 *   • e2e          full stack smoke, runs on PRs + nightly
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    hookTimeout: 30000,
    setupFiles: ['tests/setup.ts'],

    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            'tests/unit/**/*.test.ts',
            'server/**/*.test.ts',
            'server/**/__tests__/**/*.test.ts',
          ],
          exclude: ['tests/integration/**', 'tests/e2e/**', 'node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup.integration.ts'],
          fileParallelism: false,
          testTimeout: 30000,
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          setupFiles: ['tests/setup.integration.ts'],
          fileParallelism: false,
          testTimeout: 60000,
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['server/**/*.ts', 'src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        '**/*.config.ts',
        '**/*.d.ts',
        'server/mcp/**',
        'server/index.ts',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
        'server/routes/auth.ts': { lines: 70, functions: 70, branches: 60, statements: 70 },
        'server/routes/admin.ts': { lines: 70, functions: 70, branches: 60, statements: 70 },
        'server/routes/payments.ts': { lines: 70, functions: 70, branches: 60, statements: 70 },
        'server/lib/ai-resilience.ts': { lines: 70, functions: 70, branches: 60, statements: 70 },
        'server/middleware/auth.ts': { lines: 80, functions: 80, branches: 70, statements: 80 },
        'server/middleware/adminAuth.ts': { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
  },
});
