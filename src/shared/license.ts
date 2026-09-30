/**
 * Contract between the app and its license endpoint (`POST /api/license`), which checks
 * subscribers' Lemon Squeezy license keys. Types only, so the Vercel function can share it.
 */

export type LicenseAction = 'activate' | 'validate' | 'deactivate';

export interface LicenseRequest {
  action: LicenseAction;
  licenseKey: string;
  /** activate: a name for this device, e.g. "TRACK AI on iPhone". */
  instanceName?: string;
  /** validate / deactivate: the id that activate returned for this device. */
  instanceId?: string;
}

/**
 * Why a key was refused. `unavailable` is temporary (Lemon Squeezy didn't answer, or payments aren't
 * set up yet); the others are Lemon Squeezy's final word on the key.
 */
export type LicenseProblem = 'not_found' | 'limit' | 'expired' | 'disabled' | 'wrong_product' | 'invalid' | 'unavailable';

export type LicenseReply = { ok: true; instanceId?: string } | { ok: false; problem: LicenseProblem; message: string };
