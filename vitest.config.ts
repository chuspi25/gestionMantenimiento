import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test'
    },
    // Configure different environments for different test types
    environmentMatchGlobs: [
      ['tests/frontend/**', 'jsdom'],
      ['tests/backend/**', 'node']
    ],
    // Optimize for speed
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    // Reduce timeout for faster feedback
    testTimeout: 5000,
    // Skip coverage by default for faster runs
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    // Optimize reporter for speed
    reporter: 'basic'
  }
});