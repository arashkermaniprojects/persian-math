import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/stat-bar-line/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
type Loc = keyof typeof CHECK;
const check = (page: Page, loc: Loc) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tab = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();
const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true });

/** Move a bar or point to `v` with the keyboard (from where it is now, one unit per arrow press). */
async function keyTo(page: Page, name: string, v: number) {
  const s = slider(page, name);
  await s.focus();
  const now = Number(await s.getAttribute('aria-valuenow'));
  const k = v >= now ? 'ArrowUp' : 'ArrowDown';
  for (let j = 0; j < Math.abs(v - now); j++) await page.keyboard.press(k);
  await expect(s).toHaveAttribute('aria-valuenow', String(v));
}

/** Drag a bar or point to `v` with the pointer: the column's hit area maps bottom → 0 and top → max. */
async function dragTo(page: Page, name: string, v: number, max: number) {
  const s = slider(page, name);
  const r = (await s.locator('.hit').boundingBox())!;
  const x = r.x + r.width / 2;
  await page.mouse.move(x, r.y + r.height - 2);
  await page.mouse.down();
  await page.mouse.move(x, r.y + r.height * (1 - v / max), { steps: 4 });
  await page.mouse.up();
  await expect(s).toHaveAttribute('aria-valuenow', String(v));
}

const DAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const BOOKS = [5, 8, 3, 6, 7];
const PLANT = [2, 4, 7, 9, 12];

test('fa-IR bar chart: bars drawn to the grid-line count (twice the value) are caught, then dragged to the table', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('kg-chart-builder .kg-cb-table tbody tr').first()).toContainText('شنبه');
  await expect(page.locator('kg-chart-builder .kg-cb-n').first()).toHaveText('۵');
  // The chart runs left → right and its axis numbers are Persian.
  await expect(page.locator('kg-chart-builder .kg-cb-chart')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('kg-chart-builder .kg-cb-svg .lab').filter({ hasText: '۸' }).first()).toBeAttached();
  const first = (await slider(page, DAYS_FA[0]).boundingBox())!;
  const last = (await slider(page, DAYS_FA[4]).boundingBox())!;
  expect(first.x).toBeLessThan(last.x);

  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ستون‌ها را با انگشت بالا بکش');

  // One grid line per book: every bar twice as tall.
  for (let i = 0; i < 5; i++) await keyTo(page, DAYS_FA[i], BOOKS[i] * 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ستون‌ها دو برابر شده‌اند');

  for (let i = 0; i < 5; i++) await dragTo(page, DAYS_FA[i], BOOKS[i], 16);
  await expect(slider(page, 'یکشنبه')).toHaveAttribute('aria-valuetext', `یکشنبه: ${fa(8)}`);
  // Wednesday's 3 left on the grid line for 4: an odd number sits between two lines.
  await keyTo(page, 'دوشنبه', 4);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('عددش وسط دو خط است');
  await keyTo(page, 'دوشنبه', 3);
  await keyTo(page, 'یکشنبه', 10);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('از عددش بلندتر است');
  await keyTo(page, 'یکشنبه', 8);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('یکشنبه با ۸ کتاب');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en bar chart with the keyboard: a short bar is caught, then every bar matches the table', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  for (let i = 0; i < 5; i++) await keyTo(page, DAYS_EN[i], BOOKS[i] - (i === 1 ? 1 : 0));
  await expect(slider(page, 'Fri')).toBeFocused();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('One bar is shorter than its number');
  await slider(page, 'Tue').focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider(page, 'Tue')).toHaveAttribute('aria-valuetext', 'Tue: 8');
  // PageUp moves a whole grid step (2); Home sends the bar back to 0.
  await page.keyboard.press('PageUp');
  await expect(slider(page, 'Tue')).toHaveAttribute('aria-valuenow', '10');
  await page.keyboard.press('Home');
  await expect(slider(page, 'Tue')).toHaveAttribute('aria-valuenow', '0');
  await keyTo(page, 'Tue', 8);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('Tuesday, with 8 books');
});

test('fa-IR read a bar chart: counting grid squares or adding is caught, then the difference ۸', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(page.getByRole('img', { name: 'مریم: ۱۵' })).toBeAttached();
  await expect(page.getByRole('img', { name: 'سارا: ۷' })).toBeAttached();
  await expect(page.locator('kg-chart-builder table')).toHaveCount(0);
  const input = page.locator('.int-input');
  await input.fill('۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر خانه ۲ صفحه است');
  await input.fill('۲۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یعنی تفریق');
  await input.fill('۹');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ستون سارا را ۶ خواندی');
  await input.fill('۸');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۵ − ۷ = ۸');
});

test('en read a bar chart: Maryam\'s total alone is not the difference', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await page.locator('.int-input').fill('15');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('That is all of Maryam\'s pages');
  await page.locator('.int-input').fill('8');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR line graph: points at twice the height are caught, then dragged to the weekly heights', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(page.locator('kg-chart-builder .kg-cb-svg .ln')).toBeAttached();
  await expect(page.locator('kg-chart-builder .kg-cb-svg .ttl').first()).toHaveText('سانتی‌متر');
  for (let i = 0; i < 5; i++) await keyTo(page, fa(i + 1), PLANT[i] * 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('نقطه‌ها دو برابر بالا رفته‌اند');
  for (let i = 0; i < 5; i++) await dragTo(page, fa(i + 1), PLANT[i], 24);
  // The line joins the points left → right in time order: week 1 low on the left, week 5 high on the right.
  const p1 = (await slider(page, '۱').locator('.pt').boundingBox())!;
  const p5 = (await slider(page, '۵').locator('.pt').boundingBox())!;
  expect(p1.x).toBeLessThan(p5.x);
  expect(p1.y).toBeGreaterThan(p5.y);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲، ۴، ۷، ۹ و ۱۲');
});

test('en line graph: 7 left on the grid line for 8, then a point too high, are caught', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  for (let i = 0; i < 5; i++) await keyTo(page, String(i + 1), PLANT[i] + (i === 2 ? 1 : 0));
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('7 is half-way between 6 and 8');
  await keyTo(page, '3', 7);
  await keyTo(page, '5', 16);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('One point is higher than its number');
  await keyTo(page, '5', 12);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR axis from ۱۰۰: reading from 0 at the break or a grid line is caught, then ۱۱۵', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(page.locator('kg-chart-builder .kg-cb-svg .brk')).toBeAttached();
  await expect(page.locator('kg-chart-builder .kg-cb-svg .lab').filter({ hasText: /^۱۰۰$/ })).toHaveCount(1);
  await expect(page.getByRole('img', { name: '۶: ۱۱۵' })).toBeAttached();
  const input = page.locator('.int-input');
  await input.fill('۱۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('پایین محور را صفر گرفتی');
  await input.fill('۱۱۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('وسط ۱۱۰ و ۱۲۰ چند است');
  await input.fill('۱۱۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۱۵ سانتی‌متر');
});

test('en axis from 100: the grid line above is caught, then 115', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  await page.locator('.int-input').fill('120');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('The point is not on a line');
  await page.locator('.int-input').fill('115');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR choose a chart: pie and bar are caught with their reasons, then the line graph', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(page.locator('kg-chart-builder .kg-cb-table')).toBeVisible();
  await expect(page.locator('kg-chart-builder .kg-cb-chart')).toHaveCount(0);
  const kind = (s: string) => page.getByRole('radio', { name: s, exact: true });
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یکی از نمودارها را انتخاب کن');
  await kind('نمودار دایره‌ای').click();
  await expect(kind('نمودار دایره‌ای')).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('قسمت‌های یک کل');
  await kind('نمودار ستونی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('خط بهتر نشان می‌دهد');
  await kind('نمودار خط شکسته').click();
  await expect(kind('نمودار ستونی')).toHaveAttribute('aria-checked', 'false');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('تا ساعت ۱۴ بالا رفت');
});

test('en choose a chart with the keyboard: the pictogram is caught, then the line graph', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 4);
  await page.getByRole('radio', { name: 'pictogram' }).focus();
  await page.keyboard.press('Enter');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Temperature is measured, not counted');
  await page.getByRole('radio', { name: 'line graph' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'line graph' })).toHaveAttribute('aria-checked', 'true');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px and 44px touch targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(5);
    for (let m = 0; m < 5; m++) {
      await tab(page, m);
      await expect(page.locator('kg-chart-builder .kg-cb-hint')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      // Measured in one pass in the page: the chart re-renders, so element handles can go stale between calls.
      const sizes = await page.evaluate(() => [...document.querySelectorAll('kg-chart-builder :is(button, [role="slider"], input), .int-input')]
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => Math.min(r.width, r.height)));
      expect(sizes.length, `${loc} mission ${m + 1} has targets`).toBeGreaterThan(0);
      for (const s of sizes) expect(s, `${loc} mission ${m + 1} target`).toBeGreaterThanOrEqual(44);
    }
  }
});
