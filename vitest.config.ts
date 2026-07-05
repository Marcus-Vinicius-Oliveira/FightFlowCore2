import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'server/**/__tests__/**/*.test.ts',
      'client/src/lib/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'client/src/lib/**/*.ts'],
      exclude: ['server/**/__tests__/**', 'client/src/lib/__tests__/**'],
    },
  },
});
