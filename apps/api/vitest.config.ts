import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // One in-memory cluster shared by every file; parallel workers would each
    // try to bind the same port.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      // Fixed port so the value is known before any module reads the config.
      DATABASE_URL: 'mongodb://127.0.0.1:27018/settlements-test?directConnection=true',
      JWT_ACCESS_SECRET: 'test-access-secret-value-that-is-long-enough',
      JWT_REFRESH_SECRET: 'test-refresh-secret-value-that-is-long-enough',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      BCRYPT_SALT_ROUNDS: '10',
      LOG_LEVEL: 'silent',
    },
  },
});
