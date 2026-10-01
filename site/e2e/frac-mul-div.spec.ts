import { expect, test } from '@playwright/test';

const cells = 'kg-fraction-bars button.kg-fb-cell';

test('fa-IR: 3 × 2/5 over two bars (too little first, then 6/5)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-mul-div/');
  const c = page.locator(cells);
  await expect(c).toHaveCount(10);
  for (let i = 0; i < 5; i++) await c.nth(i).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('نوار دوم');

  await c.nth(5).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en: 1/2 of 2/3 with the area model', async ({ page }) => {
  await page.goto('/en/studio/frac-mul-div/');
  await page.locator('.mission-tab').nth(1).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.tint')).toHaveCount(2);
  // One whole column is the right amount but not shown with rows
  await page.locator(cells).first().click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('right amount');

  await page.getByRole('button', { name: 'more rows' }).click();
  await expect(page.locator(cells)).toHaveCount(6);
  await expect(page.locator('kg-fraction-bars .kg-fb-cell.tint')).toHaveCount(4);
  // Row 1, the two striped columns
  await page.locator(cells).nth(0).click();
  await page.locator(cells).nth(1).click();
  await expect(page.locator('.kg-fb-label .frac')).toHaveAttribute('aria-label', '2/6');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: 3/4 ÷ 3, shade one share', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-mul-div/');
  await page.locator('.mission-tab').nth(2).click();
  await page.locator(cells).nth(0).click();
  await page.locator(cells).nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('بیشتر از سهم یک نفر');

  await page.locator(cells).nth(1).click();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 2 ÷ 1/4, both bars split together', async ({ page }) => {
  await page.goto('/en/studio/frac-mul-div/');
  await page.locator('.mission-tab').nth(3).click();
  await page.locator('.int-input').fill('4');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('both bars');

  // linkParts: one set of controls re-partitions both bars
  await expect(page.locator('.kg-fb-parts')).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /more parts/ }).click();
  await expect(page.locator('kg-fraction-bars .kg-fb-cell')).toHaveCount(8);
  await page.locator('.int-input').fill('8');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-mul-div/`);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(page.locator('kg-fraction-bars')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
