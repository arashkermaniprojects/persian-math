import { expect, test } from '@playwright/test';

test('fa-IR: shade a quarter, get targeted feedback, then succeed and unlock "why"', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-what-is/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const cells = page.locator('kg-fraction-bars .kg-fb-cell');
  await expect(cells).toHaveCount(4);

  // Two parts shaded → "too big" feedback
  await cells.nth(0).click();
  await cells.nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('زیادی رنگ کرده‌ای');

  // Fix it → success, explanation box appears
  await cells.nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
  await expect(page.locator('.mission-tab').first()).toHaveClass(/done/);
});

test('fa-IR: typed Persian digits are accepted in the fraction input', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-what-is/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator('.kg-fi-n').fill('۲');
  await page.locator('.kg-fi-d').fill('۵');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: re-partition the bar to sixths and shade one', async ({ page }) => {
  await page.goto('/en/studio/frac-what-is/');
  await page.locator('.mission-tab').nth(3).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'more parts' }).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell')).toHaveCount(6);
  await page.locator('kg-fraction-bars .kg-fb-cell').first().click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '1/6');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-what-is/`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
