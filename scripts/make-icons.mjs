// Renders the SVG app icons to the PNG sizes iOS/Android install prompts need.
// Usage: node scripts/make-icons.mjs  (uses Playwright's Chromium)
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const jobs = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/maskable-512.png', 512],
  ['public/icons/maskable.svg', 'public/icons/apple-touch-icon.png', 180],
];
for (const [src, out, size] of jobs) {
  const svg = await readFile(src, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
}
await browser.close();
