import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { checkLicense, parseLicenseRequest } from '../api/license';
import { createApp } from './app';

const CONFIG = { storeId: '11', productId: '22' };
const META = { store_id: 11, product_id: 22 };
const KEY = '38B1460A-5104-4067-A91D-77B872934D51';

/** A stand-in for Lemon Squeezy's license API. */
const lemon = (status: number, body: object) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status }));

describe('parseLicenseRequest', () => {
  it('accepts an activation and names the device', () => {
    expect(parseLicenseRequest({ action: 'activate', licenseKey: ` ${KEY} ` })).toEqual({ action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI' });
    expect(parseLicenseRequest({ action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI on iPhone' })?.instanceName).toBe('TRACK AI on iPhone');
  });

  it('needs the device id to check or remove a key', () => {
    expect(parseLicenseRequest({ action: 'validate', licenseKey: KEY })).toBeNull();
    expect(parseLicenseRequest({ action: 'deactivate', licenseKey: KEY, instanceId: 'abc-123' })).toEqual({ action: 'deactivate', licenseKey: KEY, instanceId: 'abc-123' });
  });

  it('refuses anything that is not a license key', () => {
    for (const body of [null, 'x', {}, { action: 'activate', licenseKey: 'short' }, { action: 'activate', licenseKey: 'has spaces in it' }, { action: 'delete', licenseKey: KEY }]) {
      expect(parseLicenseRequest(body)).toBeNull();
    }
  });
});

describe('checkLicense', () => {
  it('activates a key from this store and product', async () => {
    const fetch = lemon(200, { activated: true, error: null, license_key: { status: 'active' }, instance: { id: 'inst-1' }, meta: META });
    const out = await checkLicense({ action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI on iPhone' }, CONFIG, fetch);
    expect(out).toEqual({ status: 200, reply: { ok: true, instanceId: 'inst-1' } });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
    expect(String(init?.body)).toBe(`license_key=${KEY}&instance_name=TRACK+AI+on+iPhone`);
  });

  it("refuses a key bought for someone else's product", async () => {
    const fetch = lemon(200, { activated: true, license_key: { status: 'active' }, instance: { id: 'inst-1' }, meta: { store_id: 11, product_id: 99 } });
    const out = await checkLicense({ action: 'activate', licenseKey: KEY }, CONFIG, fetch);
    expect(out.status).toBe(403);
    expect(out.reply).toMatchObject({ ok: false, problem: 'wrong_product' });
  });

  it.each([
    [404, { activated: false, error: 'license_key not found.', meta: null }, 'not_found'],
    [400, { activated: false, error: 'This license key has reached the activation limit.', license_key: { status: 'active' }, meta: META }, 'limit'],
    [400, { activated: false, error: 'This license key has expired.', license_key: { status: 'expired' }, meta: META }, 'expired'],
    [400, { activated: false, error: 'This license key is disabled.', license_key: { status: 'disabled' }, meta: META }, 'disabled'],
  ])('explains a refusal (%s)', async (status, body, problem) => {
    const out = await checkLicense({ action: 'activate', licenseKey: KEY }, CONFIG, lemon(status, body));
    expect(out.reply).toMatchObject({ ok: false, problem });
    expect(out.status).toBe(problem === 'not_found' ? 404 : 400);
  });

  it('keeps a subscription while Lemon Squeezy says it is active', async () => {
    const ok = await checkLicense({ action: 'validate', licenseKey: KEY, instanceId: 'inst-1' }, CONFIG, lemon(200, { valid: true, license_key: { status: 'active' }, meta: META }));
    expect(ok.reply).toEqual({ ok: true, instanceId: 'inst-1' });
    const ended = await checkLicense({ action: 'validate', licenseKey: KEY, instanceId: 'inst-1' }, CONFIG, lemon(200, { valid: false, license_key: { status: 'expired' }, meta: META }));
    expect(ended.reply).toMatchObject({ ok: false, problem: 'expired' });
    const removed = await checkLicense({ action: 'validate', licenseKey: KEY, instanceId: 'gone' }, CONFIG, lemon(404, { valid: false, error: 'instance_id not found.', meta: META }));
    expect(removed.reply).toMatchObject({ ok: false, problem: 'invalid', message: expect.stringMatching(/device was removed/) });
  });

  it('reports a temporary problem when Lemon Squeezy is unreachable or failing', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await checkLicense({ action: 'activate', licenseKey: KEY }, CONFIG, down)).toMatchObject({ status: 502, reply: { problem: 'unavailable' } });
    expect(await checkLicense({ action: 'activate', licenseKey: KEY }, CONFIG, lemon(503, {}))).toMatchObject({ status: 502, reply: { problem: 'unavailable' } });
  });

  it('frees a device', async () => {
    const out = await checkLicense({ action: 'deactivate', licenseKey: KEY, instanceId: 'inst-1' }, CONFIG, lemon(200, { deactivated: true, license_key: { status: 'inactive' }, meta: META }));
    expect(out.reply).toEqual({ ok: true, instanceId: 'inst-1' });
  });
});

describe('POST /api/license on the Node server', () => {
  let server: Server | null = null;
  afterEach(async () => {
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
    server = null;
  });
  const start = async (opts: Parameters<typeof createApp>[0]) => {
    const app = createApp(opts);
    server = createServer((req, res) => void app(req, res));
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/api/license`;
  };
  const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('says payments are not set up until the store and product are configured', async () => {
    const url = await start({ debrief: null, model: 'm' });
    const res = await post(url, { action: 'activate', licenseKey: KEY });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, problem: 'unavailable' });
  });

  it('checks keys with Lemon Squeezy', async () => {
    const lemonSqueezy = lemon(200, { activated: true, license_key: { status: 'active' }, instance: { id: 'inst-9' }, meta: META });
    const url = await start({ debrief: null, model: 'm', license: CONFIG, fetch: lemonSqueezy });
    const res = await post(url, { action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI on Android' });
    expect(await res.json()).toEqual({ ok: true, instanceId: 'inst-9' });
    expect((await post(url, { action: 'activate', licenseKey: 'nope' })).status).toBe(400);
    expect((await fetch(url)).status).toBe(405);
    expect(lemonSqueezy).toHaveBeenCalledTimes(1);
  });
});

describe('the Vercel function', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function call(body: unknown, method = 'POST') {
    const req = Object.assign(Readable.from([JSON.stringify(body)]), { method, headers: { 'content-type': 'application/json' } }) as unknown as IncomingMessage;
    const out = { status: 0, headers: {} as Record<string, string>, body: '' };
    const res = {
      set statusCode(s: number) {
        out.status = s;
      },
      setHeader: (k: string, v: string) => (out.headers[k] = v),
      end: (b: string) => (out.body = b),
    } as unknown as ServerResponse;
    await handler(req, res);
    return { ...out, json: JSON.parse(out.body) as unknown };
  }

  it('uses the store and product from the environment', async () => {
    vi.stubEnv('LEMONSQUEEZY_STORE_ID', '11');
    vi.stubEnv('LEMONSQUEEZY_PRODUCT_ID', '22');
    vi.stubGlobal('fetch', lemon(200, { valid: true, license_key: { status: 'active' }, meta: META }));
    const out = await call({ action: 'validate', licenseKey: KEY, instanceId: 'inst-1' });
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ ok: true, instanceId: 'inst-1' });
    expect(out.headers['Cache-Control']).toBe('no-store');
  });

  it('refuses when payments are not set up, and anything but POST', async () => {
    vi.stubEnv('LEMONSQUEEZY_STORE_ID', '');
    expect((await call({ action: 'activate', licenseKey: KEY })).status).toBe(503);
    expect((await call({}, 'GET')).status).toBe(405);
  });
});
