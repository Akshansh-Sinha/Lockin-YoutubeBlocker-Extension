import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.ts';
import path from 'path';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        block: path.resolve(__dirname, 'src/ui/block/index.html'),
      },
      output: {
        manualChunks: undefined,
      },
    },
  },
});
