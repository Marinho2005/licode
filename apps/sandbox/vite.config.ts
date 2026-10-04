import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    host: 'localhost',
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    target: 'esnext'
  }
});
