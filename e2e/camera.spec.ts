import { expect, test } from '@playwright/test';

// Chromium's fake camera (a synthetic test pattern, no person in it) exercises the real
// pipeline: camera → MediaPipe model → analyzer → coach guidance.
test.use({
  permissions: ['camera'],
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

test('the camera pipeline loads the model and guides an empty frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?exercise=squat');
  await page.getByRole('button', { name: /Start set/ }).click();
  await expect(page.locator('.overlay-center')).toHaveCount(0, { timeout: 90_000 });
  await expect(page.locator('.hint')).toContainText(/can't see you|step into the frame/i);
  expect(errors).toEqual([]);
});
