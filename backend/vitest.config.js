import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/env.js'],
    globalSetup: ['./tests/setup/globalMongo.js'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Test files share one in-memory MongoDB, so run them one at a time.
    fileParallelism: false,
  },
});
