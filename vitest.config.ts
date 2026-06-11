import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (which sets root to src/client for the app build).
// Tests live in tests/ at the project root and exercise src/shared + src/server.
export default defineConfig({
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
