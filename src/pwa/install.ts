/**
 * "Get the app": TRACK AI installs straight from the website as a home-screen app (a PWA) — its own
 * icon, full screen, works offline, no app store. Android and desktop Chrome/Edge offer a real
 * install prompt; iPhone and iPad install through Share → Add to Home Screen.
 */
import { useSyncExternalStore } from 'react';

export type Platform = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** iPadOS reports itself as a Mac, so a touch screen gives it away. */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Instagram, Facebook, TikTok… open links in their own browser, which can't install apps. */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Twitter|Snapchat|MicroMessenger|LinkedInApp|Pinterest/i.test(ua);
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Call once at startup, before the browser fires its install events. */
export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's prompt for our own button instead of its default banner.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    changed();
  });
}

/** Running as the installed app (from the home screen) rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Shows the browser's own install dialog when it offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  changed();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

export interface InstallState {
  platform: Platform;
  /** Already running as the installed app. */
  standalone: boolean;
  /** Installed during this visit. */
  installed: boolean;
  /** The browser offered a one-tap install. */
  canPrompt: boolean;
  inAppBrowser: boolean;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useInstall(): InstallState {
  useSyncExternalStore(subscribe, () => version);
  return {
    platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    standalone: isStandalone(),
    installed,
    canPrompt: deferred !== null,
    inAppBrowser: isInAppBrowser(navigator.userAgent),
  };
}
