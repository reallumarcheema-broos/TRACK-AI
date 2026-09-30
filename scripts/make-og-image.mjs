#!/usr/bin/env node
// Renders public/og-image.png (1200×630), the picture shown when a page is shared on social media
// or in chat apps. Uses the site's own fonts and colours. Needs Playwright's Chromium
// (set CHROMIUM_PATH to use a preinstalled one).
//
//   node scripts/make-og-image.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Inlined, because a page made with setContent may not load file:// fonts.
const font = (f) => `data:font/woff2;base64,${readFileSync(path.join(root, 'src/assets/fonts', f)).toString('base64')}`;

const html = `<!doctype html><html><head><style>
@font-face { font-family: Bebas; src: url('${font('bebas-neue-latin.woff2')}'); }
@font-face { font-family: Inter; src: url('${font('inter-latin.woff2')}'); font-weight: 300 800; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; font-family: Inter; color: #17120e;
  background: radial-gradient(900px 500px at 85% -10%, rgba(216,160,102,.35), transparent 60%), #efe8de; }
.wrap { position: absolute; inset: 64px 72px; display: grid; grid-template-columns: 1fr 360px; gap: 48px; align-items: center; }
.brand { display: flex; align-items: center; gap: 18px; font-weight: 600; letter-spacing: .22em; font-size: 22px; }
.brand small { display: block; font-size: 14px; letter-spacing: .3em; color: #955820; font-weight: 700; }
h1 { font-family: Bebas; font-weight: 400; font-size: 118px; line-height: .9; margin: 36px 0 22px; text-transform: uppercase; }
h1 em { font-style: normal; color: #955820; }
p { font-size: 28px; line-height: 1.35; color: #4f4439; max-width: 620px; }
.card { background: #17120e; color: #f6efe6; border-radius: 36px; padding: 36px; box-shadow: 0 40px 80px -30px rgba(45,26,10,.6); }
.k { font-size: 16px; letter-spacing: .16em; text-transform: uppercase; color: rgba(246,239,230,.6); font-weight: 600; }
.big { font-family: Bebas; font-size: 150px; line-height: .9; margin: 10px 0 4px; }
.big small { font-size: 60px; color: rgba(246,239,230,.55); }
.bar { height: 12px; border-radius: 99px; background: rgba(246,239,230,.14); margin: 18px 0 26px; overflow: hidden; }
.bar i { display: block; height: 100%; width: 92%; background: #d8a066; border-radius: 99px; }
.tip { font-size: 22px; line-height: 1.35; }
</style></head><body><div class="wrap">
<div>
  <div class="brand"><svg width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#17120e"/><path d="M16 46L28 20L48 38" fill="none" stroke="#d8a066" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="46" r="5" fill="#f6efe6"/><circle cx="28" cy="20" r="5" fill="#f6efe6"/><circle cx="48" cy="38" r="5" fill="#f6efe6"/></svg><span>TRACK AI<small>Coach</small></span></div>
  <h1>Your free AI trainer, <em>right in your phone.</em></h1>
  <p>Real-time rep counting, form checks and a coach that talks you through every set.</p>
</div>
<div class="card">
  <div class="k">Live set</div>
  <div class="big">08<small>/10</small></div>
  <div class="k">Form</div>
  <div class="bar"><i></i></div>
  <div class="tip">“Chest up, push your knees out. Two more!”</div>
</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(async () => {
  await document.fonts.ready;
  if (!document.fonts.check('118px Bebas') || !document.fonts.check('28px Inter')) throw new Error('The fonts did not load');
});
const out = path.join(root, 'public', 'og-image.png');
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${path.relative(root, out)}`);
