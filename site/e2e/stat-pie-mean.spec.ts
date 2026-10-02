import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/stat-pie-mean/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tab = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();
const cb = (page: Page) => page.locator('kg-chart-builder');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');
const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

/** Answer the integer box and check. */
async function answer(page: Page, loc: keyof typeof CHECK, v: string) {
  await page.locator('.int-input').fill(v);
  await check(page, loc);
}

// paint-day: 12 sectors, eating and rest 2, travel 2, school 5, homework 3.
const DAY_FA = ['غذا و استراحت', 'رفت و آمد', 'مدرسه', 'تکلیف'];
const DAY_EN = ['eating and rest', 'travel', 'school', 'homework'];
const DAY = [2, 2, 5, 3];

test('fa-IR paint: too many hours for one activity is caught, a second tap clears a part, then the day is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const sectors = cb(page).locator('path.sec[data-a="sector"]');
  await expect(sectors).toHaveCount(12);
  await expect(sectors.first()).toHaveAttribute('aria-label', `${fa(1)}: رنگ نشده`);

  // Checking an empty circle asks for a colour first.
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول یک رنگ را انتخاب کن');

  // Eating and rest gets 3 parts instead of 2.
  await page.getByRole('radio', { name: DAY_FA[0] }).click();
  await expect(page.getByRole('radio', { name: DAY_FA[0] })).toHaveAttribute('aria-checked', 'true');
  for (let j = 0; j < 3; j++) await sectors.nth(j).click();
  await expect(sectors.nth(2)).toHaveAttribute('aria-label', `${fa(3)}: ${DAY_FA[0]}`);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('قسمت‌های زیادی');

  // Tapping a part again with the same colour clears it.
  await sectors.nth(2).click();
  await expect(sectors.nth(2)).toHaveAttribute('aria-label', `${fa(3)}: رنگ نشده`);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز قسمت کم دارد');

  // Parts start at 12 o'clock and go clockwise: part 1 is just right of the top, part 4 is below it on the right.
  const pie = await cb(page).locator('.kg-cb-pie svg').boundingBox();
  const c = { x: pie!.x + pie!.width / 2, y: pie!.y + pie!.height / 2 };
  const b1 = (await sectors.nth(0).boundingBox())!;
  const b4 = (await sectors.nth(3).boundingBox())!;
  expect(b1.x + b1.width / 2).toBeGreaterThan(c.x);
  expect(b1.y + b1.height / 2).toBeLessThan(c.y);
  expect(b4.x + b4.width / 2).toBeGreaterThan(c.x);
  expect(b4.y + b4.height / 2).toBeGreaterThan(c.y);

  let s = 2;
  for (const [i, n] of [[1, 2], [2, 5], [3, 3]] as const) {
    await page.getByRole('radio', { name: DAY_FA[i] }).click();
    for (let k = 0; k < n; k++) await sectors.nth(s++).click();
  }
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
  await expect(ok(page)).toContainText('مدرسه ۵ قسمت از ۱۲ قسمت');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en paint with the keyboard: choose colours and paint parts with Enter and Space', async ({ page }) => {
  await page.goto(URL('en'));
  const sectors = cb(page).locator('path.sec[data-a="sector"]');
  await expect(sectors).toHaveCount(12);
  // Only school painted: the other activities are still short.
  await page.getByRole('radio', { name: 'school' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'school' })).toHaveAttribute('aria-checked', 'true');
  for (let j = 0; j < 5; j++) {
    await sectors.nth(j).focus();
    await page.keyboard.press(j % 2 ? ' ' : 'Enter');
  }
  await expect(sectors.nth(4)).toHaveAttribute('aria-label', '5: school');
  await expect(sectors.nth(4)).toBeFocused(); // focus survives the re-render
  await check(page, 'en');
  await expect(no(page)).toContainText('still needs more parts');

  let s = 5;
  for (const i of [0, 1, 3]) {
    await page.getByRole('radio', { name: DAY_EN[i] }).focus();
    await page.keyboard.press('Space');
    for (let k = 0; k < DAY[i]; k++) {
      await sectors.nth(s++).focus();
      await page.keyboard.press('Enter');
    }
  }
  await expect(sectors.nth(11)).toHaveAttribute('aria-label', '12: homework');
  await check(page, 'en');
  await expect(ok(page)).toContainText('Homework is 3 parts');
  await expect(ok(page).getByRole('math', { name: '3/12' })).toBeVisible();
});

test('fa-IR read pie: the denominator, the percentage and the half slice each get their own hint, then a quarter of 40', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  // A read-only pie of 4 slices; the bus slice is a quarter (a right angle at the centre).
  await expect(cb(page).locator('.kg-cb-pie path.sec')).toHaveCount(4);
  await expect(cb(page).locator('.kg-cb-pie path.sec[data-a]')).toHaveCount(0);
  await expect(cb(page).locator('.kg-cb-legend')).toContainText('اتوبوس');

  await answer(page, 'fa-IR', '۴');
  await expect(no(page)).toContainText('مخرج کسر');
  await answer(page, 'fa-IR', '۲۵');
  await expect(no(page)).toContainText('درصد');
  await answer(page, 'fa-IR', '۲۰');
  await expect(no(page)).toContainText('قسمت پیاده‌هاست');
  await answer(page, 'fa-IR', '۵');
  await expect(no(page)).toContainText('کم است');
  await answer(page, 'fa-IR', '۱۰');
  await expect(ok(page)).toContainText('۴۰ ÷ ۴ = ۱۰');
});

test('en read pie: 25 as a percentage is caught, then 10 pupils', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await answer(page, 'en', '25');
  await expect(no(page)).toContainText('25 is the percentage');
  await answer(page, 'en', '15');
  await expect(no(page)).toContainText('Too big');
  await answer(page, 'en', '10');
  await expect(ok(page)).toContainText('40 ÷ 4 = 10');
});

test('fa-IR level with the keyboard: walnuts left in the hand, bars not level, then all 5', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  const bar = (n: string) => page.getByRole('slider', { name: n });
  await expect(bar('علی')).toHaveAttribute('aria-valuenow', '3');
  await expect(bar('سارا')).toHaveAttribute('aria-valuetext', 'سارا: ۷');
  const pool = cb(page).locator('.kg-cb-pool');
  await expect(pool).toHaveText('در دست: ۰ گردو');

  // A short bar cannot grow when the hand is empty.
  await bar('علی').focus();
  await page.keyboard.press('ArrowUp');
  await expect(bar('علی')).toHaveAttribute('aria-valuenow', '3');

  await bar('سارا').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(bar('سارا')).toBeFocused();
  await expect(pool).toHaveText('در دست: ۲ گردو');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز گردو در دستت مانده است');

  await bar('علی').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(pool).toHaveText('در دست: ۰ گردو');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز هم‌قد نیستند');

  await bar('رضا').focus();
  await page.keyboard.press('ArrowLeft');
  await bar('مریم').focus();
  await page.keyboard.press('ArrowRight');
  for (const n of ['علی', 'سارا', 'مریم', 'رضا']) await expect(bar(n)).toHaveAttribute('aria-valuenow', '5');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('همه ۵ گردو دارند');
});

test('en level by dragging: lowering everyone to the smallest pile leaves walnuts in the hand', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  const bar = (n: string) => page.getByRole('slider', { name: n });
  await expect(bar('Ali')).toHaveAttribute('aria-valuenow', '3');
  const pool = cb(page).locator('.kg-cb-pool');
  /** Drag bar n to value v on the 0–8 axis. */
  const dragTo = async (n: string, v: number) => {
    await bar(n).scrollIntoViewIfNeeded();
    const r = (await bar(n).locator('.hit').boundingBox())!;
    const x = r.x + r.width / 2;
    await page.mouse.move(x, r.y + r.height * 0.95);
    await page.mouse.down();
    await page.mouse.move(x, r.y + r.height * (1 - v / 8), { steps: 4 });
    await page.mouse.up();
  };
  // "Make them like the smallest" — everyone down to 3.
  for (const n of ['Sara', 'Maryam', 'Reza']) await dragTo(n, 3);
  await expect(pool).toHaveText('In your hand: 8 walnuts');
  await check(page, 'en');
  await expect(no(page)).toContainText('still have walnuts in your hand');

  for (const n of ['Ali', 'Sara', 'Maryam', 'Reza']) await dragTo(n, 5);
  await expect(pool).toHaveText('In your hand: 0 walnuts');
  await check(page, 'en');
  await expect(ok(page)).toContainText('Everyone has 5 walnuts');
});

test('fa-IR mean of data: the total, the largest, the range and the count are each caught, then 420 ÷ 6', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(cb(page).locator('.kg-cb-total')).toContainText('۴۲۰');
  await expect(page.getByRole('img', { name: 'ششم: ۸۵' })).toBeVisible();
  for (const [v, msg] of [['۴۲۰', 'جمع همهٔ آب سیب‌هاست'], ['۸۵', 'بیشترین آب است'], ['۳۰', 'فاصلهٔ بیشترین تا کمترین'], ['۶', 'تعداد سیب‌هاست'], ['۷۵', 'زیاد است']] as const) {
    await answer(page, 'fa-IR', v);
    await expect(no(page)).toContainText(msg);
  }
  await answer(page, 'fa-IR', '۷۰');
  await expect(ok(page)).toContainText('۴۲۰ ÷ ۶ = ۷۰');
});

test('en mean of data: giving the total is caught, then 70 ml', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  await answer(page, 'en', '420');
  await expect(no(page)).toContainText('total of all the juice');
  await answer(page, 'en', '60');
  await expect(no(page)).toContainText('Too small');
  await answer(page, 'en', '70');
  await expect(ok(page)).toContainText('420 ÷ 6 = 70');
});

test('fa-IR data types: a question answered in words is caught, then height', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  const pick = (n: string) => cb(page).getByRole('button', { name: n });
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('روی یکی از پرسش‌ها بزن');
  await pick('رنگ محبوب').click();
  await expect(pick('رنگ محبوب')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('جواب این پرسش یک کلمه است');
  await pick('قد (سانتی‌متر)').click();
  await expect(pick('رنگ محبوب')).toHaveAttribute('aria-pressed', 'false');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('داده');
});

test('en data types with the keyboard: Tab to a question and press Enter', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 4);
  const pick = (n: string) => cb(page).getByRole('button', { name: n });
  await pick('Favourite fruit').focus();
  await page.keyboard.press('Enter');
  await check(page, 'en');
  await expect(no(page)).toContainText('answered with a word');
  await pick('Favourite fruit').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(pick('Height (cm)')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pick('Height (cm)')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'en');
  await expect(ok(page)).toContainText('numerical');
});

test('every mission: no horizontal scroll at 390px and touch targets at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(5);
    for (let m = 0; m < 5; m++) {
      await tab(page, m);
      await expect(cb(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await page.locator('main button:visible, main input:visible, kg-chart-builder [data-a], kg-chart-builder [data-s]').evaluateAll((els) =>
        els.map((e) => [e.getAttribute('aria-label') ?? e.textContent?.trim(), e.getBoundingClientRect()] as const)
          .filter(([, r]) => r.width < 43.5 || r.height < 43.5).map(([n, r]) => `${n} ${Math.round(r.width)}×${Math.round(r.height)}`));
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toEqual([]);
    }
  }
});
