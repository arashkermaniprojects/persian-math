import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-factors-primes/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const longer = (page: Page, name: string, n: number) =>
  (async () => { for (let i = 0; i < n; i++) await page.getByRole('button', { name, exact: true }).click(); })();

test('fa-IR rectangles of 12: a short row is caught, then 3 rows of 4', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('kg-counters .kg-ct-array .kg-ct-c')).toHaveCount(12);
  // Only the row length can change: no row buttons
  await expect(page.getByRole('button', { name: 'یک ردیف بیشتر' })).toHaveCount(0);
  await longer(page, 'یکی بیشتر در هر ردیف', 4);
  await expect(page.locator('kg-counters .kg-ct-array.short')).toHaveCount(1);
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ردیف آخر ناقص است');
  await page.getByRole('button', { name: 'یکی کمتر در هر ردیف', exact: true }).click();
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تعداد ردیف‌هاست');
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR factor tree of 60: an unfinished tree is caught, then 60 = 2 × 2 × 3 × 5', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await page.locator('kg-counters button.kg-ct-v').click();
  await page.getByRole('button', { name: '۶ × ۱۰', exact: true }).click();
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز شاخه‌ای هست');
  await page.locator('kg-counters button.kg-ct-v', { hasText: /^۶$/ }).click();
  await page.getByRole('button', { name: '۲ × ۳', exact: true }).click();
  await page.locator('kg-counters button.kg-ct-v', { hasText: /^۱۰$/ }).click();
  await page.getByRole('button', { name: '۲ × ۵', exact: true }).click();
  await expect(page.locator('kg-counters .kg-ct-v.prime')).toHaveCount(4);
  await tile(page, '۱۰').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('اول نیست');
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: factors of 18 and the prime 13, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 1);
  await expect(page.locator('kg-counters .kg-ct-array .kg-ct-c')).toHaveCount(18);
  await longer(page, 'one more in each row', 2);
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('number of pairs');
  await tile(page, '4').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("Don't forget 1 and 18");
  await tile(page, '6').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('1, 2, 3, 6, 9 and 18');

  await tab(page, 2);
  await longer(page, 'one more in each row', 2);
  await expect(page.locator('kg-counters .kg-ct-array.short')).toHaveCount(1);
  await tile(page, '1').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('last row is short');
  await page.getByRole('button', { name: 'one fewer in each row', exact: true }).click();
  await page.getByRole('button', { name: 'one fewer in each row', exact: true }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('13 is also a factor');
  await tile(page, '2').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('prime');
});

test('en factor tree: a different first split reaches the same primes', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  await page.locator('kg-counters button.kg-ct-v').click();
  await page.getByRole('button', { name: '4 × 15', exact: true }).click();
  await page.locator('kg-counters button.kg-ct-v', { hasText: /^15$/ }).click();
  await page.getByRole('button', { name: '3 × 5', exact: true }).click();
  await page.locator('kg-counters button.kg-ct-v', { hasText: /^4$/ }).click();
  await page.getByRole('button', { name: '2 × 2', exact: true }).click();
  await expect(page.locator('kg-counters .kg-ct-v.prime')).toHaveCount(4);
  await tile(page, '5').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('60 = 2 × 2 × 3 × 5');
});

test('no horizontal scroll at 390px on any mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(4);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(page.locator('kg-counters .kg-ct-pick')).toBeVisible();
      if (m < 3) await longer(page, loc === 'en' ? 'one more in each row' : 'یکی بیشتر در هر ردیف', 11);
      else {
        // Grow the whole factor tree: the widest it gets.
        await page.locator('kg-counters button.kg-ct-v').click();
        await page.locator('kg-counters .kg-ct-pairs button').nth(0).click();
        await page.locator('kg-counters button.kg-ct-v').last().click();
        await page.locator('kg-counters .kg-ct-pairs button').nth(0).click();
        await page.locator('kg-counters button.kg-ct-v').last().click();
        await page.locator('kg-counters .kg-ct-pairs button').nth(0).click();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
