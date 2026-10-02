import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/frac-of-a-set/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const drops = (page: Page) => page.locator('kg-counters .kg-ct-zone > .kg-ct-btn');
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR a third of 12: the denominator as answer is caught, then 4', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // The fraction in the prompt is stacked, never "1/3" inline.
  await expect(page.locator('#missions .frac').first()).toBeVisible();
  await expect(page.locator('.kg-ct-sent')).toHaveText('۱۲÷۳=?');
  for (let r = 0; r < 4; r++) for (let p = 0; p < 3; p++) await drops(page).nth(p).click();
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مخرج');
  await tile(page, '۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بشقاب');
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR three quarters of 20: split after the third column, then 15', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const cells = page.locator('kg-counters .kg-ct-array button.kg-ct-c');
  await expect(cells).toHaveCount(20);
  await tile(page, '۱۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۳ ستون قرمز');
  await cells.nth(2).click();
  await expect(page.locator('kg-counters .kg-ct-array .kg-ct-c.c1')).toHaveCount(5);
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('فقط یک ستون');
  await tile(page, '۱۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: three cakes and soup for two, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 2);
  const empties = page.locator('kg-counters button.kg-ct-empty');
  await expect(empties).toHaveCount(8);
  for (let i = 0; i < 4; i++) await empties.first().click();
  await tile(page, '12').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Each cake needs 4 eggs');
  for (let i = 0; i < 4; i++) await empties.first().click();
  await expect(empties).toHaveCount(0);
  await tile(page, '7').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('3 cakes and each needs 4');
  await tile(page, '12').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  const rows = page.locator('kg-counters .kg-ct-zone.row');
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < 4; i++) await rows.nth(1).locator('button.kg-ct-c').nth(i).click();
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Keep only one row');
  for (let i = 0; i < 4; i++) await rows.nth(2).locator('button.kg-ct-c').nth(i).click();
  await expect(page.locator('kg-counters .kg-ct-c.x')).toHaveCount(8);
  await tile(page, '6').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not half');
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en a third of 12: unequal plates are caught', async ({ page }) => {
  await page.goto(URL('en'));
  for (let i = 0; i < 6; i++) await drops(page).nth(0).click();
  for (let i = 0; i < 6; i++) await drops(page).nth(1).click();
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not equal');
});

test('no horizontal scroll at 390px on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(4);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(page.locator('kg-counters .kg-ct-pick')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
