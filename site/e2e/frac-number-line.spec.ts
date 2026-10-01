import { expect, test, type Page } from '@playwright/test';

/** Tap the number line on tick i (tick i = i / denominator). */
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const tickX = async (page: Page, i: number) => {
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  return b.x + b.width / 2;
};
const point = (page: Page, n = 0) => page.locator('kg-number-line .kg-nl-pt').nth(n);

test('fa-IR: place 3/4 (too small first), then drag the point to 3/4', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-number-line/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // The line runs left → right even on an RTL page.
  expect(await tickX(page, 0)).toBeLessThan(await tickX(page, 4));

  await tapTick(page, 2);
  await expect(point(page)).toHaveAttribute('aria-valuetext', '2/4');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('کمی جلوتر برو');

  // Drag the point from 2/4 to 3/4.
  const p = (await point(page).boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await page.mouse.move(await tickX(page, 3), p.y + p.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(point(page)).toHaveAttribute('aria-valuetext', '3/4');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: thirds need two points', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-number-line/');
  await page.locator('.mission-tab').nth(1).click();
  await tapTick(page, 1);
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('دقیقاً دو نقطه');
  await tapTick(page, 2);
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveCount(2);
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: place 5/4 with the keyboard only', async ({ page }) => {
  await page.goto('/en/studio/frac-number-line/');
  await page.locator('.mission-tab').nth(2).click();
  const track = page.getByRole('button', { name: 'Number line: tap to place a point' });
  await track.focus();
  await page.keyboard.press('Enter');
  await expect(point(page)).toBeFocused();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(point(page)).toHaveAttribute('aria-valuetext', '6/4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('Too far');
  await point(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(point(page)).toHaveAttribute('aria-valuetext', '5/4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: read the point as a mixed number', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-number-line/');
  await page.locator('.mission-tab').nth(3).click();
  await expect(page.locator('kg-number-line .kg-nl-fixed')).toHaveCount(1);
  await expect(page.locator('kg-number-line .kg-nl-track')).not.toHaveAttribute('tabindex', '0');
  // Forgetting the wholes: 1/3 → too small
  await page.locator('.kg-fi-n').fill('۱');
  await page.locator('.kg-fi-d').fill('۳');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('واحدهای کامل');
  await page.locator('.kg-fi-w').fill('۲');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-number-line/`);
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
