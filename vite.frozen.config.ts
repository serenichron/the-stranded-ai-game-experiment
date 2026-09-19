import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from './vite.config';

// Frozen test builds only (phase 3). Same as vite.config.ts, plus the character bench as a second page,
// so it can be shot from `vite preview` on a test port instead of the user's dev server on 5190.
// Build: npx vite build --config vite.frozen.config.ts --outDir test-output/build-D
// Bench: http://localhost:<port>/src/world/models/dev/chars.html
export default mergeConfig(base, defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chars: resolve(__dirname, 'src/world/models/dev/chars.html'),
      },
    },
  },
}));
