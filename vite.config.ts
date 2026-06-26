import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client lives under src/client; build output goes to dist/client, which the
// Express server serves in production. In dev, /api is proxied to the Express server.
const devServerTarget = 'http://127.0.0.1:3000';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': devServerTarget,
      '/healthz': devServerTarget,
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
