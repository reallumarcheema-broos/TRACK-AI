import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CHECKOUT = 'https://track-ai.lemonsqueezy.com/buy/abc-123';
const KEY = '38B1460A-5104-4067-A91D-77B872934D51';
const DAY = 24 * 3600_000;

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

// The checkout link is read when the module loads, so each test imports a fresh copy.
async function load(checkout: string | null = CHECKOUT) {
  vi.resetModules();
  vi.stubEnv('VITE_CHECKOUT_URL', checkout ?? '');
  return import('./license');
}

/** The app's /api/license endpoint answering with `body`. */
const server = (...bodies: object[]) => {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(bodies.length > 1 ? bodies.shift() : bodies[0]));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
const offline = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );
const sent = (fetch: ReturnType<typeof server>, call = 0) => JSON.parse(String(fetch.mock.calls[call][1]?.body)) as Record<string, string>;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the paid plan', () => {
  it('is all free until a checkout link is set', async () => {
    const pay = await load(null);
    for (let i = 0; i < 5; i++) pay.recordWorkout();
    expect(pay.getAccess()).toEqual({ kind: 'open' });
    expect(pay.canStartWorkout()).toBe(true);
  });

  it('gives three free workouts, then asks to subscribe', async () => {
    const pay = await load();
    expect(pay.getAccess()).toEqual({ kind: 'free', left: 3, ended: false });
    pay.recordWorkout();
    pay.recordWorkout();
    expect(pay.canStartWorkout()).toBe(true);
    pay.recordWorkout();
    expect(pay.getAccess()).toEqual({ kind: 'free', left: 0, ended: false });
    expect(pay.canStartWorkout()).toBe(false);
  });

  it('unlocks with a license key', async () => {
    const pay = await load();
    const fetch = server({ ok: true, instanceId: 'inst-1' });
    expect(await pay.activateLicense(`  ${KEY} `)).toEqual({ ok: true, instanceId: 'inst-1' });
    expect(fetch.mock.calls[0][0]).toBe('/api/license');
    expect(sent(fetch)).toEqual({ action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI on this device' });
    expect(pay.getAccess()).toEqual({ kind: 'subscribed' });
    expect(pay.canStartWorkout()).toBe(true);
  });

  it('stays locked when the key is refused or the server is unreachable', async () => {
    const pay = await load();
    server({ ok: false, problem: 'not_found', message: "We couldn't find that license key." });
    expect(await pay.activateLicense(KEY)).toMatchObject({ ok: false, problem: 'not_found' });
    offline();
    expect(await pay.activateLicense(KEY)).toMatchObject({ ok: false, problem: 'unavailable' });
    expect(pay.getAccess().kind).toBe('free');
  });

  it('checks the subscription about once a day and locks when it ends', async () => {
    const pay = await load();
    const fetch = server({ ok: true, instanceId: 'inst-1' }, { ok: true, instanceId: 'inst-1' }, { ok: false, problem: 'expired', message: 'ended' });
    await pay.activateLicense(KEY);
    await pay.refreshLicense();
    expect(fetch).toHaveBeenCalledTimes(1); // not due yet

    vi.setSystemTime(Date.now() + DAY + 1);
    await pay.refreshLicense();
    expect(sent(fetch, 1)).toEqual({ action: 'validate', licenseKey: KEY, instanceId: 'inst-1' });
    expect(pay.getAccess()).toEqual({ kind: 'subscribed' });

    vi.setSystemTime(Date.now() + DAY + 1);
    await pay.refreshLicense();
    // Subscribing used up the free trial, so an ended subscription locks straight away.
    expect(pay.getAccess()).toEqual({ kind: 'free', left: 0, ended: true });
  });

  it('keeps working offline for two weeks, then asks to reconnect', async () => {
    const pay = await load();
    server({ ok: true, instanceId: 'inst-1' });
    await pay.activateLicense(KEY);
    offline();
    vi.setSystemTime(Date.now() + 13 * DAY);
    await pay.refreshLicense();
    expect(pay.getAccess()).toEqual({ kind: 'subscribed' });

    vi.setSystemTime(Date.now() + 2 * DAY);
    await pay.refreshLicense();
    expect(pay.getAccess()).toEqual({ kind: 'recheck' });
    expect(pay.canStartWorkout()).toBe(false);

    server({ ok: true, instanceId: 'inst-1' });
    await pay.refreshLicense(true);
    expect(pay.getAccess()).toEqual({ kind: 'subscribed' });
  });

  it('frees this device for another one', async () => {
    const pay = await load();
    const fetch = server({ ok: true, instanceId: 'inst-1' });
    await pay.activateLicense(KEY);
    expect(await pay.removeLicense()).toMatchObject({ ok: true });
    expect(sent(fetch, 1)).toEqual({ action: 'deactivate', licenseKey: KEY, instanceId: 'inst-1' });
    expect(pay.getAccess()).toEqual({ kind: 'free', left: 0, ended: false });
  });

  it('links to the Lemon Squeezy customer portal and names the device', async () => {
    const pay = await load();
    expect(pay.billingUrl()).toBe('https://track-ai.lemonsqueezy.com/billing');
    expect(pay.deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('TRACK AI on iPhone');
    expect(pay.deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 7)')).toBe('TRACK AI on Android');
  });
});
