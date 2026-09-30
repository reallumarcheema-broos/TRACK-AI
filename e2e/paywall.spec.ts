import { expect, test, type Page } from '@playwright/test';

// The test build's paid plan (see playwright.config.ts); /api/license is answered here, as Lemon
// Squeezy would through it.
const KEY = '38B1460A-5104-4067-A91D-77B872934D51';

const usedFreeWorkouts = (page: Page, n: number) => page.addInitScript((used) => localStorage.setItem('track-ai:free-workouts', String(used)), n);
const subscribed = (page: Page, checkedAt: number) =>
  page.addInitScript(
    ([key, at]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('track-ai:license', JSON.stringify({ key, instanceId: 'inst-1', checkedAt: at }));
        localStorage.setItem('track-ai:free-workouts', '3'); // as unlocking does
        sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, checkedAt] as const,
  );

test('the setup screen counts down the free workouts', async ({ page }) => {
  await usedFreeWorkouts(page, 1);
  await page.goto('/?exercise=squat');
  await expect(page.getByText('2 of 3 free workouts left')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start set/ })).toBeVisible();
});

test('after the free workouts, a license key unlocks the coach', async ({ page }) => {
  await usedFreeWorkouts(page, 3);
  const sent: unknown[] = [];
  await page.route('**/api/license', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true, instanceId: 'inst-1' } });
  });
  await page.goto('/?exercise=squat');
  await expect(page.getByText("You've used your 3 free workouts")).toBeVisible();
  await page.getByRole('button', { name: /Subscribe to start/ }).click();

  const paywall = page.getByRole('dialog', { name: "You've used your 3 free workouts" });
  await expect(paywall.getByRole('link', { name: /Subscribe · \$14\.99\/month/ })).toHaveAttribute('href', 'https://track-ai-test.lemonsqueezy.com/buy/test');
  await paywall.getByRole('button', { name: 'I have a license key' }).click();
  await expect(paywall.getByLabel('License key')).toBeFocused();
  await paywall.getByLabel('License key').fill(KEY);
  await paywall.getByRole('button', { name: 'Unlock' }).click();

  await expect(page.getByRole('dialog', { name: "You're subscribed" })).toBeVisible();
  expect(sent).toEqual([{ action: 'activate', licenseKey: KEY, instanceName: 'TRACK AI on Android' }]);
  await page.getByRole('button', { name: /Start training/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Start set/ }).click();
  await expect(page.locator('.workout .hud')).toBeVisible();
});

test('a refused key says why', async ({ page }) => {
  await usedFreeWorkouts(page, 3);
  await page.route('**/api/license', (route) =>
    route.fulfill({ status: 404, json: { ok: false, problem: 'not_found', message: "We couldn't find that license key." } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Enter key' }).click();
  const paywall = page.getByRole('dialog');
  await paywall.getByLabel('License key').fill(KEY);
  await paywall.getByRole('button', { name: 'Unlock' }).click();
  await expect(paywall.getByRole('alert')).toHaveText("We couldn't find that license key.");
});

test('an ended subscription locks the coach again', async ({ page }) => {
  await subscribed(page, Date.now() - 2 * 24 * 3600_000); // due for its daily check
  await page.route('**/api/license', (route) =>
    route.fulfill({ status: 400, json: { ok: false, problem: 'expired', message: 'This subscription has ended.' } }),
  );
  await page.goto('/?exercise=squat');
  await expect(page.getByText('Your subscription has ended')).toBeVisible();
  await page.getByRole('button', { name: /Subscribe to start/ }).click();
  await expect(page.getByRole('dialog', { name: 'Your subscription has ended' })).toBeVisible();
});

test('subscribers can manage the subscription or move it to another phone', async ({ page }) => {
  await subscribed(page, Date.now());
  await page.route('**/api/license', (route) => route.fulfill({ json: { ok: true, instanceId: 'inst-1' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Active on this device.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', 'https://track-ai-test.lemonsqueezy.com/billing');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Free plan')).toBeVisible();
});

test('the home page shows the price', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Try it free. Then $14.99 a month.' })).toBeVisible();
});
