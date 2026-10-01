import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/frac-long-division/`;
const engine = (page: Page) => page.locator('kg-long-division');
const boxes = (page: Page) => page.locator('kg-long-division .kg-ld-box');

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(boxes(page).first()).toBeVisible();
}

test('fa-IR uses the gallows layout: quotient under the divisor, right of the dividend', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(engine(page)).toHaveAttribute('data-ld-layout', 'gallows');
  await expect(page.locator('.kg-ld-sheet')).toHaveAttribute('dir', 'ltr');
  const dividend = await page.locator('.kg-ld-d', { hasText: '۸' }).first().boundingBox(); // "۸" of ۸۴
  const quotient = await page.getByRole('textbox', { name: /^خارج قسمت – مرحلهٔ ۱/ }).boundingBox();
  expect(quotient!.x).toBeGreaterThan(dividend!.x + dividend!.width); // right of the dividend
  expect(quotient!.y).toBeGreaterThan(dividend!.y); // below the divisor row
  await expect(page.locator('.kg-ld-bar')).toBeVisible();
});

test('en uses the bus stop layout: quotient on top, above the dividend', async ({ page }) => {
  await openMission(page, 'en', 0);
  await expect(engine(page)).toHaveAttribute('data-ld-layout', 'busstop');
  await expect(page.locator('.kg-ld-bracket')).toBeVisible();
  const dividend = await page.locator('.kg-ld-d', { hasText: '8' }).first().boundingBox();
  const quotient = await page.getByRole('textbox', { name: /^quotient – step 1/ }).boundingBox();
  expect(quotient!.y + quotient!.height).toBeLessThanOrEqual(dividend!.y + 1);
  expect(Math.abs(quotient!.x + quotient!.width / 2 - (dividend!.x + dividend!.width / 2))).toBeLessThan(4); // same column
});

test('fa-IR: a wrong digit gets a gentle mark, then the division is completed', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  const first = boxes(page).first();
  await first.click();
  await page.keyboard.type('۳'); // 8 ÷ 4 is not 3
  await expect(first).toHaveClass(/\bno\b/);
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.kg-ld-status')).toContainText('هنوز نه');

  // Checking now is not a fail of the digit, just "not finished yet".
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('هنوز چند خانه مانده');

  // Retype (the wrong digit is selected), then the rest; focus moves on by itself after each right digit.
  // 84 ÷ 4: q 2, 2×4 = 8, 8−8 = 0; bring down 4: q 1, 1×4 = 4, 4−4 = 0. Persian and Latin digits both work.
  await page.keyboard.type('۲');
  await expect(first).toHaveClass(/\bok\b/);
  await page.keyboard.type('80');
  await page.keyboard.type('۱۴۰');
  await expect(page.locator('.kg-ld-status')).toContainText('تمام شد');
  await expect(page.locator('.kg-ld-box.ok')).toHaveCount(6);
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: the decimal mark "/" appears in the quotient once the division passes the units', async ({ page }) => {
  await openMission(page, 'fa-IR', 2); // ۷ ÷ ۸
  const marks = page.locator('.kg-ld-mark');
  await expect(marks.first()).toBeHidden();
  await boxes(page).first().click();
  await page.keyboard.type('۰'); // no whole 8 in 7
  await expect(marks).toHaveCount(2); // in the quotient and after the dividend
  for (const m of await marks.all()) {
    await expect(m).toBeVisible();
    await expect(m).toHaveText('/');
  }
  await expect(page.locator('.kg-ld-ask')).toContainText('۷۰'); // now dividing 70 tenths
});

test('fa-IR: reveal a step, finish 7 ÷ 8 = 0.875 and pass the check', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  await page.getByRole('button', { name: 'این مرحله را نشانم بده' }).click();
  await expect(page.locator('.kg-ld-box.shown')).toHaveCount(1);
  await boxes(page).nth(1).focus(); // 70 ÷ 8: 8, 64, 6 | 60: 7, 56, 4 | 40: 5, 40, 0
  await page.keyboard.type('۸۶۴۶۷۵۶۴۵۴۰۰');
  await expect(page.locator('.kg-ld-status.ok')).toBeVisible();
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toContainText('۰/۸۷۵');
});

test('en: the decimal point is "." and 3 ÷ 4 starts from the given first step', async ({ page }) => {
  await openMission(page, 'en', 1);
  await expect(page.locator('.kg-ld-box.given')).toHaveCount(1);
  await expect(page.locator('.kg-ld-mark').first()).toHaveText('.');
  await expect(page.locator('.kg-ld-mark').first()).toBeVisible();
  await boxes(page).nth(1).focus();
  await page.keyboard.type('728' + '2' + '5200'); // 30: 7, 28, 2 | 20: 5, 20, 0
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: type the decimal for 3/5 with the Iranian mark', async ({ page }) => {
  await openMission(page, 'fa-IR', 3);
  await page.locator('.int-input').fill('۶');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.no')).toContainText('زیاد است');
  await page.locator('.int-input').fill('۰/۶');
  await page.getByRole('button', { name: 'بررسی کن' }).click();
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px, every mission, gallows and bus stop', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 4; i++) {
      await openMission(page, loc, i);
      // Reveal everything so the sheet is at its widest and tallest.
      const reveal = page.locator('.kg-ld-reveal');
      while (await reveal.isVisible()) await reveal.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      const box = await boxes(page).first().boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});
