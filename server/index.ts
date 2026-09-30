/**
 * TRACK AI Coach server: hosts the built app and the optional AI debrief endpoint.
 *
 *   npm run build && npm start          # http://localhost:8787
 *
 * Environment:
 *   ANTHROPIC_API_KEY   enables AI debriefs (any credential the Anthropic SDK accepts works)
 *   COACH_MODEL         Claude model for debriefs (default claude-opus-5)
 *   PORT                listen port (default 8787)
 *   ALLOWED_ORIGINS     comma-separated origins allowed to call the API when the frontend is
 *                       hosted elsewhere (e.g. https://you.github.io)
 *   DEBRIEFS_PER_MINUTE per-IP rate limit (default 12)
 *   LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_PRODUCT_ID
 *                       the subscription that unlocks the app (see api/license.ts)
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { licenseConfig } from '../api/license';
import { createApp } from './app';
import { createDebriefer, DEFAULT_MODEL } from './debrief';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const model = process.env.COACH_MODEL?.trim() || DEFAULT_MODEL;

/**
 * The SDK resolves credentials from env vars, an `ant auth login` profile or workload identity
 * federation. We only switch the feature on when one of those looks configured; a rejected
 * credential later just makes the app fall back to its on-device summary.
 */
function credentialsConfigured(): boolean {
  const env = process.env;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE || env.ANTHROPIC_FEDERATION_RULE_ID) return true;
  const configDir = path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'anthropic');
  return existsSync(configDir);
}

function makeClient(): Anthropic | null {
  if (!credentialsConfigured()) return null;
  try {
    return new Anthropic();
  } catch (err) {
    console.warn(`AI debrief disabled: ${(err as Error).message}`);
    return null;
  }
}

const client = makeClient();
const handler = createApp({
  distDir: path.resolve(here, '../dist'),
  debrief: client ? createDebriefer(client, { model }) : null,
  model,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  ratePerMinute: Number(process.env.DEBRIEFS_PER_MINUTE ?? 12),
  license: licenseConfig(),
});

createServer((req, res) => void handler(req, res)).listen(port, () => {
  console.log(`TRACK AI Coach on http://localhost:${port}`);
  console.log(client ? `AI debrief: on (${model})` : 'AI debrief: off — set ANTHROPIC_API_KEY to enable it (the app falls back to on-device summaries)');
  console.log(licenseConfig() ? 'License checks: on' : 'License checks: off — set LEMONSQUEEZY_STORE_ID and LEMONSQUEEZY_PRODUCT_ID for subscriptions');
});
