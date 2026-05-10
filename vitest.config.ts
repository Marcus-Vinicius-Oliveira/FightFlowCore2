import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      exclude: ['server/**/__tests__/**'],
    },
  },
});
