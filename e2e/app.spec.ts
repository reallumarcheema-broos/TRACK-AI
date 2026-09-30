import { expect, test } from '@playwright/test';

test('home lists every exercise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
  for (const name of ['Squat', 'Push-up', 'Lunge', 'Romanian Deadlift', 'Bicep Curl', 'Shoulder Press', 'Jumping Jacks', 'Plank']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
});

// `?sim` swaps the demo video for the synthetic test athlete, so these runs are deterministic.
test('a demo set is tracked, coached and summarised', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByRole('button', { name: /Jumping Jacks/ }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: /Watch a demo/ }).click();

  // Live HUD: reps climb, the coach talks, form issues are flagged.
  await expect(page.locator('.counter .value')).toHaveText('3', { timeout: 30_000 });
  await expect(page.locator('.caption')).toContainText(/Three/);
  await expect(page.locator('.hint.ready, .fault')).not.toHaveCount(0);

  // Summary once the target is reached.
  await expect(page.getByText('Jumping Jacks · set complete')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.stat').first()).toContainText('10/10');
  // No AI server configured in this test → on-device debrief.
  await expect(page.locator('.coach-says p')).toContainText(/10 reps/);
  await expect(page.getByText('What to work on')).toBeVisible();

  // The set is saved.
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.locator('.list-item').first()).toContainText('Jumping Jacks');
});

test('Install on iPhone explains Add to Home Screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Install on iPhone' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Install on iPhone' });
  await expect(sheet).toContainText('Add to Home Screen');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Install on Android' }).first()).toBeVisible();
});

test('the install sheet behaves like a phone popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Install on iPhone' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Install on iPhone' });
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused();
  // Keyboard focus cycles inside the sheet and the page behind it doesn't scroll.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  // The phone's back gesture closes the sheet and stays on the page.
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

test('home-screen shortcuts open the right screen', async ({ page }) => {
  await page.goto('/?view=history');
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await page.goto('/?exercise=plank');
  await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
});

test('settings persist across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const skeleton = page.getByRole('switch', { name: 'Skeleton overlay' });
  await expect(skeleton).toHaveAttribute('aria-checked', 'true');
  await skeleton.click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Skeleton overlay' })).toHaveAttribute('aria-checked', 'false');
});

test('the browser back button walks back through screens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Squat/ }).click();
  await expect(page.getByRole('heading', { name: 'Squat' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
});
