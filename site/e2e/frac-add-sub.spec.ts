import { expect, test } from '@playwright/test';

const learnerCells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: add 3/7 to the given 2/7 (too much first, then right)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-add-sub/');
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.given')).toHaveCount(2);
  const cells = page.locator(learnerCells);
  await expect(cells).toHaveCount(5);
  for (let i = 0; i < 5; i++) await cells.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('زیادی رنگ کرده‌ای');

  await cells.nth(4).click();
  await cells.nth(3).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: 1/2 + 1/4 needs re-partitioning to quarters', async ({ page }) => {
  await page.goto('/en/studio/frac-add-sub/');
  await page.locator('.mission-tab').nth(1).click();
  // Shading the other half adds a half, not a quarter
  await page.locator(learnerCells).first().click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText("That's too much");

  // + skips 3 parts (cannot show a half) and goes straight to 4; the given half becomes 2 quarters
  await page.getByRole('button', { name: 'more parts' }).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell')).toHaveCount(4);
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.given')).toHaveCount(2);
  await page.locator(learnerCells).first().click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '3/4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 3/4 − 1/3 gives targeted feedback for 2/1, then accepts 5/12', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-add-sub/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator('.kg-fi-n').fill('۲');
  await page.locator('.kg-fi-d').fill('۱');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('جدا جدا');

  await page.locator('.kg-fi-n').fill('۵');
  await page.locator('.kg-fi-d').fill('۱۲');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 1 1/2 + 3/4 must be written as a mixed number', async ({ page }) => {
  await page.goto('/en/studio/frac-add-sub/');
  await page.locator('.mission-tab').nth(3).click();
  await page.locator(learnerCells).nth(0).click();
  await page.locator(learnerCells).nth(1).click();
  await page.locator(learnerCells).nth(2).click();
  await page.locator('.kg-fi-n').fill('9');
  await page.locator('.kg-fi-d').fill('4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('mixed number');

  await page.locator('.kg-fi-w').fill('2');
  await page.locator('.kg-fi-n').fill('1');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-add-sub/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
