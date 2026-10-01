import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-time-calendar/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-clock-calendar-money > *').first()).toBeVisible();
}

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc] }).click();

/** Drag on the clock face from (angle°, radius) to (angle°, radius), in face units (the rim has radius 96). */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const face = page.locator('.kg-ccm-face').first();
  await face.evaluate((e) => e.scrollIntoView({ block: 'center' })); // Check may have scrolled it away
  const box = (await face.boundingBox())!;
  const k = box.width / 200, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const pt = ([a, r]: [number, number]) => [cx + Math.sin((a * Math.PI) / 180) * r * k, cy - Math.cos((a * Math.PI) / 180) * r * k] as const;
  await page.mouse.move(...pt(from));
  await page.mouse.down();
  await page.mouse.move(...pt(to), { steps: 6 });
  await page.mouse.up();
}

test('fa-IR clock: Persian numerals, swapped hands get their own feedback, then 3 o’clock by dragging', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-ccm-num').nth(1)).toHaveText('۱');
  await expect(page.locator('.kg-ccm-tip')).toContainText('عقربه‌ها را بچرخان');
  // Long hand to 3 (12:15): the hands are swapped.
  await drag(page, [0, 72], [90, 72]);
  const minute = page.getByRole('slider', { name: /عقربهٔ بزرگ/ });
  await expect(minute).toHaveAttribute('aria-valuetext', '۱۲:۱۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جابه‌جا');
  // Long hand back to 12, then the short hand to 3.
  await drag(page, [90, 72], [0, 72]);
  await drag(page, [0, 30], [90, 35]);
  await expect(minute).toHaveAttribute('aria-valuetext', '۳:۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR clock: keyboard sets half past 7; the hour one out is caught', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  const minute = page.getByRole('slider', { name: /عقربهٔ بزرگ/ });
  const hour = page.getByRole('slider', { name: /عقربهٔ کوچک/ });
  await minute.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp'); // 12:30
  await hour.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp'); // 8:30
  await expect(hour).toHaveAttribute('aria-valuetext', '۸:۳۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بین ۷ و ۸');
  await hour.press('ArrowDown'); // Check took the focus; the hour hand still answers the keys
  await expect(hour).toHaveAttribute('aria-valuetext', '۷:۳۰');
  // The face describes the hands for screen readers: the short hand is between 7 and 8.
  await expect(page.locator('.kg-ccm-face')).toHaveAttribute('aria-label', /بین ۷ و ۸/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR 24-hour: 4:30 is the morning; 16:30 is right', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await expect(page.locator('.kg-ccm-badge')).toContainText('بعدازظهر');
  const hours = page.getByRole('textbox', { name: 'ساعت', exact: true });
  const minutes = page.getByRole('textbox', { name: 'دقیقه' });
  await expect(hours).toHaveValue('۱۲');
  await hours.fill('۴');
  await minutes.fill('30'); // Latin digits are accepted and shown as Persian
  await expect(minutes).toHaveValue('۳۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('صبح');
  // ▲ on the hours twelve times: 04 → 16.
  const up = page.getByRole('button', { name: 'ساعت بیشتر' });
  for (let i = 0; i < 12; i++) await up.click();
  await expect(hours).toHaveValue('۱۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۶:۳۰');
});

test('fa-IR calendar: Solar Hijri month, week starts Saturday on the right; one week later', async ({ page }) => {
  await openMission(page, 'fa-IR', 3);
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('مهر ۱۴۰۵');
  const heads = page.locator('.kg-ccm-wd');
  await expect(heads.first()).toHaveAttribute('aria-label', 'شنبه');
  const sat = (await heads.first().boundingBox())!, fri = (await heads.last().boundingBox())!;
  expect(sat.x).toBeGreaterThan(fri.x); // Saturday is the rightmost column
  await expect(heads.last()).toHaveClass(/\bwe\b/); // Friday is the rest day
  await expect(page.locator('.kg-ccm-date.today')).toHaveText('۵');
  await expect(page.locator('.kg-ccm-date')).toHaveCount(30); // Mehr has 30 days
  await page.locator('.kg-ccm-date[data-day="11"]').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('امروز را هم شمردی');
  const twelve = page.locator('.kg-ccm-date[data-day="12"]');
  await twelve.click();
  await expect(twelve).toHaveAttribute('aria-pressed', 'true');
  await expect(twelve).toHaveAttribute('aria-label', '۱۲ مهر، یکشنبه');
  // Same column as today.
  expect(Math.abs((await twelve.boundingBox())!.x - (await page.locator('.kg-ccm-date.today').boundingBox())!.x)).toBeLessThan(2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR calendar: from Esfand to Nowruz with the next-month button and the keyboard', async ({ page }) => {
  await openMission(page, 'fa-IR', 4);
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('اسفند ۱۴۰۴');
  await expect(page.locator('.kg-ccm-date')).toHaveCount(29); // 1404 is not a leap year
  await page.locator('.kg-ccm-date[data-day="1"]').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ماه بعد');
  await page.getByRole('button', { name: 'ماه بعد' }).click();
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('فروردین ۱۴۰۵');
  await expect(page.locator('.kg-ccm-date')).toHaveCount(31);
  // Keyboard: focus day 2, ArrowRight in RTL goes back to day 1, Enter picks it.
  await page.locator('.kg-ccm-date[data-day="2"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.kg-ccm-date[data-day="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kg-ccm-date[data-day="1"]')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('نوروز');
});

test('en clock: wrong then right by dragging; 24-hour digital in Latin digits', async ({ page }) => {
  await openMission(page, 'en', 0);
  await expect(page.locator('.kg-ccm-num').nth(1)).toHaveText('1');
  await drag(page, [0, 30], [120, 35]); // short hand to 4: one out
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('exactly on 3');
  await drag(page, [120, 30], [180, 35]); // to 6
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('short hand to 3');
  await drag(page, [180, 30], [90, 35]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText("3 o'clock");

  await openMission(page, 'en', 2);
  const hours = page.getByRole('textbox', { name: 'hours' });
  await hours.fill('4');
  await page.getByRole('textbox', { name: 'minutes' }).fill('30');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('morning');
  await hours.fill('16');
  await hours.press('Tab');
  await expect(hours).toHaveValue('16');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('16:30');
});

test('en calendar: Gregorian, Monday first; one week later and New Year', async ({ page }) => {
  await openMission(page, 'en', 3);
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('October 2026');
  await expect(page.locator('.kg-ccm-wd').first()).toHaveText('Mo');
  const mon = (await page.locator('.kg-ccm-wd').first().boundingBox())!, sun = (await page.locator('.kg-ccm-wd').last().boundingBox())!;
  expect(mon.x).toBeLessThan(sun.x);
  await page.locator('.kg-ccm-date[data-day="19"]').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('one row down');
  await page.locator('.kg-ccm-date[data-day="12"]').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await openMission(page, 'en', 4);
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('December 2025');
  await page.getByRole('button', { name: 'next month' }).click();
  await expect(page.locator('.kg-ccm-cal-title')).toHaveText('January 2026');
  await page.locator('.kg-ccm-date[data-day="1"]').click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('New Year');
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 5; i++) {
      await openMission(page, loc, i);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await page.locator('kg-clock-calendar-money button').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} button`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
