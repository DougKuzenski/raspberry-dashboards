import { defineConfig } from 'vitest/config';

// Tests live in tests/ and exercise src/shared + src/server.
export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
