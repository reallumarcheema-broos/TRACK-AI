import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// Playwright's offline mode doesn't reach the service worker, so this test runs its own server
// and switches it off: the real "no connection" a phone has on the train.
const PORT = Number(process.env.E2E_PORT ?? 4318) + 1;
const URL = `http://localhost:${PORT}/`;
let stopServer = async () => {};

test.beforeEach(async () => {
  const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: path.dirname(test.info().config.configFile ?? '.'),
    env: { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: '' },
    stdio: 'ignore',
  });
  const exited = once(server, 'exit');
  stopServer = async () => {
    server.kill();
    await exited;
  };
  await expect(async () => expect((await fetch(URL)).ok).toBe(true)).toPass({ timeout: 15_000 });
});

test.afterEach(() => stopServer());

test('after one visit the whole app works offline', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await stopServer();

  await page.reload();
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
  await page.getByRole('button', { name: /Squat/ }).click();
  await page.getByRole('button', { name: /Start set/ }).click();
  // The workout screen downloads on demand, so it must have been saved on the first visit.
  // (This browser has no camera, so the coach then asks for one.)
  await expect(page.locator('.workout .hud')).toBeVisible();
  await expect(page.getByText(/couldn't find a camera/i)).toBeVisible();
});
