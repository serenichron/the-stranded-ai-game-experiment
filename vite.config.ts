import { defineConfig } from 'vite';
import { savesPlugin } from './server/saves-plugin';

// Everything stays inside this folder: cache dir is local, build goes to ./dist, saves go to ./saves.
export default defineConfig({
  plugins: [savesPlugin()],
  cacheDir: 'node_modules/.vite',
  server: { port: 5190, strictPort: false, open: false },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 2000 },
});
