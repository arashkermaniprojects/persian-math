import { expect, test, type Page } from '@playwright/test';

async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const point = (page: Page) => page.locator('kg-number-line .kg-nl-pt').first();
const labels = (page: Page) => page.locator('kg-number-line .kg-nl-lab').allTextContents();

test('fa-IR: place 0.7 on a line in tenths (too far first; a tap moves the point)', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-decimals/');
  await expect(page.locator('kg-number-line .kg-nl-lab')).toHaveCount(2);
  expect(await labels(page)).toEqual(['۰', '۱']);
  await tapTick(page, 8);
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('زیادی جلو رفته‌ای');
  await tapTick(page, 7);
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveCount(1);
  await expect(point(page)).toHaveAttribute('aria-valuetext', '۰/۷');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: type the decimal for the point with the Iranian mark: ۰/۳', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-decimals/');
  await page.locator('.mission-tab').nth(1).click();
  const input = page.locator('.int-input');
  await input.fill('۳');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('ممیز را فراموش نکن');
  await input.fill('۰/۳');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 0.3 with a decimal point', async ({ page }) => {
  await page.goto('/en/studio/frac-decimals/');
  await page.locator('.mission-tab').nth(1).click();
  await page.locator('.int-input').fill('0.3');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: compare 0.45 and 0.5 on a zoomed line', async ({ page }) => {
  await page.goto('/fa-IR/studio/frac-decimals/');
  await page.locator('.mission-tab').nth(2).click();
  await expect(page.locator('kg-number-line .kg-nl-win')).toHaveCount(1);
  expect(await labels(page)).toEqual(expect.arrayContaining(['۰/۴', '۰/۶']));
  // Tapping the given 0.5 point places the learner's point at 0.5: too big.
  await tapTick(page, 50);
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('جلوتر است');
  await point(page).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
  await expect(point(page)).toHaveAttribute('aria-valuetext', '۰/۴۵');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: place 1.25 on a hundredths line zoomed to 1.2–1.3', async ({ page }) => {
  await page.goto('/en/studio/frac-decimals/');
  await page.locator('.mission-tab').nth(3).click();
  await expect(page.locator('kg-number-line .kg-nl-win')).toHaveCount(1);
  expect(await labels(page)).toEqual(expect.arrayContaining(['1.2', '1.3']));
  await tapTick(page, 123);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.no')).toContainText('Go a little further');
  await page.getByRole('button', { name: 'Clear points' }).click();
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveCount(0);
  await tapTick(page, 125);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/frac-decimals/`);
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
