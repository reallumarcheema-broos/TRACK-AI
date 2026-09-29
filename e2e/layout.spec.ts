import { expect, test, type Page } from '@playwright/test';

/** HUD pieces that must stay on screen and never cover each other. */
const HUD = ['.hud-top', '.demo-tag', '.hint', '.gauge', '.scoreboard', '.caption', '.rep-dots', '.hud-actions'];

async function hudProblems(page: Page): Promise<string[]> {
  return page.evaluate((selectors) => {
    const problems: string[] = [];
    const boxes = selectors
      .map((s) => [s, document.querySelector(s)?.getBoundingClientRect()] as const)
      .filter((entry): entry is readonly [string, DOMRect] => !!entry[1] && entry[1].width > 0);
    for (const el of document.querySelectorAll('.hud button, .hud-title, .fault, .caption')) {
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1) problems.push(`off-screen: ${el.className}`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i];
        const [b, rb] = boxes[j];
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 2 && y > 2) problems.push(`overlap: ${a} × ${b}`);
      }
    }
    return problems;
  }, HUD);
}

test.describe('small phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('a long exercise name and a form alert fit on screen', async ({ page }) => {
    await page.goto('/?demo=rdl&sim');
    await expect(page.locator('.fault.bad, .fault.warn')).toBeVisible({ timeout: 45_000 });
    expect(await hudProblems(page)).toEqual([]);
  });
});

test.describe('landscape phone', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('the push-up HUD leaves room for the depth gauge', async ({ page }) => {
    await page.goto('/?demo=pushup&sim');
    await expect(page.locator('.fault.bad, .fault.warn')).toBeVisible({ timeout: 45_000 });
    expect(await hudProblems(page)).toEqual([]);
  });

  test('setup actions sit side by side instead of covering the page', async ({ page }) => {
    await page.goto('/?exercise=squat&sim');
    const start = await page.getByRole('button', { name: /Start set/ }).boundingBox();
    const demo = await page.getByRole('button', { name: /Watch a demo/ }).boundingBox();
    expect(start).not.toBeNull();
    expect(demo).not.toBeNull();
    expect(Math.abs(start!.y - demo!.y)).toBeLessThan(2);
  });
});
