import { afterEach, describe, expect, it, vi } from 'vitest';

// The switch is read when the module loads, so each test imports a fresh copy.
async function load(setting?: string) {
  vi.resetModules();
  if (setting !== undefined) vi.stubEnv('VITE_AI_DEBRIEF', setting);
  return import('./debrief');
}

describe('AI debrief client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('asks the server whether AI debriefs are on', async () => {
    const fetch = vi.fn(async () => Response.json({ ai: true }));
    vi.stubGlobal('fetch', fetch);
    const { aiDebriefAvailable, AI_DEBRIEF_ENABLED } = await load();
    expect(AI_DEBRIEF_ENABLED).toBe(true);
    expect(await aiDebriefAvailable()).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('never contacts a server when the build turns it off (GitHub Pages)', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { aiDebriefAvailable, fetchDebrief, AI_DEBRIEF_ENABLED } = await load('off');
    expect(AI_DEBRIEF_ENABLED).toBe(false);
    expect(await aiDebriefAvailable()).toBe(false);
    expect(await fetchDebrief({} as Parameters<typeof fetchDebrief>[0])).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
