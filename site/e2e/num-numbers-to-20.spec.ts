import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-numbers-to-20/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR read-teen: a full ten and 3 is 13, not 3 or 4', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('kg-counters .kg-ct-frame')).toHaveCount(2);
  await expect(page.locator('kg-counters .kg-ct-frame').first().locator('.kg-ct-c')).toHaveCount(10);
  await expect(page.locator('kg-counters .kg-ct-frame').nth(1).locator('.kg-ct-c')).toHaveCount(3);
  await tile(page, '۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جدول پر را هم');
  await tile(page, '۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱۰ مهره است');
  await tile(page, '۱۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR make-teen and one-more: build 16, then one more than 15', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const empty = page.locator('kg-counters button.kg-ct-empty');
  await expect(empty).toHaveCount(20);
  // Wrong: "1 and 6" = 7 counters
  for (let i = 0; i < 7; i++) await empty.first().click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یک جدول پر یعنی ۱۰');
  for (let i = 0; i < 9; i++) await empty.first().click();
  await expect(page.locator('kg-counters .kg-ct-frame').first().locator('.kg-ct-c')).toHaveCount(10);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  // The 15 are fixed; only the new one can be tapped away.
  await expect(page.locator('kg-counters button.kg-ct-c')).toHaveCount(0);
  await page.locator('kg-counters button.kg-ct-empty').first().click();
  await tile(page, '۱۴').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کمتر');
  await tile(page, '۱۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR between and queue: 18, then 6 in front of the seventh', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(page.locator('.kg-ct-sent')).toHaveText('۱۷?۱۹');
  await tile(page, '۱۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بعد');
  await tile(page, '۱۸').click();
  await expect(page.locator('.kg-ct-sent .kg-ct-box')).toHaveText('۱۸');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  const kids = page.locator('kg-counters .kg-ct-row button.kg-ct-c');
  await expect(kids).toHaveCount(10);
  await expect(page.locator('kg-counters .kg-ct-row i').nth(6)).toHaveText('۷');
  await kids.nth(6).click();
  await tile(page, '۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سارا را هم شمردی');
  await tile(page, '۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await tile(page, '10').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('only the full frame');
  await tile(page, '13').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('10 + 3 = 13');

  await tab(page, 1);
  const empty = page.locator('kg-counters button.kg-ct-empty');
  for (let i = 0; i < 17; i++) await empty.first().click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Too many');
  await page.locator('kg-counters button.kg-ct-c').last().click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("haven't added");
  await page.locator('kg-counters button.kg-ct-empty').first().click();
  await tile(page, '16').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await tile(page, '20').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('before');
  await tile(page, '18').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  const kids = page.locator('kg-counters .kg-ct-row button.kg-ct-c');
  await kids.nth(6).click();
  await kids.nth(7).click();
  await tile(page, '6').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Only one');
  await kids.nth(7).click();
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('behind Sara');
  await tile(page, '6').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px and 44px targets on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(5);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(page.locator('kg-counters')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await page.locator('kg-counters button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});
