import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-place-value-10000/`;
const pv = (page: Page) => page.locator('kg-place-value');
// data-i = place index from the ones: 0 ones, 1 tens, 2 hundreds, 3 thousands.
const btn = (page: Page, act: string, i: number) => pv(page).locator(`button[data-act="${act}"][data-i="${i}"]`);
const press = async (page: Page, act: string, i: number, n: number) => { for (let k = 0; k < n; k++) await btn(page, act, i).click(); };
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن', exact: true }).click();
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR: ten hundreds into a thousand (wrong: not exchanged, then right)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۰', '۱۳', '۰', '۴']); // thousands … ones, left to right
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز ۱۳ صفحه');
  await btn(page, 'up', 2).click();
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۱', '۳', '۰', '۴']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۳۰۴');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: read 3062 (wrong: dropped zero) and expanded form (wrong: 475)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(pv(page).locator('button[data-act]')).toHaveCount(0);
  await page.locator('.int-input').fill('۳۶۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۳۶۲ نوشتی');
  await page.locator('.int-input').fill('۳۰۶۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await press(page, 'add', 2, 4);
  await press(page, 'add', 1, 7);
  await press(page, 'add', 0, 5);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('این ۴۷۵ است');
  await press(page, 'sub', 2, 4);
  await press(page, 'sub', 1, 7);
  await press(page, 'add', 3, 4);
  await press(page, 'add', 2, 7);
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۴', '۷', '۰', '۵']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۴۷۰۵');
});

test('fa-IR: compare from the highest place; the Roman mission is hidden', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.mission-tab')).toHaveCount(4);
  await tab(page, 3);
  await expect(pv(page).locator('.kg-pv-row')).toHaveCount(2);
  await expect(pv(page).locator('.kg-pv-vis.hl')).toHaveCount(2); // the thousands, in both numbers
  await page.locator('.choice').nth(0).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مثل مریم');
  await page.locator('.choice').nth(1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: Roman numerals on C/X/I counters (wrong: XL read as 60, then right)', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('.mission-tab')).toHaveCount(5);
  await tab(page, 4);
  await press(page, 'add', 2, 2);
  await press(page, 'add', 1, 6);
  await press(page, 'add', 0, 6);
  await expect(pv(page).locator('.kg-pv-t').first()).toHaveText('C');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('50 + 10');
  await press(page, 'sub', 1, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('246');
});

test('en: read with a zero (wrong: as heard), then right', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await page.locator('.int-input').fill('300062');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('the way we say it');
  await page.locator('.int-input').fill('3062');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('3062');
});

test('no horizontal scroll at 390px on any mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    for (let i = 0; i < n; i++) {
      await tab(page, i);
      await expect(pv(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
