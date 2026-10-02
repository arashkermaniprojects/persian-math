import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-large-rounding/`;
const pv = (page: Page) => page.locator('kg-place-value');
// data-i = place index from the ones (0 ones … 6 millions).
const btn = (page: Page, act: string, i: number) => pv(page).locator(`button[data-act="${act}"][data-i="${i}"]`);
const press = async (page: Page, act: string, i: number, n: number) => { for (let k = 0; k < n; k++) await btn(page, act, i).click(); };
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن', exact: true }).click();
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR: build two million fifty thousand three hundred in classes (wrong: 250 300)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(pv(page).locator('.kg-pv-class')).toHaveText(['میلیون', 'هزار', 'یکی']);
  await press(page, 'add', 5, 2);
  await press(page, 'add', 4, 5);
  await press(page, 'add', 2, 3);
  await expect(pv(page).locator('.kg-pv-out')).toHaveText('۲۵۰٬۳۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دویست و پنجاه هزار');
  await press(page, 'sub', 5, 2);
  await press(page, 'add', 6, 2);
  await expect(pv(page).locator('.kg-pv-out')).toHaveText('۲٬۰۵۰٬۳۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: round 4682 to the nearest hundred (wrong: rounded down)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(pv(page).locator('.kg-pv-vis.hl')).toHaveCount(1); // hundreds outlined
  await expect(pv(page).locator('.kg-pv-vis.look')).toHaveCount(1); // tens dashed
  await press(page, 'sub', 1, 8);
  await press(page, 'sub', 0, 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۴۶۰۰ نوشتی');
  await btn(page, 'add', 2).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۴۷۰۰');
});

test('en: round 352,481 to the nearest thousand (wrong: rounded up like Hassan)', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  await press(page, 'sub', 2, 4);
  await press(page, 'sub', 1, 8);
  await press(page, 'sub', 0, 1);
  await btn(page, 'add', 3).click();
  await expect(pv(page).locator('.kg-pv-out')).toHaveText('353,000');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('like Hassan');
  await btn(page, 'sub', 3).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('352,000');
});

test('en and fa-IR: estimate a sum (wrong: the exact total), typed with a separator', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  await page.locator('.int-input').fill('6030');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('exact total');
  await page.locator('.int-input').fill('6,000');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await page.locator('.int-input').fill('۵۰۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۳۸۹۰ را ۳۰۰۰ گرفتی');
  await page.locator('.int-input').fill('۶۰۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px on any mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let i = 0; i < 4; i++) {
      await tab(page, i);
      await expect(pv(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
