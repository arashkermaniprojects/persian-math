import { expect, test, type Page } from '@playwright/test';

const URL_FA = '/fa-IR/studio/num-place-value-100/';
const URL_EN = '/en/studio/num-place-value-100/';
const pv = (page: Page) => page.locator('kg-place-value');
// Column index in the buttons: data-i 0 = ones, 1 = tens.
const btn = (page: Page, act: string, i: number) => pv(page).locator(`button[data-act="${act}"][data-i="${i}"]`);
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('fa-IR: bundle ten ones (wrong: unbundled, then right), Iranian blocks by default', async ({ page }) => {
  await page.goto(URL_FA);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pv(page).locator('.kg-pv')).toHaveAttribute('data-view', 'blocks');
  await expect(pv(page).locator('.kg-pv-u')).toHaveCount(14);
  await expect(pv(page).locator('.kg-pv-g.full')).toHaveCount(1);
  await expect(pv(page).locator('.kg-pv-cell.over')).toHaveText('۱۴');

  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('هنوز ۱۰ تا یکی');

  await btn(page, 'up', 0).click();
  await expect(pv(page).locator('.kg-pv-r')).toHaveCount(1);
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۱', '۴']); // tens on the left, ones on the right
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: read the number, with targeted feedback for reversed digits', async ({ page }) => {
  await page.goto(URL_FA);
  await page.locator('.mission-tab').nth(1).click();
  await expect(pv(page).locator('button[data-act]')).toHaveCount(0); // locked picture
  await expect(pv(page).locator('.kg-pv-cell')).toHaveCount(0); // no table: it would give the answer away
  await page.locator('.int-input').fill('۷۴');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('جای رقم‌ها');
  await page.locator('.int-input').fill('۴۷');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: add three tens (wrong: ones added), on the abacus view', async ({ page }) => {
  await page.goto(URL_FA);
  await page.locator('.mission-tab').nth(2).click();
  await pv(page).getByRole('button', { name: 'چرتکه' }).click();
  await expect(pv(page).locator('.kg-pv')).toHaveAttribute('data-view', 'abacus');
  await expect(pv(page).locator('.kg-pv-b')).toHaveCount(7);
  for (let k = 0; k < 3; k++) await btn(page, 'add', 0).click();
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('۳ تا یکی اضافه کردی');
  for (let k = 0; k < 3; k++) await btn(page, 'sub', 0).click();
  for (let k = 0; k < 3; k++) await btn(page, 'add', 1).click();
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۵', '۵']);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: break a ten to take away 5 (wrong: took a ten), keyboard only', async ({ page }) => {
  await page.goto(URL_EN);
  await page.locator('.mission-tab').nth(3).click();
  await expect(pv(page).locator('.kg-pv')).toHaveAttribute('data-view', 'blocks');
  await expect(btn(page, 'sub', 0)).toBeEnabled();
  await btn(page, 'sub', 1).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('whole ten');
  await btn(page, 'add', 1).click();

  // Keyboard: focus the break button and press Enter; focus stays put across re-renders.
  await btn(page, 'down', 1).focus();
  await page.keyboard.press('Enter');
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['2', '12']);
  await expect(pv(page).locator('.kg-pv-live')).toContainText('12 ones');
  await btn(page, 'sub', 0).focus();
  for (let k = 0; k < 5; k++) await page.keyboard.press('Enter');
  await expect(btn(page, 'sub', 0)).toBeFocused();
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['2', '7']);
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: wrong then right on bundling and adding tens; aria labels come from the studio', async ({ page }) => {
  await page.goto(URL_EN);
  await btn(page, 'add', 0).click(); // 15 now
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('should stay 14');
  await btn(page, 'sub', 0).click();
  await page.getByRole('button', { name: 'Exchange 10 ones for 1 ten' }).click();
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await page.locator('.mission-tab').nth(1).click();
  await page.locator('.int-input').fill('11');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('You added 4 and 7');
  await page.locator('.int-input').fill('47');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width on any mission', async ({ page }) => {
  for (const url of [URL_FA, URL_EN]) {
    await page.goto(url);
    for (let i = 0; i < 4; i++) {
      await page.locator('.mission-tab').nth(i).click();
      await expect(pv(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${url} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
