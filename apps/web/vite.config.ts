import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

const isolationHeaderPlugin = {
  name: 'licode-cross-origin-isolation-headers',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((_request, response, next) => {
      for (const [name, value] of Object.entries(isolationHeaders)) response.setHeader(name, value);
      next();
    });
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((_request, response, next) => {
      for (const [name, value] of Object.entries(isolationHeaders)) response.setHeader(name, value);
      next();
    });
  }
};

export default defineConfig({
  plugins: [sveltekit(), isolationHeaderPlugin],
  envPrefix: ['VITE_', 'PUBLIC_'],
  optimizeDeps: {
    exclude: ['@wasmer/sdk']
  },
  worker: { format: 'es' },
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true,
    fs: { allow: [new URL('../..', import.meta.url).pathname] },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
