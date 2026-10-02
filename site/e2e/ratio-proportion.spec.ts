import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ratio-proportion/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const canvas = (page: Page) => page.locator('kg-problem-canvas');
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tap = (page: Page, name: string) => canvas(page).getByRole(/[؟?]$/.test(name) ? 'radio' : 'button', { name, exact: true }).click();
async function cell(page: Page, r: number, c: number, v: string) {
  const i = canvas(page).locator(`input[data-r="${r}"][data-c="${c}"]`);
  await i.fill(v);
  await i.press('Tab');
}
const answer = (page: Page) => canvas(page).locator('input[data-a="answer"]');
const fbNo = (page: Page) => page.locator('.feedback.no');
const fbOk = (page: Page) => page.locator('.feedback.ok');

test('fa-IR milk and calcium: given cells are fixed, the additive 23 is caught, 24 and 5 pass', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(canvas(page).locator('th')).toHaveText(['شیر (لیتر)', 'کلسیم (گرم)']);
  await expect(canvas(page).locator('td.given')).toHaveText(['۱۰', '۱۲', '۱۵', '۱۸', '۲۰', '۶']);
  await tap(page, 'در آزمایش اول، ۱۰ لیتر شیر ۱۲ گرم کلسیم داشت.');
  await tap(page, 'در آزمایش دوم، ۱۵ لیتر شیر ۱۸ گرم کلسیم داشت.');
  await tap(page, '۲۰ لیتر شیر چند گرم کلسیم دارد؟ و برای ۶ گرم کلسیم چند لیتر شیر لازم است؟');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('خانه‌های خالی');
  await cell(page, 2, 1, '۲۳');
  await cell(page, 3, 0, '۵');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('چند برابر');
  await cell(page, 2, 1, '۲۴');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۲ × ۱۲ = ۲۴');
});

test('fa-IR honey drink: the computed drink column checks the last row; 40 cups of honey is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'شربت را با ۱ پیمانه عسل و ۳ پیمانه آب درست می‌کنیم.');
  await tap(page, 'برای جشن مدرسه ۱۲۰ پیمانه شربت لازم است.');
  await tap(page, 'چند پیمانه عسل لازم است؟');
  await expect(canvas(page).locator('td.calc')).toHaveText(['۴', '۸', '۱۲', '…']);
  await cell(page, 3, 0, '۴۰');
  await cell(page, 3, 1, '۱۲۰');
  await expect(canvas(page).locator('td.calc').last()).toHaveText('۱۶۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('باید ۱۲۰ شود');
  await cell(page, 3, 0, '۳۰');
  await cell(page, 3, 1, '۹۰');
  await expect(canvas(page).locator('td.calc').last()).toHaveText('۱۲۰');
  await answer(page).fill('۴۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('نه همهٔ شربت');
  await answer(page).fill('۳۰');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۳۰ + ۹۰ = ۱۲۰');
});

test('en unitary method: price of 1 first, then 7; skipping the unit and adding are caught', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(1).click();
  await tap(page, '4 pencils cost 120p.');
  await tap(page, 'Sara wants 7 of the same pencils.');
  await tap(page, 'The pencils come in 12 colours.');
  await tap(page, 'How much will Sara pay for 7 pencils?');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('colours');
  await tap(page, 'The pencils come in 12 colours.');
  await cell(page, 1, 1, '40');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('a quarter of 120');
  await cell(page, 1, 1, '30');
  await answer(page).fill('840');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('28 pencils');
  await answer(page).fill('123');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('only 3p more');
  await answer(page).fill('210');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('7 × 30 = 210p');
});

test('en inverse proportion: workers × days stays 96; thinking "fewer workers, fewer days" is caught', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, '12 workers build a wall in 8 days.');
  await tap(page, 'How many days would 3 workers take to build the same wall?');
  await expect(canvas(page).locator('th')).toHaveText(['workers', 'days', 'workers × days']);
  await cell(page, 1, 1, '4');
  await cell(page, 2, 1, '24');
  await expect(canvas(page).locator('td.calc')).toHaveText(['96', '24', '96']);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('must be 96 in every row');
  await cell(page, 1, 1, '16');
  await answer(page).fill('2');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('takes longer');
  await answer(page).fill('32');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('96 ÷ 3 = 32');
});

test('every mission fits 390px with no horizontal scroll, and targets are at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(canvas(page).locator('.kg-pc-table')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await canvas(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toBe(0);
    }
  }
});
