import { defineConfig } from 'vite';
import { savesPlugin } from './server/saves-plugin';

// Everything stays inside this folder: cache dir is local, build goes to ./dist, saves go to ./saves.
export default defineConfig({
  plugins: [savesPlugin()],
  // relative, so a published build works under a sub-address (GitHub Pages project site)
  base: './',
  cacheDir: 'node_modules/.vite',
  server: { port: 5190, strictPort: false, open: false },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 2000 },
});
