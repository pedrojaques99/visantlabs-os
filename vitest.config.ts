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
      '@visant/psd-engine/scene': path.resolve(
        __dirname,
        './packages/psd-engine/src/scene/index.ts'
      ),
      '@visant/psd-engine/adapters/node': path.resolve(
        __dirname,
        './packages/psd-engine/src/adapters/node.ts'
      ),
      '@visant/psd-engine/adapters/browser': path.resolve(
        __dirname,
        './packages/psd-engine/src/adapters/browser.ts'
      ),
      '@visant/psd-engine': path.resolve(__dirname, './packages/psd-engine/src/index.ts'),
      '@visant/print-fx/halftone': path.resolve(
        __dirname,
        './packages/print-fx/src/halftone/index.ts'
      ),
      '@visant/print-fx/riso': path.resolve(__dirname, './packages/print-fx/src/riso/index.ts'),
      '@visant/print-fx/shaders': path.resolve(
        __dirname,
        './packages/print-fx/src/shaders/index.ts'
      ),
      '@visant/print-fx/presets': path.resolve(__dirname, './packages/print-fx/src/presets.ts'),
      '@visant/print-fx/gl': path.resolve(__dirname, './packages/print-fx/src/gl/index.ts'),
      '@visant/print-fx/adapters/node': path.resolve(
        __dirname,
        './packages/print-fx/src/adapters/node.ts'
      ),
      '@visant/print-fx/adapters/browser': path.resolve(
        __dirname,
        './packages/print-fx/src/adapters/browser.ts'
      ),
      '@visant/print-fx': path.resolve(__dirname, './packages/print-fx/src/index.ts'),
      '@visant/logo-trace/presets': path.resolve(__dirname, './packages/logo-trace/src/presets.ts'),
      '@visant/logo-trace/sanitize': path.resolve(
        __dirname,
        './packages/logo-trace/src/sanitize.ts'
      ),
      '@visant/logo-trace': path.resolve(__dirname, './packages/logo-trace/src/index.ts'),
      '@visant/extrude3d/materials': path.resolve(
        __dirname,
        './packages/extrude3d/src/materials.ts'
      ),
      '@visant/extrude3d/fonts': path.resolve(__dirname, './packages/extrude3d/src/fonts.ts'),
      '@visant/extrude3d/glb': path.resolve(__dirname, './packages/extrude3d/src/glb.ts'),
      '@visant/extrude3d': path.resolve(__dirname, './packages/extrude3d/src/index.ts'),
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
        'server/middleware/adminAuth.ts': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  },
});
