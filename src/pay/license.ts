/**
 * The paid plan: the first FREE_WORKOUTS sets are free, then a Lemon Squeezy subscription unlocks the
 * app. With no VITE_CHECKOUT_URL at build time there is no paywall at all.
 *
 * Everything runs on the device, so this is a gate for honest people rather than copy protection:
 * /api/license checks the key when it's entered and about once a day after that.
 */
import { useSyncExternalStore } from 'react';
import { API_BASE } from '../api';
import type { LicenseReply, LicenseRequest } from '../shared/license';

/** The Lemon Squeezy checkout link for the subscription. */
export const CHECKOUT_URL = (import.meta.env.VITE_CHECKOUT_URL as string | undefined)?.trim() || null;
export const PAYMENTS_ON = CHECKOUT_URL !== null;
/** Shown in the app; the price itself is set in Lemon Squeezy. */
export const PRICE = (import.meta.env.VITE_PRICE as string | undefined)?.trim() || '$14.99';
export const FREE_WORKOUTS = 3;

/** Lemon Squeezy's customer portal, where subscribers change their card or cancel. */
export function billingUrl(): string | null {
  try {
    return CHECKOUT_URL ? `${new URL(CHECKOUT_URL).origin}/billing` : null;
  } catch {
    return null;
  }
}

const LICENSE = 'track-ai:license';
const FREE_USED = 'track-ai:free-workouts';
const ENDED = 'track-ai:subscription-ended';
const DAY = 24 * 3600_000;
/** How often to confirm the subscription with Lemon Squeezy… */
const CHECK_EVERY_MS = DAY;
/** …and how long it keeps working offline in between. */
const OFFLINE_GRACE_MS = 14 * DAY;

interface StoredLicense {
  key: string;
  instanceId: string;
  checkedAt: number;
}

export type Access =
  /** Payments aren't set up: everything is free. */
  | { kind: 'open' }
  | { kind: 'subscribed' }
  /** Subscribed, but offline for too long to confirm it. */
  | { kind: 'recheck' }
  | { kind: 'free'; left: number; ended: boolean };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode / storage full: the unlock lasts until the page closes.
  }
}

function loadLicense(): StoredLicense | null {
  try {
    const v = JSON.parse(read(LICENSE) ?? 'null') as Partial<StoredLicense> | null;
    return v && typeof v.key === 'string' && typeof v.instanceId === 'string' && typeof v.checkedAt === 'number' ? (v as StoredLicense) : null;
  } catch {
    return null;
  }
}

function computeAccess(now: number): Access {
  if (!PAYMENTS_ON) return { kind: 'open' };
  const license = loadLicense();
  if (license) return now - license.checkedAt < OFFLINE_GRACE_MS ? { kind: 'subscribed' } : { kind: 'recheck' };
  const used = Number(read(FREE_USED)) || 0;
  return { kind: 'free', left: Math.max(0, FREE_WORKOUTS - used), ended: read(ENDED) === '1' };
}

let snapshot: Access | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  snapshot = null;
  listeners.forEach((l) => l());
};
// Another tab unlocked the app or used a workout.
const onStorage = (e: StorageEvent) => {
  if (e.key === null || e.key.startsWith('track-ai:')) changed();
};

export function getAccess(): Access {
  return (snapshot ??= computeAccess(Date.now()));
}

export function canStartWorkout(access: Access = getAccess()): boolean {
  return access.kind === 'open' || access.kind === 'subscribed' || (access.kind === 'free' && access.left > 0);
}

/** A subscription replaces the free trial, so the trial can't come back after it. */
function endFreeTrial(): void {
  write(FREE_USED, String(Math.max(FREE_WORKOUTS, Number(read(FREE_USED)) || 0)));
}

/** Counts a finished workout against the free ones. */
export function recordWorkout(): void {
  if (getAccess().kind !== 'free') return;
  write(FREE_USED, String((Number(read(FREE_USED)) || 0) + 1));
  changed();
}

const UNREACHABLE: LicenseReply = {
  ok: false,
  problem: 'unavailable',
  message: "Couldn't reach the payment service. Check your connection and try again.",
};

async function callLicense(body: LicenseRequest): Promise<LicenseReply> {
  try {
    const res = await fetch(`${API_BASE}/api/license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const reply = (await res.json()) as LicenseReply;
    return typeof reply?.ok === 'boolean' ? reply : UNREACHABLE;
  } catch {
    return UNREACHABLE;
  }
}

/** How this device shows up on the license, e.g. "TRACK AI on iPhone". */
export function deviceName(ua = navigator.userAgent): string {
  const device = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : 'this device';
  return `TRACK AI on ${device}`;
}

/** Unlocks the app on this device with the license key from the Lemon Squeezy receipt. */
export async function activateLicense(key: string): Promise<LicenseReply> {
  const licenseKey = key.trim();
  const reply = await callLicense({ action: 'activate', licenseKey, instanceName: deviceName() });
  if (reply.ok && reply.instanceId) {
    const stored: StoredLicense = { key: licenseKey, instanceId: reply.instanceId, checkedAt: Date.now() };
    write(LICENSE, JSON.stringify(stored));
    write(ENDED, null);
    endFreeTrial();
    changed();
  }
  return reply;
}

/** Confirms the subscription is still active: about once a day, or right now when forced. */
export async function refreshLicense(force = false): Promise<void> {
  const license = loadLicense();
  if (!license || (!force && Date.now() - license.checkedAt < CHECK_EVERY_MS)) return;
  const reply = await callLicense({ action: 'validate', licenseKey: license.key, instanceId: license.instanceId });
  if (reply.ok) {
    write(LICENSE, JSON.stringify({ ...license, checkedAt: Date.now() }));
  } else if (reply.problem !== 'unavailable') {
    // Cancelled, refunded or removed from this device.
    write(LICENSE, null);
    write(ENDED, '1');
    endFreeTrial();
  }
  // Offline, the last good check stands until the grace period runs out.
  changed();
}

/** Frees this device's place on the license, to use it on another phone. */
export async function removeLicense(): Promise<LicenseReply> {
  const license = loadLicense();
  if (!license) return { ok: true };
  const reply = await callLicense({ action: 'deactivate', licenseKey: license.key, instanceId: license.instanceId });
  if (reply.ok || reply.problem !== 'unavailable') {
    write(LICENSE, null);
    changed();
  }
  return reply;
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function useAccess(): Access {
  return useSyncExternalStore(subscribe, getAccess);
}
