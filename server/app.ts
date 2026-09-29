/**
 * HTTP layer: serves the built app (dist/) and the AI debrief API. Framework-free on purpose —
 * two routes don't need one, and it keeps the container small.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { DEBRIEF_LIMITS, parseDebriefRequest, type DebriefResponse } from '../src/shared/debrief';
import { canonicalize, type Debriefer } from './debrief';

export interface AppOptions {
  /** Built frontend to serve; omit for an API-only server. */
  distDir?: string;
  /** null when no Anthropic credentials are configured. */
  debrief: Debriefer | null;
  model: string;
  /** Origins allowed to call the API cross-origin (frontend hosted elsewhere). */
  allowedOrigins?: string[];
  /** Debriefs per client IP per minute. */
  ratePerMinute?: number;
  now?: () => number;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.map': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // The app needs the camera and nothing else.
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
};

/** Parses a single `bytes=` range (the only kind browsers send for media). */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'invalid' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    // Suffix range: the last N bytes.
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(json);
}

/** Reads a request body up to `limit` bytes; resolves null (after draining) when it's larger. */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (tooBig) {
        // Keep draining so the client can read our 413, but don't let it stream forever.
        if (size > 1_000_000) req.destroy();
        return;
      }
      if (size > limit) {
        tooBig = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(tooBig ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clientIp(req: IncomingMessage): string {
  // Behind a proxy (Fly, Render, Cloud Run…) the first X-Forwarded-For hop is the client.
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

export function createApp(opts: AppOptions) {
  const now = opts.now ?? Date.now;
  const perMinute = opts.ratePerMinute ?? 12;
  const hits = new Map<string, number[]>();
  const dist = opts.distDir ? path.resolve(opts.distDir) : null;

  const limited = (ip: string): boolean => {
    const t = now();
    const recent = (hits.get(ip) ?? []).filter((x) => t - x < 60_000);
    recent.push(t);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear(); // crude memory bound
    return recent.length > perMinute;
  };

  const corsHeaders = (req: IncomingMessage): Record<string, string> => {
    const origin = req.headers.origin;
    if (!origin || !opts.allowedOrigins?.includes(origin)) return {};
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  };

  async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Max-Age': '600' });
      res.end();
      return;
    }
    if (pathname === '/api/health' && req.method === 'GET') {
      send(res, 200, { ok: true, ai: opts.debrief !== null, model: opts.debrief ? opts.model : null }, cors);
      return;
    }
    if (pathname !== '/api/debrief') return send(res, 404, { error: 'Not found' }, cors);
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' }, { ...cors, Allow: 'POST' });
    if (!opts.debrief) return send(res, 503, { error: 'AI debrief is not configured on this server' }, cors);
    if (!(req.headers['content-type'] ?? '').includes('application/json')) {
      return send(res, 415, { error: 'Send JSON' }, cors);
    }
    if (limited(clientIp(req))) return send(res, 429, { error: 'Too many requests — try again in a minute' }, { ...cors, 'Retry-After': '60' });

    const raw = await readBody(req, DEBRIEF_LIMITS.maxBodyBytes);
    if (raw === null) return send(res, 413, { error: 'Request too large' }, { ...cors, Connection: 'close' });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'Invalid JSON' }, cors);
    }
    const parsed = parseDebriefRequest(body);
    const set = parsed && canonicalize(parsed);
    if (!set) return send(res, 400, { error: 'Not a valid set summary' }, cors);

    const text = await opts.debrief(set);
    if (!text) return send(res, 502, { error: 'The AI coach is unavailable right now' }, cors);
    const out: DebriefResponse = { text, source: 'claude' };
    send(res, 200, out, cors);
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): void {
    if (!dist) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
    let rel: string;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return send(res, 400, { error: 'Bad path' });
    }
    let file = path.resolve(dist, `.${path.posix.normalize(rel)}`);
    if (!file.startsWith(dist + path.sep) && file !== dist) return send(res, 403, { error: 'Forbidden' });
    const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
    if (!isFile(file)) {
      // SPA fallback for navigation; real 404s for missing assets.
      if (path.extname(file)) return send(res, 404, { error: 'Not found' });
      file = path.join(dist, 'index.html');
    }
    const ext = path.extname(file);
    const headers: Record<string, string> = {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      // Hashed build assets never change; everything else must revalidate.
      'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : ext === '.html' || rel.endsWith('sw.js') ? 'no-cache' : 'public, max-age=86400',
    };
    // Serve the pre-compressed copy when the build produced one (WASM shrinks ~70%).
    const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (acceptsGzip && isFile(`${file}.gz`)) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      file = `${file}.gz`;
    }
    const size = statSync(file).size;
    // Byte ranges: Safari won't play a video without them, and seeking/looping needs them.
    const range = headers['Content-Encoding'] ? null : parseRange(req.headers.range, size);
    if (range === 'invalid') {
      res.writeHead(416, { ...SECURITY_HEADERS, 'Content-Range': `bytes */${size}` });
      return void res.end();
    }
    headers['Accept-Ranges'] = 'bytes';
    if (range) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      headers['Content-Length'] = String(range.end - range.start + 1);
      res.writeHead(206, headers);
    } else {
      headers['Content-Length'] = String(size);
      res.writeHead(200, headers);
    }
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file, range ?? {}).pipe(res);
  }

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    try {
      if (pathname.startsWith('/api/')) await handleApi(req, res, pathname);
      else serveStatic(req, res, pathname);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Internal error' });
      else res.end();
    }
  };
}
