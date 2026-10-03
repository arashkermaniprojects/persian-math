import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/prob-experiments/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = (n: number) => String(n).replace(/\d/g, (d) => FA[+d]);

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
const sim = (page: Page) => page.locator('kg-probability-sim');
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const run = (page: Page, re: RegExp) => sim(page).getByRole('button', { name: re }).click();
type Chance = { trials: number; tally: Record<string, number>; events?: { key: string; truth: string }[] };
const engineState = (page: Page) => sim(page).evaluate((el) => (el as unknown as { state: { chance: Chance } }).state.chance);
async function typeFrac(page: Page, n: string, d: string) {
  await page.locator('.kg-fi-n').fill(n);
  await page.locator('.kg-fi-d').fill(d);
}
/** The level buttons of one event on the probability scale (left to right: impossible … certain). */
const stops = (page: Page, i: number) => sim(page).locator('.kg-ps-stops').nth(i).getByRole('radio');

test('fa-IR unequal spinner: spin 100 times, then 1/3 (equal sectors) and 1/2', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(sim(page).locator('.kg-ps-spin path[class^="c-"]')).toHaveCount(3);
  await typeFrac(page, '۱', '۳');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دست‌کم ۱۰۰ بار');

  await run(page, /^بچرخان, ۱۰۰ بار$/);
  await expect(sim(page).locator('.kg-ps-tally caption')).toHaveText('آزمایش: ۱۰۰ بار');
  // bars with a theory tick, and the theory column 1/2, 1/4, 1/4
  await expect(sim(page).locator('.kg-ps-bar i')).toHaveCount(3);
  await expect(sim(page).locator('.kg-ps-tally tr').nth(1).locator('td').last().locator('.frac')).toHaveAttribute('aria-label', '1/2');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هم‌اندازه نیستند');

  await typeFrac(page, '۲', '۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR bottle cap: 10 throws are not enough; the count is not the fraction; then the own estimate', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await run(page, /^بینداز, ۱۰ بار$/);
  await typeFrac(page, '۵', '۱۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱۰ آزمایش برای تخمین کافی نیست');

  await run(page, /^بینداز, ۱۰۰۰ بار$/);
  const s = await engineState(page);
  expect(s.trials).toBe(1010);
  const heads = s.tally.heads;
  // a bent cap: heads is clearly under a half (7/20 in theory)
  expect(heads / s.trials).toBeGreaterThan(0.29);
  expect(heads / s.trials).toBeLessThan(0.41);
  await typeFrac(page, fa(heads), '۱');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تعداد «رو»هاست');
  await typeFrac(page, '۱', '۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('با جدول تو جور نیست');
  await typeFrac(page, fa(heads), fa(s.trials));
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR biased die: judging from 10 rolls is refused, hundreds of rolls show the 6', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(sim(page).locator('.kg-ps-tile')).toHaveCount(6);
  await sim(page).locator('.kg-ps-tile').nth(5).click();
  await run(page, /^تاس بریز, ۱۰ بار$/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('با ۱۰ بار نمی‌شود فهمید');

  await run(page, /^تاس بریز, ۱۰۰۰ بار$/);
  const s = await engineState(page);
  const most = Object.entries(s.tally).sort((a, b) => b[1] - a[1])[0][0];
  expect(most).toBe('6');
  await sim(page).locator('.kg-ps-tile').nth(2).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کدام عدد از همه بیشتر آمده');
  await sim(page).locator('.kg-ps-tile').nth(5).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR no memory: "heads is due" is caught, then all three on the scale', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(sim(page).locator('.kg-ps-line .lbl')).toHaveText(['غیرممکن', 'کم‌احتمال', 'شانس برابر', 'محتمل', 'حتمی']);
  await stops(page, 0).nth(3).click();
  await stops(page, 1).nth(2).click();
  await stops(page, 2).nth(1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سکه یادش نیست');
  await stops(page, 0).nth(2).click();
  await stops(page, 2).nth(3).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تاس نمی‌داند');
  await stops(page, 2).nth(1).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: fair dice estimate, wrong then right; unequal spinner; heads-due', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 2);
  await run(page, /^Roll, 1000 times$/);
  const s = await engineState(page);
  const six = s.tally['6'];
  await typeFrac(page, String(six), '1');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("That's the number of sixes");
  await typeFrac(page, String(six + 40), '1000');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("doesn't have to be");
  await typeFrac(page, String(six), '1000');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 0);
  await run(page, /^Spin, 1000 times$/);
  await typeFrac(page, '1', '4');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Too small');
  await typeFrac(page, '1', '2');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 4);
  for (const [e, l] of [[0, 2], [1, 3], [2, 1]]) await stops(page, e).nth(l).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("isn't a habit");
  await stops(page, 1).nth(2).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px and 44px buttons on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 5; m++) {
      await tab(page, m);
      await expect(sim(page)).toBeVisible();
      await sim(page).locator('.kg-ps-run .go').last().click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await sim(page).locator('button').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: buttons under 44px`).toBe(0);
    }
  }
});
