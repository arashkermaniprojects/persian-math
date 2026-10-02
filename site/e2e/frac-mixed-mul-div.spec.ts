import { expect, test } from '@playwright/test';

const cells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: half of 2 2/3 on three area-model bars', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-mixed-mul-div/');
  await expect(page.locator(cells)).toHaveCount(18);
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.tint')).toHaveCount(16);
  const rows = page.locator('kg-fraction-bars .kg-fb-row');
  // All the stripes of bars 1 and 2 (12 sixths = 2): too much
  for (const r of [0, 1]) for (let i = 0; i < 6; i++) await rows.nth(r).locator('button.kg-fb-cell').nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('زیادی');

  // Keep only row 1 of bars 1 and 2 (cells 0–2), then the two striped cells in row 1 of bar 3
  for (const r of [0, 1]) for (let i = 3; i < 6; i++) await rows.nth(r).locator('button.kg-fb-cell').nth(i).click();
  for (let i = 0; i < 2; i++) await rows.nth(2).locator('button.kg-fb-cell').nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 1 1/3 × 2 1/2 adds a third of the blue cells', async ({ page }) => {
  await page.goto('/en/studio/frac-mixed-mul-div/');
  await page.locator('.mission-tab').nth(1).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.given')).toHaveCount(15);
  // Only 1/3 × 1/2 (one cell): too little
  await page.locator(cells).first().click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('2 cells');

  for (let i = 1; i < 5; i++) await page.locator(cells).nth(i).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 2 1/2 ÷ 1 1/4 (dividing in pieces gives 4)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-mixed-mul-div/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator('.int-input').fill('۴');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('جدا تقسیم');

  await page.locator('.int-input').fill('۲');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: order of operations (left to right first, then 2 5/6)', async ({ page }) => {
  await page.goto('/en/studio/frac-mixed-mul-div/');
  await page.locator('.mission-tab').nth(3).click();
  await page.locator('.kg-fi-w').fill('5');
  await page.locator('.kg-fi-n').fill('1');
  await page.locator('.kg-fi-d').fill('3');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('left to right');

  await page.locator('.kg-fi-w').fill('');
  await page.locator('.kg-fi-n').fill('17');
  await page.locator('.kg-fi-d').fill('6');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('mixed number');

  await page.locator('.kg-fi-w').fill('2');
  await page.locator('.kg-fi-n').fill('5');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-mixed-mul-div/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
