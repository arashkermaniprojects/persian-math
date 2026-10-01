import { expect, test } from '@playwright/test';

const bar = (page: import('@playwright/test').Page, i: number) => page.locator(`kg-fraction-bars .kg-fb-row[data-bar="${i}"]`);

test('fa-IR: shade the same amount as 2/4 on eighths (too little, then right)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-equivalent/');
  await expect(page.locator('kg-fraction-bars')).toHaveAttribute('compare', '');
  const cells = bar(page, 1).locator('.kg-fb-cell');
  await expect(cells).toHaveCount(8);
  // The reference bar is not interactive.
  await expect(bar(page, 0).locator('button.kg-fb-cell')).toHaveCount(0);

  await cells.nth(0).click();
  await cells.nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('کم است');

  await cells.nth(2).click();
  await cells.nth(3).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: re-partition 1/3 keeping the amount; 4 parts cannot show it, 6 parts can', async ({ page }) => {
  await page.goto('/en/studio/frac-equivalent/');
  await page.locator('.mission-tab').nth(1).click();
  const more = page.getByRole('button', { name: 'more parts, bar 2' });

  await more.click();
  await expect(bar(page, 1).locator('.kg-fb-cell')).toHaveCount(4);
  await expect(bar(page, 1).locator('.kg-fb-cell.on')).toHaveCount(0);
  await expect(bar(page, 1).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '?/4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('middle of a part');

  await more.click();
  await more.click();
  await expect(bar(page, 1).locator('.kg-fb-cell.on')).toHaveCount(2);
  await expect(bar(page, 1).locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '2/6');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: simplify 6/8 (not simplest, then 3/4)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-equivalent/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator('.kg-fi-n').fill('۶');
  await page.locator('.kg-fi-d').fill('۸');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('ساده‌ترش');

  await page.locator('.kg-fi-n').fill('۳');
  await page.locator('.kg-fi-d').fill('۴');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 2/3 with denominator 12 (wrong denominator, then 8/12)', async ({ page }) => {
  await page.goto('/en/studio/frac-equivalent/');
  await page.locator('.mission-tab').nth(3).click();
  const more = page.getByRole('button', { name: 'more parts, bar 2' });
  for (let i = 0; i < 3; i++) await more.click();
  await expect(bar(page, 1).locator('.kg-fb-cell')).toHaveCount(12);
  await expect(bar(page, 1).locator('.kg-fb-cell.on')).toHaveCount(8);
  await expect(more).toHaveCount(1);

  await page.locator('.kg-fi-n').fill('4');
  await page.locator('.kg-fi-d').fill('6');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText("denominator isn't 12");

  await page.locator('.kg-fi-n').fill('8');
  await page.locator('.kg-fi-d').fill('12');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-equivalent/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
