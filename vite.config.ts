import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client lives under src/client; build output goes to dist/client, which the
// Express server serves in production. In dev, /api is proxied to the Express server.
export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});
