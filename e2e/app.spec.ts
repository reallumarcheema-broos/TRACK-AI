import { expect, test } from '@playwright/test';

test('home lists every exercise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
  for (const name of ['Squat', 'Push-up', 'Lunge', 'Romanian Deadlift', 'Bicep Curl', 'Shoulder Press', 'Jumping Jacks', 'Plank']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
});

test('a demo set is tracked, coached and summarised', async ({ page }) => {
  await page.goto('/');
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
