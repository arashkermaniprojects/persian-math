import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/alg-expressions-formulae/`;
const CHECK: Record<string, string> = { 'fa-IR': 'بررسی کن', en: 'Check' };
const pm = (page: Page) => page.locator('kg-pattern-machine');
/** The operator button at token index i of the live line. */
const op = (page: Page, i: number) => pm(page).locator(`.kg-pm-ex p.cur [data-a="do"][data-i="${i}"]`);
const undo = (page: Page) => pm(page).locator('[data-a="undo"]');
const field = (page: Page, key: string) => pm(page).locator(`input[data-key="${key}"]`);
const lastLine = (page: Page) => pm(page).locator('.kg-pm-ex p.cur');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');

async function open(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(pm(page)).toBeVisible();
}
const check = (page: Page, loc: string) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
async function fill(page: Page, values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) await field(page, k).fill(v);
}

test('fa-IR: brackets first — adding 3 + 4 first reaches 28 and is caught as the wrong order, then 19', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pm(page).locator('.kg-pm-hint')).toContainText('روی علامتی بزن');
  await expect(lastLine(page)).toHaveText('۳+۴×(۶−۲)');
  // Only operators with a number on each side can be tapped: + and the − in the bracket, not ×.
  await expect(lastLine(page).locator('[data-a="do"]')).toHaveCount(2);
  await expect(op(page, 6)).toHaveAttribute('aria-label', 'انجام بده: ۶ − ۲');
  await expect(undo(page)).toBeDisabled();

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز کار داری');

  await op(page, 1).click(); // 3 + 4 first: the classic slip
  await expect(lastLine(page)).toHaveText('=۷×(۶−۲)');
  await op(page, 4).click();
  await op(page, 1).click();
  await expect(lastLine(page)).toHaveText('=۲۸');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('ترتیب درست نبود');

  for (let k = 0; k < 3; k++) await undo(page).click();
  await expect(pm(page).locator('.kg-pm-ex p')).toHaveCount(1);
  await op(page, 6).click();
  await expect(lastLine(page)).toHaveText('=۳+۴×۴'); // the bracket round a single number disappears
  await op(page, 3).click();
  await op(page, 1).click();
  await expect(lastLine(page)).toHaveText('=۱۹');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('۳ + ۱۶ = ۱۹');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: powers, ×, then left to right — doing 18 + 4 first is caught, then 6', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(lastLine(page).locator('sup')).toHaveText('۲');
  await op(page, 5).click(); // 3² = 9
  await expect(lastLine(page)).toHaveText('=۲۰−۲×۹+۴');
  await op(page, 3).click();
  await expect(lastLine(page)).toHaveText('=۲۰−۱۸+۴');
  await op(page, 3).click(); // 18 + 4 before 20 − 18
  await op(page, 1).click();
  await expect(lastLine(page)).toHaveText('=−۲');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول توان، بعد ضرب');

  for (let k = 0; k < 4; k++) await undo(page).click();
  for (const i of [5, 3, 1, 1]) await op(page, i).click();
  await expect(lastLine(page)).toHaveText('=۶');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR: the 2n − 7 machine — writing 2 next to n (25 − 7) and the bracket slip are caught, then right', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await expect(pm(page).locator('.kg-pm-box')).toHaveText('۲ × n − ۷') // 2n is shown with its × written out;
  await expect(pm(page).locator('.kg-pm-mach .kg-pm-h').first()).toHaveText('n');
  await expect(pm(page).locator('.kg-pm-cellin').first()).toHaveText('۴');
  await expect(pm(page).locator('.kg-pm-cellout').first()).toHaveText('۱'); // the worked example
  await expect(field(page, 'r2')).toHaveAttribute('aria-label', 'خروجی ردیف ۲');

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('همهٔ خروجی‌ها');

  await fill(page, { r2: '۱۸', r3: '۹', r4: '۱۳' });
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('رقم ۲ را کنار عدد n');

  await fill(page, { r2: '۳', r3: '۲', r4: '۶' }); // 2 × (n − 7)
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول ۷ تا کم کردی');

  await fill(page, { r3: '۹', r4: '۱۳' });
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR: a learner who does 2 × (n − 7) on every row gets the bracket feedback, even at n = 5', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await fill(page, { r2: '−۴', r3: '۲', r4: '۶' });
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول ۷ تا کم کردی');
});

test('fa-IR: P = 4a — adding 4 and three sides are caught; the free row works out any side', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await expect(pm(page).locator('.kg-pm-mach .kg-pm-h').first()).toHaveText('a');
  await expect(pm(page).locator('.kg-pm-mach .kg-pm-h').last()).toHaveText('P');
  await fill(page, { r1: '۷', r2: '۱۱', r3: '۱۹' });
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۴ تا اضافه کردی');

  await fill(page, { r1: '۹', r2: '۲۱', r3: '۴۵' }); // 3 × a
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مربع ۴ ضلع دارد');

  await field(page, 'try').fill('۲۵');
  await expect(pm(page).locator('.kg-pm-try output')).toHaveText('۱۰۰');
  await fill(page, { r1: '۱۲', r2: '۲۸', r3: '۶۰' });
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('۴ × ۱۵ = ۶۰');
});

test('the a + b = 10 pairs mission is en only', async ({ page }) => {
  for (const [loc, n] of [['fa-IR', 4], ['en', 5]] as const) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab'), loc).toHaveCount(n);
  }
});

test('en only: pairs that make 10 — adding 10 and b = 10 at a = 10 are caught, then right', async ({ page }) => {
  await open(page, 'en', 4);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(pm(page).locator('.kg-pm-mach .kg-pm-h').last()).toHaveText('b');
  await expect(pm(page).locator('.kg-pm-cellout').first()).toHaveText('7');
  await fill(page, { r2: '11', r3: '14', r4: '16', r5: '20' });
  await check(page, 'en');
  await expect(no(page)).toContainText('You added 10 to a');

  await fill(page, { r2: '9', r3: '6', r4: '4', r5: '10' });
  await check(page, 'en');
  await expect(no(page)).toContainText('a + b = 20');

  await field(page, 'r5').fill('0');
  await check(page, 'en');
  await expect(ok(page)).toContainText('11 pairs');
});

test('en: brackets and letters — the wrong order and 2n read as 25 are caught, then right', async ({ page }) => {
  await open(page, 'en', 0);
  await expect(op(page, 6)).toHaveAttribute('aria-label', 'Do 6 − 2');
  for (const i of [1, 4, 1]) await op(page, i).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('the order was wrong');
  for (let k = 0; k < 3; k++) await undo(page).click();
  for (const i of [6, 3, 1]) await op(page, i).click();
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(2).click();
  await fill(page, { r2: '18', r3: '9', r4: '13' });
  await check(page, 'en');
  await expect(no(page)).toContainText('2n means 2 × n');
  await field(page, 'r2').fill('3');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(3).click();
  await fill(page, { r1: '7', r2: '28', r3: '60' });
  await check(page, 'en');
  await expect(no(page)).toContainText('You added 4');
});

test('en: the whole expression and a machine can be worked with the keyboard alone', async ({ page }) => {
  await open(page, 'en', 0);
  await op(page, 6).focus();
  await page.keyboard.press('Enter');
  await expect(lastLine(page)).toHaveText('=3+4×4');
  await expect(pm(page).locator(':focus')).toHaveCount(1); // focus stays inside the studio after the redraw
  await op(page, 3).focus();
  await page.keyboard.press('Space');
  await op(page, 1).focus();
  await page.keyboard.press('Enter');
  await expect(lastLine(page)).toHaveText('=19');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();

  await page.locator('.mission-tab').nth(2).click();
  await field(page, 'r2').focus();
  await page.keyboard.type('3');
  await page.keyboard.press('Tab');
  await expect(field(page, 'r3')).toBeFocused();
  await page.keyboard.type('9');
  await page.keyboard.press('Tab');
  await page.keyboard.type('13');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const [loc, n] of [['fa-IR', 4], ['en', 5]] as const) {
    for (let i = 0; i < n; i++) {
      await open(page, loc, i);
      if (i < 2) await op(page, 1).click(); // a second line in the exercise book
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await pm(page).locator('button, input').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} target`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('undoing only the slip forgives it: a right step, a wrong step, undo, then finish in order', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await op(page, 6).click(); // 6 − 2 first: right
  await expect(lastLine(page)).toHaveText('=۳+۴×۴');
  await op(page, 1).click(); // then 3 + 4: wrong
  await undo(page).click(); // undo just the slip
  await expect(lastLine(page)).toHaveText('=۳+۴×۴');
  await op(page, 3).click();
  await op(page, 1).click();
  await expect(lastLine(page)).toHaveText('=۱۹');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});
