import { expect, test } from '@playwright/test';

const cells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: 0.3 on the hundred square (3 squares first, then 30)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-fdp-percent/');
  const c = page.locator(cells);
  await expect(c).toHaveCount(100);
  for (let i = 0; i < 3; i++) await c.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('صدم');

  for (let i = 3; i < 30; i++) await c.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: 3/5 as a percentage (35% trap, then fifths → tenths → 60)', async ({ page }) => {
  await page.goto('/en/studio/frac-fdp-percent/');
  await page.locator('.mission-tab').nth(1).click();
  await page.locator('.int-input').fill('35');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('side by side');

  await page.getByRole('button', { name: 'more parts' }).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell')).toHaveCount(10);
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '6/10');
  await page.locator('.int-input').fill('60');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 30% of 50 (subtracting first, then 15)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-fdp-percent/');
  await page.locator('.mission-tab').nth(2).click();
  for (let i = 0; i < 3; i++) await page.locator(cells).nth(i).click();
  await page.locator('.int-input').fill('۲۰');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('کم کرده‌ای');

  await page.locator('.int-input').fill('۱۵');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 18 out of 20 as a percentage', async ({ page }) => {
  await page.goto('/en/studio/frac-fdp-percent/');
  await page.locator('.mission-tab').nth(3).click();
  await page.locator('.int-input').fill('18');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('right answers');

  // 20 → 15 (cannot show 18/20: "?") → 10
  await page.getByRole('button', { name: 'fewer parts' }).click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '?/15');
  await page.getByRole('button', { name: 'fewer parts' }).click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '9/10');
  await page.locator('.int-input').fill('90');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-fdp-percent/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
