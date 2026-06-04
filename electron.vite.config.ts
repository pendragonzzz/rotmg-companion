import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve('src/preload/index.ts') } },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    resolve: { alias: { '@shared': resolve('src/shared') } },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
});
