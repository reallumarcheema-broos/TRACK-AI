import { useCallback, useEffect, useState } from 'react';
import type { ExerciseId } from '../core/exercise';
import type { FacingMode } from '../pose/camera';
import type { ModelQuality } from '../pose/detector';

export interface Settings {
  voice: boolean;
  /** Preferred speech voice name, null = automatic. */
  voiceName: string | null;
  speechRate: number;
  sfx: boolean;
  /** Ask the AI coach for a debrief after each set (needs the server + API key). */
  aiDebrief: boolean;
  facingMode: FacingMode;
  /** null = pick automatically for the device. */
  model: ModelQuality | null;
  showSkeleton: boolean;
  /** Last target used per exercise. */
  targets: Partial<Record<ExerciseId, number>>;
}

export const DEFAULT_SETTINGS: Settings = {
  voice: true,
  voiceName: null,
  speechRate: 1.05,
  sfx: true,
  aiDebrief: true,
  facingMode: 'user',
  model: null,
  showSkeleton: true,
  targets: {},
};

const KEY = 'track-ai:settings:v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode / storage full: settings just won't persist.
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  useEffect(() => saveSettings(settings), [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update];
}
