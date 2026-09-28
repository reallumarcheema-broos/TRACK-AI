import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppOptions } from './app';

let server: Server | null = null;

async function start(opts: Partial<AppOptions>): Promise<string> {
  const handler = createApp({ debrief: null, model: 'claude-opus-5', ...opts });
  server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = null;
});

const validSet = {
  exercise: 'Squat',
  kind: 'reps',
  target: 5,
  reps: 5,
  cleanReps: 4,
  partialReps: 0,
  formScore: 94,
  durationSec: 20,
  faults: [{ title: 'Heels lifting', count: 1, severity: 'minor', tip: '' }],
  repScores: [100, 100, 85, 100, 100],
};

const post = (url: string, body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
  fetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('API', () => {
  it('reports whether AI debriefs are available', async () => {
    const base = await start({});
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true, ai: false, model: null });
  });

  it('returns 503 without credentials so the app uses its own summary', async () => {
    const base = await start({});
    expect((await post(`${base}/api/debrief`, validSet)).status).toBe(503);
  });

  it('debriefs a valid set', async () => {
    const debrief = vi.fn(async () => 'Five reps, great depth. Keep your heels down next set.');
    const base = await start({ debrief });
    const res = await post(`${base}/api/debrief`, validSet);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Five reps, great depth. Keep your heels down next set.', source: 'claude' });
    expect(debrief).toHaveBeenCalledWith(expect.objectContaining({ exercise: 'Squat', reps: 5 }));
  });

  it('rejects bad input', async () => {
    const base = await start({ debrief: async () => 'x' });
    expect((await post(`${base}/api/debrief`, '{nope')).status).toBe(400);
    expect((await post(`${base}/api/debrief`, { ...validSet, exercise: 'Poetry' })).status).toBe(400);
    expect((await post(`${base}/api/debrief`, validSet, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post(`${base}/api/debrief`, { ...validSet, pad: 'x'.repeat(20_000) })).status).toBe(413);
    expect((await fetch(`${base}/api/debrief`)).status).toBe(405);
  });

  it('rate-limits each client', async () => {
    const base = await start({ debrief: async () => 'ok', ratePerMinute: 2 });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await post(`${base}/api/debrief`, validSet)).status);
    expect(codes).toEqual([200, 200, 429]);
  });

  it('answers 502 when the model gives nothing usable', async () => {
    const base = await start({ debrief: async () => null });
    expect((await post(`${base}/api/debrief`, validSet)).status).toBe(502);
  });

  it('only sends CORS headers to allowed origins', async () => {
    const base = await start({ debrief: async () => 'ok', allowedOrigins: ['https://coach.example'] });
    const ok = await fetch(`${base}/api/health`, { headers: { Origin: 'https://coach.example' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://coach.example');
    const other = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('static hosting', () => {
  function dist(): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'track-dist-'));
    mkdirSync(path.join(dir, 'assets'));
    mkdirSync(path.join(dir, 'mediapipe/wasm'), { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>TRACK</title>');
    writeFileSync(path.join(dir, 'assets/app-abc123.js'), 'console.log(1)');
    const wasm = Buffer.alloc(10_000, 7);
    writeFileSync(path.join(dir, 'mediapipe/wasm/vision.wasm'), wasm);
    writeFileSync(path.join(dir, 'mediapipe/wasm/vision.wasm.gz'), gzipSync(wasm));
    return dir;
  }

  it('serves files with the right types and caching', async () => {
    const base = await start({ distDir: dist() });
    const js = await fetch(`${base}/assets/app-abc123.js`);
    expect(js.headers.get('content-type')).toMatch(/javascript/);
    expect(js.headers.get('cache-control')).toMatch(/immutable/);
    const html = await fetch(`${base}/`);
    expect(await html.text()).toContain('TRACK');
    expect(html.headers.get('cache-control')).toBe('no-cache');
    expect(html.headers.get('permissions-policy')).toMatch(/camera=\(self\)/);
  });

  it('falls back to the app for client-side routes but 404s missing assets', async () => {
    const base = await start({ distDir: dist() });
    expect(await (await fetch(`${base}/history`)).text()).toContain('TRACK');
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
  });

  it('serves the pre-compressed WASM runtime', async () => {
    const base = await start({ distDir: dist() });
    const res = await fetch(`${base}/mediapipe/wasm/vision.wasm`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(res.headers.get('content-type')).toBe('application/wasm');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect((await res.arrayBuffer()).byteLength).toBe(10_000); // fetch transparently decompresses
  });

  it('never serves files outside the build directory', async () => {
    const dir = dist();
    writeFileSync(path.join(dir, '..', `secret-${path.basename(dir)}.txt`), 'TOP SECRET');
    const base = await start({ distDir: dir });
    for (const p of [`/..%2fsecret-${path.basename(dir)}.txt`, `/%2e%2e/secret-${path.basename(dir)}.txt`]) {
      const res = await fetch(`${base}${p}`);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('TOP SECRET');
    }
  });
});
