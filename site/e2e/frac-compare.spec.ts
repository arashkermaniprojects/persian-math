import { expect, test } from '@playwright/test';

const bar = (page: import('@playwright/test').Page, i: number) => page.locator(`kg-fraction-bars .kg-fb-row[data-bar="${i}"]`);

test('fa-IR: same denominator (wrong statement, then right); statements are LTR', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-compare/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const choices = page.locator('.choice');
  await expect(choices).toHaveCount(3);
  expect(await page.locator('.choices').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
  // Both bars line up at the same width.
  const widths = await page.locator('.kg-fb-bar').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);

  await choices.nth(0).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('دهانهٔ باز');

  await choices.nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: 1/3 vs 1/5 targets the "5 is bigger" misconception', async ({ page }) => {
  await page.goto('/en/studio/frac-compare/');
  await page.locator('.mission-tab').nth(1).click();
  await bar(page, 0).locator('.kg-fb-cell').first().click();
  await bar(page, 1).locator('.kg-fb-cell').first().click();
  await expect(bar(page, 0).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '1/3');
  await expect(bar(page, 1).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '1/5');

  await page.locator('.choice').nth(0).click(); // 1/5
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('5 parts');

  await page.locator('.choice').nth(1).click(); // 1/3
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 3/4 vs 5/6 through twelfths', async ({ page }) => {
  await page.goto('/en/studio/frac-compare/');
  await page.locator('.mission-tab').nth(2).click();
  await page.getByRole('button', { name: 'more parts, bar 1' }).click();
  await page.getByRole('button', { name: 'more parts, bar 1' }).click();
  await page.getByRole('button', { name: 'more parts, bar 2' }).click();
  await expect(bar(page, 0).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '9/12');
  await expect(bar(page, 1).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '10/12');

  await page.locator('.choice').nth(0).click(); // "="
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText("aren't the same size");

  await page.locator('.choice').nth(2).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: order three fractions (wrong order, then right)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-compare/');
  await page.locator('.mission-tab').nth(3).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-row')).toHaveCount(3);
  await page.locator('.choice').nth(0).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('عددهای بزرگ‌تر');

  await page.locator('.choice').nth(2).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-compare/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
