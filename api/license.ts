/**
 * POST /api/license: checks a subscriber's Lemon Squeezy license key.
 *
 * Deployed as a Vercel function from this folder, and mounted by the Node server (server/app.ts).
 * Kept self-contained (type-only imports) because Vercel loads each function file on its own.
 *
 * Environment: LEMONSQUEEZY_STORE_ID and LEMONSQUEEZY_PRODUCT_ID. Keys from any other store or
 * product are refused. Lemon Squeezy's license API needs no secret key.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LicenseProblem, LicenseReply, LicenseRequest } from '../src/shared/license';

const LEMON_SQUEEZY = 'https://api.lemonsqueezy.com/v1/licenses';
const KEY = /^[A-Za-z0-9-]{8,100}$/;
const INSTANCE_ID = /^[A-Za-z0-9-]{1,100}$/;

const MESSAGES: Record<LicenseProblem, string> = {
  not_found: "We couldn't find that license key. Check it against your receipt email and try again.",
  limit: 'This key is already in use on as many devices as it allows. Remove it from another device (Settings → Subscription) and try again.',
  expired: 'This subscription has ended. Renew it to keep training.',
  disabled: 'This license key has been turned off. If that seems wrong, reply to your receipt email.',
  wrong_product: 'This key is for a different product.',
  invalid: "That key didn't work. Check it and try again.",
  unavailable: "Couldn't reach the payment service. Check your connection and try again.",
};

type Refusal = Extract<LicenseReply, { ok: false }>;
const refuse = (problem: LicenseProblem, message = MESSAGES[problem]): Refusal => ({ ok: false, problem, message });

export interface LicenseConfig {
  storeId: string;
  productId: string;
}

/** Null until both Lemon Squeezy ids are set. */
export function licenseConfig(env: Record<string, string | undefined> = process.env): LicenseConfig | null {
  const storeId = env.LEMONSQUEEZY_STORE_ID?.trim();
  const productId = env.LEMONSQUEEZY_PRODUCT_ID?.trim();
  return storeId && productId ? { storeId, productId } : null;
}

export function parseLicenseRequest(body: unknown): LicenseRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const licenseKey = typeof b.licenseKey === 'string' ? b.licenseKey.trim() : '';
  if (!KEY.test(licenseKey)) return null;
  if (b.action === 'activate') {
    const name = typeof b.instanceName === 'string' ? b.instanceName.trim().slice(0, 100) : '';
    return { action: 'activate', licenseKey, instanceName: name || 'TRACK AI' };
  }
  if (b.action !== 'validate' && b.action !== 'deactivate') return null;
  const instanceId = typeof b.instanceId === 'string' ? b.instanceId.trim() : '';
  return INSTANCE_ID.test(instanceId) ? { action: b.action, licenseKey, instanceId } : null;
}

interface LemonSqueezyReply {
  activated?: boolean;
  valid?: boolean;
  deactivated?: boolean;
  error?: string | null;
  license_key?: { status?: string } | null;
  instance?: { id?: string } | null;
  meta?: { store_id?: number | string; product_id?: number | string } | null;
}

/** Turns Lemon Squeezy's refusal into a problem the app can act on. */
function problemFrom(data: LemonSqueezyReply): Refusal {
  const error = data.error ?? '';
  const status = data.license_key?.status;
  if (/instance/i.test(error)) return refuse('invalid', 'This device was removed from your subscription. Enter your key again to unlock it.');
  if (/not found/i.test(error)) return refuse('not_found');
  if (/activation limit/i.test(error)) return refuse('limit');
  if (/expired/i.test(error) || status === 'expired') return refuse('expired');
  if (/disabled/i.test(error) || status === 'disabled') return refuse('disabled');
  return refuse('invalid');
}

/** Asks Lemon Squeezy about the key. Resolves with the HTTP status and body to send back. */
export async function checkLicense(
  req: LicenseRequest,
  config: LicenseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; reply: LicenseReply }> {
  const form = new URLSearchParams({ license_key: req.licenseKey });
  if (req.instanceName) form.set('instance_name', req.instanceName);
  if (req.instanceId) form.set('instance_id', req.instanceId);
  let res: Response;
  let data: LemonSqueezyReply;
  try {
    res = await fetchImpl(`${LEMON_SQUEEZY}/${req.action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    data = (await res.json()) as LemonSqueezyReply;
  } catch {
    return { status: 502, reply: refuse('unavailable') };
  }
  if (res.status === 429 || res.status >= 500) return { status: 502, reply: refuse('unavailable') };

  const meta = data.meta;
  if (meta && (String(meta.store_id) !== config.storeId || String(meta.product_id) !== config.productId)) {
    return { status: 403, reply: refuse('wrong_product') };
  }
  const done = req.action === 'activate' ? data.activated : req.action === 'validate' ? data.valid : data.deactivated;
  const active = req.action === 'deactivate' || data.license_key?.status === 'active';
  if (done === true && meta && active) {
    const instanceId = req.action === 'activate' ? data.instance?.id : req.instanceId;
    if (req.action !== 'activate' || instanceId) return { status: 200, reply: { ok: true, instanceId } };
  }
  const reply = problemFrom(data);
  return { status: reply.problem === 'not_found' ? 404 : 400, reply };
}

/** Everything after reading the request body; shared by the Vercel function and the Node server. */
export async function answerLicense(
  body: unknown,
  config: LicenseConfig | null,
  fetchImpl?: typeof fetch,
): Promise<{ status: number; reply: LicenseReply }> {
  if (!config) return { status: 503, reply: refuse('unavailable', "Payments aren't set up on this server yet.") };
  const request = parseLicenseRequest(body);
  if (!request) return { status: 400, reply: refuse('invalid', "That doesn't look like a license key.") };
  return checkLicense(request, config, fetchImpl);
}

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  // Vercel parses JSON bodies itself (and throws on bad JSON); a plain Node request is a stream.
  try {
    if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return null;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 4096) return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The Vercel function. */
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(405, { error: 'Use POST' });
  }
  const { status, reply } = await answerLicense(await readJson(req), licenseConfig());
  send(status, reply);
}
