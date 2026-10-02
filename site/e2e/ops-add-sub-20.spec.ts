import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-add-sub-20/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const tile = (page: Page, n: string) => page.locator('kg-counters .kg-ct-pick').getByRole('radio', { name: n, exact: true });
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();

test('fa-IR make-ten: 8 + 5 fills the first ten, then 3 more', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.kg-ct-sent')).toHaveText('۸+۵=?');
  const plate = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  await expect(plate).toHaveCount(5);
  for (let i = 0; i < 5; i++) await plate.first().click();
  const frames = page.locator('kg-counters .kg-ct-frame');
  await expect(frames.first().locator('.kg-ct-c')).toHaveCount(10);
  await expect(frames.nth(1).locator('.kg-ct-c')).toHaveCount(3);
  await tile(page, '۱۰').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('فقط جدول اول');
  await tile(page, '۱۳').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR back-to-ten and three-numbers', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const apples = page.locator('kg-counters button.kg-ct-c');
  await expect(apples).toHaveCount(13);
  for (const i of [12, 11, 10, 9, 8]) await apples.nth(i).click();
  await tile(page, '۵').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بدون خط');
  await tile(page, '۸').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  const plates = page.locator('kg-counters .kg-ct-zone.group');
  await expect(plates).toHaveCount(3);
  // 4 and 6 first: they make 10
  for (let i = 0; i < 4; i++) await plates.nth(0).locator('button.kg-ct-c').first().click();
  for (let i = 0; i < 6; i++) await plates.nth(2).locator('button.kg-ct-c').first().click();
  await expect(page.locator('kg-counters .kg-ct-frame').first().locator('.kg-ct-c')).toHaveCount(10);
  await tile(page, '۱۰').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز سیب');
  for (let i = 0; i < 7; i++) await plates.nth(1).locator('button.kg-ct-c').first().click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۷ سیب دیگر');
  await tile(page, '۱۷').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR swap and fact family', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(page.locator('.kg-ct-sent')).toHaveText('۲+۹=۹+?');
  await tile(page, '۱۱').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('همهٔ مهره‌هاست');
  await tile(page, '۲').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  const counters = page.locator('kg-counters button.kg-ct-c');
  await expect(counters).toHaveCount(15);
  await expect(page.locator('.kg-ct-bond .whole')).toHaveText('۱۵');
  for (const i of [14, 13, 12, 11, 10]) await counters.nth(i).click();
  await tile(page, '۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۹ مهره قرمز');
  await counters.nth(9).click();
  await expect(page.locator('.kg-ct-bond .part.c1')).toHaveText('۶');
  await tile(page, '۹').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('زردها');
  await tile(page, '۶').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  const plate = page.locator('kg-counters .kg-ct-zone.group button.kg-ct-c');
  for (let i = 0; i < 4; i++) await plate.first().click();
  await tile(page, '12').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('still apples');
  await plate.first().click();
  await tile(page, '3').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('10 and 3');
  await tile(page, '13').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('8 + 5 = 13');

  await tab(page, 1);
  const apples = page.locator('kg-counters button.kg-ct-c');
  for (const i of [12, 11, 10]) await apples.nth(i).click();
  await tile(page, '10').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Cross out 5');
  for (const i of [9, 8]) await apples.nth(i).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('2 more as well');
  await tile(page, '8').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  const plates = page.locator('kg-counters .kg-ct-zone.group');
  for (const [p, n] of [[0, 4], [2, 6], [1, 7]] as const)
    for (let i = 0; i < n; i++) await plates.nth(p).locator('button.kg-ct-c').first().click();
  await tile(page, '11').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('all three plates');
  await tile(page, '17').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await tile(page, '9').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('red counters');
  await tile(page, '2').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  const counters = page.locator('kg-counters button.kg-ct-c');
  for (const i of [9, 10, 11, 12, 13, 14]) await counters.nth(i).click();
  await tile(page, '15').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('only the yellow');
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
      await expect(page.locator('kg-counters .kg-ct-pick')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await page.locator('kg-counters button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});
