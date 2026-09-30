/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { ADSENSE_CONNECT_SRC, adsenseHead, SITE_NAME, siteConfig, type SiteConfig } from './src/site/site.ts';

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
        res.setHeader('Content-Length', String(statSync(file).size));
        res.setHeader('Cache-Control', 'public, max-age=3600');
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
 * Writes .gz copies of large text/WASM files next to them; the Node server serves these to
 * browsers that accept gzip (the 11 MB WASM runtime drops to ~3 MB).
 */
function precompress(): Plugin {
  let outDir = 'dist';
  const exts = new Set(['.js', '.css', '.wasm', '.html', '.svg', '.json', '.webmanifest']);
  const walk = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])));
    return nested.flat();
  };
  return {
    name: 'track-ai:precompress',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      for (const file of await walk(outDir)) {
        if (!exts.has(path.extname(file)) || (await stat(file)).size < 4096) continue;
        await writeFile(`${file}.gz`, gzipSync(await readFile(file), { level: 9 }));
      }
    },
  };
}

/**
 * Fills in the service worker's list of app files and names its cache after a hash of them, so the
 * whole app (including screens that download on demand) works offline after the first visit and a
 * new deploy replaces the old files. The pose models and WASM runtime are big, so they are cached
 * the first time a set starts instead.
 */
function serviceWorkerPrecache(): Plugin {
  let outDir = 'dist';
  let publicDir = '';
  return {
    name: 'track-ai:sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      publicDir = config.publicDir;
    },
    async writeBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files: string[] = [];
      for (const [name, out] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name).update(out.type === 'chunk' ? out.code : out.source);
        // index.html is cached as './', the content pages as they're visited; videos stream in
        // ranges, which the Cache API can't store.
        if (!/\.(html|txt|xml|map|mp4|webm)$/.test(name)) files.push(name);
      }
      const icons = (await readdir(path.join(publicDir, 'icons'))).map((f) => `icons/${f}`);
      for (const name of icons) {
        hash.update(name).update(await readFile(path.join(publicDir, name)));
        files.push(name);
      }
      const swFile = path.join(outDir, 'sw.js');
      const sw = await readFile(swFile, 'utf8');
      const build = "const BUILD = 'dev';";
      const precache = 'const PRECACHE = [];';
      if (!sw.includes(build) || !sw.includes(precache)) this.error('sw.js no longer has the BUILD/PRECACHE placeholders');
      await writeFile(
        swFile,
        sw
          .replace(build, `const BUILD = '${hash.digest('hex').slice(0, 12)}';`)
          .replace(precache, `const PRECACHE = ${JSON.stringify(files.map((f) => `./${f}`))};`),
      );
    },
  };
}

/**
 * Production Content-Security-Policy: the page may only talk to itself, Google's model CDN, the
 * optional debrief API and, with ads on, Google AdSense. Besides hardening, this stops MediaPipe's
 * built-in usage-metrics logger (odml.pa.googleapis.com) — the app promises that everything stays
 * on the device.
 */
function contentSecurityPolicy(apiUrl: string | undefined, ads: boolean): Plugin {
  const api = apiUrl ? new URL(apiUrl).origin : '';
  const csp = ["connect-src 'self' blob: data: https://storage.googleapis.com", api, ...(ads ? ADSENSE_CONNECT_SRC : [])]
    .filter(Boolean)
    .join(' ');
  return {
    name: 'track-ai:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

/**
 * The public website around the app: Google AdSense's code and share tags in index.html, and in
 * development the content pages, robots.txt, ads.txt and sitemap.xml (a production build writes
 * those with scripts/build-site.ts). Configured through the environment, see .env.example.
 */
function website(config: SiteConfig): Plugin {
  let base = '/';
  return {
    name: 'track-ai:website',
    configResolved(c) {
      base = c.base;
    },
    transformIndexHtml(html) {
      const url = config.siteUrl ? `${config.siteUrl}${base}` : null;
      const head = [
        url && `<link rel="canonical" href="${url}" />`,
        url && `<meta property="og:url" content="${url}" />`,
        '<meta property="og:type" content="website" />',
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:title" content="${SITE_NAME}: your AI trainer" />`,
        '<meta property="og:description" content="Prop up your phone and train with a free AI coach: real-time rep counting, form checks and voice coaching." />',
        config.adsenseClient && adsenseHead(config.adsenseClient),
      ].filter(Boolean);
      return html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const wanted = decodeURIComponent((req.url ?? '/').split('?')[0])
          .slice(base.length)
          .replace(/\/$/, '');
        // Loaded through Vite so the page code can import the app's exercise definitions.
        server
          .ssrLoadModule('/src/site/files.ts')
          .then((mod) => {
            const { siteFiles } = mod as typeof import('./src/site/files');
            const assets = {
              base,
              stylesheets: [`${base}src/styles.css`],
              fonts: [`${base}src/assets/fonts/bebas-neue-latin.woff2`, `${base}src/assets/fonts/inter-latin.woff2`],
            };
            const hit = siteFiles(config, assets, new Date().toISOString().slice(0, 10)).find((f) => f.path === wanted);
            if (!hit) return next();
            res.setHeader('Content-Type', hit.type);
            res.end(hit.body);
          })
          .catch(next);
      });
    },
  };
}

// `npm run dev:https` → self-signed HTTPS on the LAN so a phone can open the camera
// (getUserMedia needs a secure context).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const site = siteConfig(env);
  return {
    plugins: [
      react(),
      mediapipeWasm(),
      contentSecurityPolicy(env.VITE_COACH_API_URL, site.adsenseClient !== null),
      website(site),
      serviceWorkerPrecache(),
      precompress(),
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
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
      environment: 'node',
    },
  };
});
