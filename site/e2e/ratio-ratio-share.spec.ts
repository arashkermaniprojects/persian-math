import { expect, test } from '@playwright/test';

const cells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: build 2 : 3 (2 of 3 parts first, then 2 of 5)', async ({ page }) => {
  await page.goto('/fa-IR/studio/ratio-ratio-share/');
  const more = page.getByRole('button', { name: 'قسمت‌های بیشتر' });
  await more.click();
  await more.click();
  await expect(page.locator(cells)).toHaveCount(3);
  await page.locator(cells).nth(0).click();
  await page.locator(cells).nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('شیره زیاد');

  await page.locator(cells).nth(0).click();
  await page.locator(cells).nth(1).click();
  await more.click();
  await more.click();
  await expect(page.locator(cells)).toHaveCount(5);
  await page.locator(cells).nth(0).click();
  await page.locator(cells).nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: simplify 6 : 9 (subtracting gives 2 : 5)', async ({ page }) => {
  await page.goto('/en/studio/ratio-ratio-share/');
  await page.locator('.mission-tab').nth(1).click();
  await page.locator('.int-input').fill('5');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('took 4 off');

  await page.getByRole('button', { name: 'fewer parts' }).click();
  await page.getByRole('button', { name: 'fewer parts' }).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell')).toHaveCount(5);
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.on')).toHaveCount(2);
  await page.locator('.int-input').fill('3');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: ratio 3 : 4 to the fraction of girls', async ({ page }) => {
  await page.goto('/fa-IR/studio/ratio-ratio-share/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator('.kg-fi-n').fill('۴');
  await page.locator('.kg-fi-d').fill('۳');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('همهٔ کلاس');

  await page.locator('.kg-fi-d').fill('۷');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: share 28 in the ratio 3 : 4', async ({ page }) => {
  await page.goto('/en/studio/ratio-ratio-share/');
  await page.locator('.mission-tab').nth(3).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.given')).toHaveCount(3);
  for (let i = 0; i < 4; i++) await page.locator(cells).nth(i).click();
  await page.locator('.int-input').fill('7');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('7 equal parts');

  await page.locator('.int-input').fill('16');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/ratio-ratio-share/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
