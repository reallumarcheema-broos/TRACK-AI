/**
 * Runs after `vite build`: writes the website's content pages, robots.txt, ads.txt and sitemap.xml
 * into dist/, linking the built stylesheet and fonts. Settings come from the environment (or .env),
 * see .env.example.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { siteFiles } from '../src/site/files';
import { siteConfig } from '../src/site/site';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');

const hrefs = (pattern: RegExp) => [...html.matchAll(pattern)].map((m) => m[1]);
const stylesheets = hrefs(/<link rel="stylesheet"[^>]*href="([^"]+)"/g);
const fonts = hrefs(/<link rel="preload" href="([^"]+\.woff2)"/g);
if (!stylesheets.length) throw new Error('dist/index.html links no stylesheet — run `vite build` first');
const base = stylesheets[0].slice(0, stylesheets[0].indexOf('assets/'));

const config = siteConfig(loadEnv('production', root, ''));
const files = siteFiles(config, { base, stylesheets, fonts }, new Date().toISOString().slice(0, 10));
for (const f of files) {
  const out = path.join(dist, f.file);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, f.body);
}
console.log(
  `Website: ${files.length} files · AdSense ${config.adsenseClient ?? 'off (set VITE_ADSENSE_CLIENT)'} · ` +
    `ad unit ${config.adSlot ?? 'none'} · address ${config.siteUrl ?? 'unknown (set SITE_URL)'}`,
);
