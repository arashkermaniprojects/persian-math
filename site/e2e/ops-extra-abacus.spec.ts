import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-extra-abacus/`;
const pv = (page: Page) => page.locator('kg-place-value');
// data-i 0 = ones rod, 1 = tens rod.
const btn = (page: Page, act: string, i: number) => pv(page).locator(`button[data-act="${act}"][data-i="${i}"]`);
const press = async (page: Page, act: string, i: number, n: number) => { for (let k = 0; k < n; k++) await btn(page, act, i).click(); };
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن', exact: true }).click();
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR: 15 + 8 on the abacus, exchanging ten ones beads (wrong: not exchanged)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(pv(page).locator('.kg-pv')).toHaveAttribute('data-view', 'abacus');
  await expect(pv(page).locator('.kg-pv-views')).toHaveCount(0);
  await expect(pv(page).locator('.kg-pv-b')).toHaveCount(6);
  await press(page, 'add', 0, 8);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱۰ مهره یا بیشتر');
  await btn(page, 'up', 0).click();
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۲', '۳']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۳');
});

test('fa-IR: 42 − 17 (wrong: smaller from larger gives 35), then break a ten', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await btn(page, 'sub', 1).click();
  await press(page, 'add', 0, 3);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مثل رضا');
  await btn(page, 'add', 1).click();
  await press(page, 'sub', 0, 3); // back to 42
  await btn(page, 'down', 1).click();
  await expect(pv(page).locator('.kg-pv-cell')).toHaveText(['۳', '۱۲']);
  await press(page, 'sub', 0, 7);
  await btn(page, 'sub', 1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۵');
});

test('en: 28 + 13 (wrong: forgot the ten, then not exchanged, then right)', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await press(page, 'add', 0, 3);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('forgot the 1 ten');
  await btn(page, 'add', 1).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Press ← 10');
  await btn(page, 'up', 0).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('41');
});

test('en: 25 − 12 (wrong: beads added), then right', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  await btn(page, 'add', 1).click();
  await press(page, 'add', 0, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('take them off');
  await btn(page, 'sub', 1).click();
  await press(page, 'sub', 0, 2);
  await btn(page, 'sub', 1).click();
  await press(page, 'sub', 0, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('13');
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
