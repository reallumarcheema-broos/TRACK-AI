#!/usr/bin/env node
// Downloads the MediaPipe pose models into public/models so the app works fully offline
// (and doesn't depend on Google's CDN at runtime).
//
//   npm run fetch-models            # lite + full (default)
//   npm run fetch-models -- heavy   # a specific model
//
// Behind a proxy on Node ≥ 22.21, run with NODE_USE_ENV_PROXY=1.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'models');
const wanted = process.argv.slice(2).filter((a) => ['lite', 'full', 'heavy'].includes(a));
const models = wanted.length ? wanted : ['lite', 'full'];
const url = (q) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${q}/float16/latest/pose_landmarker_${q}.task`;

await mkdir(outDir, { recursive: true });
let failed = 0;
for (const q of models) {
  const file = path.join(outDir, `pose_landmarker_${q}.task`);
  const existing = await stat(file).catch(() => null);
  if (existing && existing.size > 1_000_000) {
    console.log(`✓ ${path.relative(root, file)} already present (${(existing.size / 1e6).toFixed(1)} MB)`);
    continue;
  }
  try {
    process.stdout.write(`↓ ${q} model… `);
    const res = await fetch(url(q));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(file, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)} MB → ${path.relative(root, file)}`);
  } catch (err) {
    failed++;
    console.log(`failed (${err.message}). The app will fall back to the CDN at runtime.`);
  }
}
process.exitCode = failed ? 1 : 0;
