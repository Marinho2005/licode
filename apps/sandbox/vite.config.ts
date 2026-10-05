import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@wasmer/sdk']
  },
  server: {
    port: 5174,
    host: 'localhost',
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  },
  build: {
    target: 'esnext'
  }
});
