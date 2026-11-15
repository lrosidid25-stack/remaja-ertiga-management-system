import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Relative paths so the bundle also works when loaded from the
    // Android WebView (capacitor://localhost) instead of a web server.
    base: './',
    define: {
      __APP_BUILD__: JSON.stringify(
        process.env.APP_BUILD || new Date().toISOString().slice(0, 16).replace('T', ' '),
      ),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2022',
      // Android WebView (Chrome 100+) handles modern JS fine.
      chunkSizeWarningLimit: 4096,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
