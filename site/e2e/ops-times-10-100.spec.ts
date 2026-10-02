import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-times-10-100/`;
const pv = (page: Page) => page.locator('kg-place-value');
const act = (page: Page, a: 'x10' | 'd10') => pv(page).locator(`button[data-act="${a}"]`).click();
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن', exact: true }).click();
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const cells = (page: Page) => pv(page).locator('.kg-pv-cell');

test('fa-IR: 34 × 10 slides the digits (wrong: ×10 twice, then right)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(cells(page)).toHaveText(['۰', '۰', '۳', '۴']);
  await act(page, 'x10');
  await expect(cells(page)).toHaveText(['۰', '۳', '۴', '۰']);
  await act(page, 'x10');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بار ×۱۰');
  await act(page, 'd10');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۳۴۰');
});

test('fa-IR: 3.45 × 10 across the decimal mark «/» (wrong: not yet moved)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(pv(page).locator('.kg-pv-cell[data-mark="/"]')).toHaveText('۳'); // the mark sits right of the ones
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('×۱۰ را بزن');
  await act(page, 'x10');
  await expect(cells(page)).toHaveText(['۳', '۴', '۵', '۰']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 3600 ÷ 100 (wrong: only ÷10 once) and 4.7 ÷ 10 (wrong way first)', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  await act(page, 'd10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('That\'s 3600 ÷ 10');
  await act(page, 'd10');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('36');

  await tab(page, 4);
  await act(page, 'x10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('moved left');
  await act(page, 'd10');
  await act(page, 'd10');
  await expect(cells(page)).toHaveText(['0', '0', '4', '7']);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('0.47');
});

test('en: 207 × 100 keeps the middle zero (wrong: once)', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await act(page, 'x10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('207 × 10');
  await act(page, 'x10');
  await expect(cells(page)).toHaveText(['2', '0', '7', '0', '0']);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px on any mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let i = 0; i < 5; i++) {
      await tab(page, i);
      await expect(pv(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
