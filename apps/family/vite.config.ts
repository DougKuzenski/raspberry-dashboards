import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client lives under src/client; build output goes to dist/client, which the
// Express server serves in production. In dev, /api is proxied to Express.
export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001',
      '/healthz': 'http://localhost:3001',
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
