/// <reference types="vitest/config" />
import { createReadStream, existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
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

/**
 * Production Content-Security-Policy: the page may only talk to itself, Google's model CDN and
 * the optional debrief API. Besides hardening, this stops MediaPipe's built-in usage-metrics
 * logger (odml.pa.googleapis.com) — the app promises that everything stays on the device.
 */
function contentSecurityPolicy(apiUrl: string | undefined): Plugin {
  const api = apiUrl ? new URL(apiUrl).origin : '';
  const csp = `connect-src 'self' blob: data: https://storage.googleapis.com ${api}`.trim();
  return {
    name: 'track-ai:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

// `npm run dev:https` → self-signed HTTPS on the LAN so a phone can open the camera
// (getUserMedia needs a secure context).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mediapipeWasm(),
    contentSecurityPolicy(loadEnv(mode, root, 'VITE_').VITE_COACH_API_URL),
    mode === 'https' ? basicSsl() : null,
  ],
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
