import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-mul-div-groups/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const drops = (page: Page) => page.locator('kg-counters .kg-ct-zone > .kg-ct-btn');
const plate = (page: Page, i: number) => page.locator('kg-counters .kg-ct-zone.group').nth(i).locator('.kg-ct-c');
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR equal groups: 3 + 4 is caught, then 3 plates of 4 make 12', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-ct-sent')).toHaveText('۳×۴=?');
  await expect(drops(page)).toHaveCount(3);
  // Uneven plates first
  await drops(page).nth(0).click();
  await tile(page, '۱۲').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مساوی نیستند');

  for (let p = 0; p < 3; p++) for (let k = p === 0 ? 1 : 0; k < 4; k++) await drops(page).nth(p).click();
  for (let p = 1; p <= 3; p++) await expect(plate(page, p)).toHaveCount(4);
  await expect(plate(page, 0)).toHaveCount(3);
  await tile(page, '۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('را حساب کردی. ولی ۳ دسته');

  await tile(page, '۱۲').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR sharing: unfinished dealing is caught, then 12 ÷ 3 = 4', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(plate(page, 0)).toHaveCount(12);
  for (let r = 0; r < 3; r++) for (let p = 0; p < 3; p++) await drops(page).nth(p).click();
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز سیب در سبد مانده');

  for (let p = 0; p < 3; p++) await drops(page).nth(p).click();
  await expect(plate(page, 0)).toHaveCount(0);
  // A counter tapped on a plate goes back to the basket
  await plate(page, 1).first().click();
  await expect(plate(page, 0)).toHaveCount(1);
  await drops(page).nth(0).click();
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تعداد بشقاب‌هاست');
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۲ ÷ ۳ = ۴');
});

test('fa-IR split array: 20 + 2 is caught, then 4 × 7 = 28', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  const cells = page.locator('kg-counters .kg-ct-array button.kg-ct-c');
  await expect(cells).toHaveCount(28);
  await tile(page, '۲۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ستون پنجم');
  await cells.nth(4).click();
  await expect(page.locator('kg-counters .kg-ct-array .kg-ct-c.c1')).toHaveCount(8);
  await tile(page, '۲۲').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۴ × ۲ = ۸');
  await tile(page, '۲۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: build an array, then group 15 into rows of 5', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 1);
  const more = (n: string) => page.getByRole('button', { name: n, exact: true });
  for (let i = 0; i < 3; i++) await more('more rows').click();
  for (let i = 0; i < 3; i++) await more('one more in each row').click();
  await tile(page, '16').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('4 rows with 5');
  await more('one more in each row').click();
  await expect(page.locator('kg-counters .kg-ct-array .kg-ct-c')).toHaveCount(20);
  await tile(page, '9').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('You worked out 4 + 5');
  // Turned the other way round still passes: 5 rows of 4 is the same 20.
  await page.getByRole('button', { name: 'turn' }).click();
  await tile(page, '20').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('4 × 5 = 20');

  await tab(page, 4);
  for (let i = 0; i < 3; i++) await more('one more in each row').click();
  await expect(page.locator('kg-counters .kg-ct-array.short')).toHaveCount(1);
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Each row needs 5');
  await more('one more in each row').click();
  await expect(page.locator('kg-counters .kg-ct-array.short')).toHaveCount(0);
  await tile(page, '5').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('number of rows');
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en equal groups and sharing: wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  for (let p = 0; p < 3; p++) for (let k = 0; k < 4; k++) await drops(page).nth(p).click();
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('one plate');
  await tile(page, '12').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  for (let r = 0; r < 4; r++) for (let p = 0; p < 3; p++) await drops(page).nth(p).click();
  await tile(page, '9').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('12 − 3');
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(5);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(page.locator('kg-counters .kg-ct-pick')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
