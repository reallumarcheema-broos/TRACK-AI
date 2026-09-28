/// <reference types="vitest/config" />
import { createReadStream, existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const root = path.dirname(fileURLToPath(import.meta.url));
const MEDIAPIPE_WASM_DIR = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

/**
 * Serves MediaPipe's WASM runtime from node_modules in dev and copies it into the build,
 * so the app never depends on a third-party CDN for its inference runtime.
 */
function mediapipeWasm(): Plugin {
  let outDir = 'dist';
  return {
    name: 'track-ai:mediapipe-wasm',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm', (req, res, next) => {
        const name = path.basename((req.url ?? '').split('?')[0]);
        const file = path.join(MEDIAPIPE_WASM_DIR, name);
        if (!WASM_FILES.includes(name) || !existsSync(file)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
    async writeBundle() {
      const dest = path.join(outDir, 'mediapipe/wasm');
      await mkdir(dest, { recursive: true });
      await Promise.all(WASM_FILES.map((f) => cp(path.join(MEDIAPIPE_WASM_DIR, f), path.join(dest, f))));
    },
  };
}

// `npm run dev:https` → self-signed HTTPS on the LAN so a phone can open the camera
// (getUserMedia needs a secure context).
export default defineConfig(({ mode }) => ({
  plugins: [react(), mediapipeWasm(), mode === 'https' ? basicSsl() : null],
  server: {
    host: mode === 'https' ? true : undefined,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
