import { expect, test } from '@playwright/test';

test('home starts training without picking an exercise, and says which ones it recognises', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
  await expect(page.getByText('Pick your movement')).toHaveCount(0);
  const worksWith = page.locator('.works-with');
  for (const name of ['squats', 'push-ups', 'lunges', 'Romanian deadlifts', 'bicep curls', 'shoulder presses', 'jumping jacks', 'planks']) {
    await expect(worksWith).toContainText(name);
  }
});

// The demo athlete does lunges and nobody tells the coach which exercise it is.
test('the coach recognises the exercise by itself and keeps the reps', async ({ page }) => {
  await page.goto('/?demo=lunge&auto&sim');
  const exercise = page.getByRole('combobox', { name: 'Exercise' });
  await expect(exercise).toHaveValue('');
  await expect(page.locator('.hint')).toContainText(/recognise|working out/i, { timeout: 20_000 });
  await expect(exercise).toHaveValue('lunge', { timeout: 30_000 });
  await expect(page.locator('.caption')).toContainText("Lunges — got it! That's one.");
  await expect(page.locator('.counter .value')).toHaveText('2', { timeout: 15_000 });

  // A wrong guess can be corrected; the set carries on as the other exercise.
  await exercise.selectOption('squat');
  await expect(page.locator('.caption')).toContainText(/Squats — got it/);
  await exercise.selectOption('lunge');

  await page.getByRole('button', { name: 'Finish set' }).click();
  await expect(page.getByText('Lunge · set complete')).toBeVisible();
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.locator('.list-item').first()).toContainText('Lunge');
});

// `?sim` swaps the demo video for the synthetic test athlete, so these runs are deterministic.
test('a demo set is tracked, coached and summarised', async ({ page }) => {
  // A chosen exercise (the form guides link here) can have a rep target.
  await page.goto('/?exercise=jumping_jack&sim');
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

test('links open the right screen', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Start training' }).click();
  await expect(page.locator('.workout')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: /your ai trainer/i })).toBeVisible();
});

test('the website pages are linked from the app', async ({ page }) => {
  await page.goto('/');
  const site = page.getByRole('navigation', { name: 'Site' });
  for (const [link, heading] of [
    ['Exercise guides', /Move well/i],
    ['About', /An AI trainer in your phone/i],
    ['Privacy policy', /Privacy policy/i],
    ['Terms of use', /Terms of use/i],
  ] as const) {
    await page.goto('/');
    await site.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  // Every guide links back into the coach.
  await page.goto('/guides');
  await page.getByRole('link', { name: 'How to do a squat' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How to do a squat' })).toBeVisible();
  await expect(page.getByText('Knees caving in.')).toBeVisible();
  await page.getByRole('link', { name: 'Start a squat set' }).click();
  await expect(page.getByRole('heading', { name: 'Squat' })).toBeVisible();
  // …and each setup screen links to its guide.
  await page.getByText('Tips for accurate tracking').click();
  await page.getByRole('link', { name: /full squat form guide/ }).click();
  await expect(page).toHaveURL(/\/guides\/squat$/);
});

test('the articles are linked from the home page and lead back to the coach', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Knees caving in when you squat/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Knees caving in when you squat? How to fix it' })).toBeVisible();
  await expect(page.getByText(/min read/)).toBeVisible();
  // Articles link to the form guides…
  await page.getByRole('link', { name: 'squat form guide' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How to do a squat' })).toBeVisible();
  // …the guides link back to the articles about them…
  await expect(page.getByRole('link', { name: 'Knees caving in when you squat? How to fix it' })).toBeVisible();
  // …and the index lists them all.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Articles' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Train smarter' })).toBeVisible();
  await expect(page.locator('.doc-card')).toHaveCount(14);
  await page.getByRole('link', { name: /beginner full-body workout/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /beginner full-body workout/ })).toBeVisible();
  await page.getByRole('link', { name: 'Open the coach' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Your AI trainer/ })).toBeVisible();
});

test('the privacy policy explains Google ads and cookies', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText('Third-party vendors, including Google, use cookies')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ads Settings' })).toHaveAttribute('href', 'https://adssettings.google.com');
  expect((await page.request.get('/robots.txt')).ok()).toBe(true);
});
