import { expect, test } from '@playwright/test';

const cells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: 20% off — shading the discount first, then what you pay', async ({ page }) => {
  await page.goto('/fa-IR/studio/fin-percent-money/');
  await expect(page.locator('#missions')).toContainText('تومان');
  const c = page.locator(cells);
  for (let i = 0; i < 2; i++) await c.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('تخفیف');

  for (let i = 2; i < 8; i++) await c.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: sale price of a £240 bike with 25% off', async ({ page }) => {
  await page.goto('/en/studio/fin-percent-money/');
  await page.locator('.mission-tab').nth(1).click();
  await expect(page.locator('#missions')).toContainText('£240');
  await page.locator('.int-input').fill('215');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('not £25');

  await page.locator('.int-input').fill('180');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: profit percent (120 is the selling price)', async ({ page }) => {
  await page.goto('/fa-IR/studio/fin-percent-money/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator(cells).first().click();
  await page.locator('.int-input').fill('۱۲۰');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('قیمت فروش');

  await page.locator('.int-input').fill('۲۰');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: loss percent is of the cost, not the selling price', async ({ page }) => {
  await page.goto('/en/studio/fin-percent-money/');
  await page.locator('.mission-tab').nth(3).click();
  await page.locator(cells).nth(4).click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '4/5');
  await page.locator('.int-input').fill('25');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('selling price');

  await page.locator('.int-input').fill('20');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/fin-percent-money/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
