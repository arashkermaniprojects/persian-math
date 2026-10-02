import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/num-divisibility-powers/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const JUMP = { 'fa-IR': 'همین‌طور ادامه بده', en: 'Keep jumping' } as const;
const COLOUR = { 'fa-IR': ['قرمز', 'آبی'], en: ['red', 'blue'] } as const;
type Loc = keyof typeof CHECK;

const pm = (page: Page) => page.locator('kg-pattern-machine');
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const check = (page: Page, loc: Loc) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const cell = (page: Page, n: number) => pm(page).locator(`.kg-pm-cell[data-i="${n}"]`);
const colour = (page: Page, loc: Loc, i: 0 | 1) => pm(page).getByRole('radio', { name: COLOUR[loc][i], exact: true }).click();
const jump = (page: Page, loc: Loc) => pm(page).getByRole('button', { name: JUMP[loc], exact: true }).click();
const field = (page: Page, key: string) => pm(page).locator(`input[data-key="${key}"]`);
/** Choose a colour, tap the numbers, then optionally keep jumping. */
const shade = async (page: Page, loc: Loc, i: 0 | 1, ns: number[], keepJumping = false) => {
  await colour(page, loc, i);
  for (const n of ns) await cell(page, n).click();
  if (keepJumping) await jump(page, loc);
};

test('fa-IR multiples of 2 and 5: an extra number is caught, and the two-colour numbers are the multiples of 10', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pm(page).locator('.kg-pm-cell')).toHaveCount(100);
  await expect(cell(page, 37)).toHaveText('۳۷');
  await expect(pm(page).locator('.kg-pm-hint')).toContainText('رنگ را انتخاب کن');

  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر دو رنگ را لازم داری');

  await shade(page, 'fa-IR', 0, [2, 4], true);
  await expect(pm(page).locator('.kg-pm-cell.l0')).toHaveCount(50);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر دو رنگ را لازم داری'); // blue is still empty

  await shade(page, 'fa-IR', 1, [5]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز چند مضرب رنگ نشده است');
  await cell(page, 10).click();
  await jump(page, 'fa-IR');
  await cell(page, 7).click(); // 7 in blue: not a multiple of 5
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مضرب نیست');
  await cell(page, 7).click(); // tap again with the same colour to clear it
  await expect(cell(page, 7)).not.toHaveClass(/l1/);

  await expect(pm(page).locator('.kg-pm-cell.l0.l1')).toHaveCount(10);
  await expect(cell(page, 30)).toHaveAttribute('aria-label', '۳۰, قرمز');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('مضرب‌های ۱۰');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR multiples of 3 and 9: skipping the blue on already-red numbers is caught, then right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await shade(page, 'fa-IR', 0, [3, 6], true);
  await expect(pm(page).locator('.kg-pm-cell.l0')).toHaveCount(33);
  await shade(page, 'fa-IR', 1, [9]); // only the first multiple of 9
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('حتی اگر قرمزند');
  await cell(page, 18).click();
  await jump(page, 'fa-IR');
  await expect(pm(page).locator('.kg-pm-cell.l0.l1')).toHaveCount(11); // every blue number is red too
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱ + ۸ = ۹');
});

test('fa-IR lowest common multiple: 4 × 6 = 24 is caught as not the lowest, then 12', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(pm(page).locator('.kg-pm-cell')).toHaveCount(60);
  // The square is only a tool here: shade it, then type the answer.
  await shade(page, 'fa-IR', 0, [4, 8], true);
  await shade(page, 'fa-IR', 1, [6, 12], true);
  await expect(pm(page).locator('.kg-pm-cell.l0.l1')).toHaveCount(5);

  const answer = page.locator('.int-input');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جواب را بنویس');
  await answer.fill('۲۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کوچک‌ترین');
  await answer.fill('۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('شمارندهٔ مشترک');
  await answer.fill('۱۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۴ + ۶');
  await answer.fill('۱۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۲ اولین مضرب مشترک');
});

test('fa-IR highest common factor: forgetting 1 and the number itself is caught, then 6 packs', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(pm(page).locator('.kg-pm-cell')).toHaveCount(24);
  await shade(page, 'fa-IR', 0, [2, 3, 6, 9]); // without 1 and 18
  await shade(page, 'fa-IR', 1, [1, 2, 3, 4, 6, 8, 12, 24]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۱ و خود عدد را فراموش نکن');
  await shade(page, 'fa-IR', 0, [1, 18, 4]); // 4 is not a factor of 18
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('شمارنده نیست');
  await cell(page, 4).click();
  await expect(pm(page).locator('.kg-pm-cell.l0.l1')).toHaveCount(4); // 1, 2, 3, 6
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۶ بسته');
});

test('fa-IR square numbers: doubling figure 5 for figure 10 is caught, then 25 and 100', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(pm(page).locator('.kg-pm-fig')).toHaveCount(4);
  await expect(pm(page).locator('.kg-pm-tab td').first()).toHaveText('۱');
  await field(page, 't5').fill('۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر دو خانه');
  await field(page, 't10').fill('۵۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو برابر شکل ۵ نیست');
  await field(page, 't5').fill('۲۳');
  await field(page, 't10').fill('۱۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('پرش‌ها یکی نیستند');
  await field(page, 't5').fill('۲۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۰ × ۱۰ = ۱۰۰');
});

test('fa-IR cube machine: 4 × 3 = 12 is caught as multiplying by 3, then 27, 64, 1000', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 5);
  await expect(pm(page).locator('.kg-pm-mach input')).toHaveCount(3); // rows 1 and 2 are worked examples
  await expect(pm(page).locator('.kg-pm-cellout').nth(1)).toContainText('۸');
  await field(page, 'r3').fill('۲۷');
  await field(page, 'r4').fill('۱۲');
  await field(page, 'r5').fill('۱۰۰۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('در ۳ ضرب کردی');
  await field(page, 'r4').fill('۱۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بار در خودش');
  await field(page, 'r4').fill('۶۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('عددهای مکعب');
});

test('en: multiples of 2 and 5, and the LCM with 4 + 6 = 10 caught, then 12', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await shade(page, 'en', 0, [2, 4], true);
  await shade(page, 'en', 1, [5]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Some multiples are not shaded yet');
  await cell(page, 10).click();
  await jump(page, 'en');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('multiples of 10');

  await tab(page, 2);
  const answer = page.locator('.int-input');
  await answer.fill('10');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText("Sara doesn't water on day 10");
  await answer.fill('36');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not the lowest');
  await answer.fill('12');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('first common multiple');
});

test('en: square numbers (2 × n caught) and cube machine (n² caught), then right', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 4);
  await field(page, 't5').fill('10');
  await field(page, 't10').fill('20');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('You doubled the figure number');
  await field(page, 't5').fill('25');
  await field(page, 't10').fill('100');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('square numbers');

  await tab(page, 5);
  await field(page, 'r3').fill('9');
  await field(page, 'r4').fill('16');
  await field(page, 'r5').fill('100');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Cubing is three times');
  for (const [k, v] of [['r3', '27'], ['r4', '64'], ['r5', '1000']]) await field(page, k).fill(v);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('cube numbers');
});

test('en keyboard: arrow keys move around the square, Enter shades, and the HCF mission is solved without a mouse', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  const square = pm(page).locator('.kg-pm-sq');
  await expect(square.locator('button[tabindex="0"]')).toHaveCount(1); // one tab stop for the whole square
  const red = pm(page).getByRole('radio', { name: 'red', exact: true });
  await red.focus();
  await page.keyboard.press('Enter');
  await expect(red).toHaveAttribute('aria-checked', 'true');

  // Rows of 6: start on 1, then walk with the arrows and press Enter on each factor of 18.
  await cell(page, 1).focus();
  const walk = async (to: number) => {
    const at = Number(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.i));
    const rows = Math.floor((to - 1) / 6) - Math.floor((at - 1) / 6);
    for (let i = 0; i < Math.abs(rows); i++) await page.keyboard.press(rows > 0 ? 'ArrowDown' : 'ArrowUp');
    const cols = ((to - 1) % 6) - ((at - 1) % 6);
    for (let i = 0; i < Math.abs(cols); i++) await page.keyboard.press(cols > 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(cell(page, to)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cell(page, to)).toHaveAttribute('aria-pressed', 'true');
  };
  for (const n of [1, 2, 3, 6, 9, 18]) await walk(n);

  const blue = pm(page).getByRole('radio', { name: 'blue', exact: true });
  await blue.focus();
  await page.keyboard.press('Space');
  await expect(blue).toHaveAttribute('aria-checked', 'true');
  await cell(page, 1).focus();
  for (const n of [1, 2, 3, 4, 6, 8, 12, 24]) await walk(n);
  await expect(cell(page, 6)).toHaveAttribute('aria-label', '6, red');

  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback.ok')).toContainText('6 packs');
});

test('no horizontal scroll at 390px on any mission, and touch targets are at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(6);
    for (let m = 0; m < n; m++) {
      await tab(page, m);
      await expect(pm(page)).toBeVisible();
      if (m < 4) {
        // Shade everything that can be two-coloured: the widest the square gets.
        await shade(page, loc, 0, [1, 2], true);
        await shade(page, loc, 1, [1, 2], true);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const targets = pm(page).locator('button:visible:not(.kg-pm-cell), input:visible');
      for (const b of await targets.all()) {
        const box = (await b.boundingBox())!;
        expect(Math.min(box.width, box.height), `${loc} mission ${m + 1}: ${await b.getAttribute('data-k') ?? await b.getAttribute('data-key')}`).toBeGreaterThanOrEqual(44);
      }
      // Hundred-square cells: ten columns cannot reach 44px inside a 390px phone (the engine's layout), so they are
      // held to a 30px floor; the square also works with the arrow keys (see the keyboard test).
      for (const c of await pm(page).locator('.kg-pm-cell:visible').all()) {
        const box = (await c.boundingBox())!;
        expect(Math.min(box.width, box.height), `${loc} mission ${m + 1}: cell`).toBeGreaterThanOrEqual(30);
      }
      const answer = page.locator('.int-input:visible');
      if (await answer.count()) expect((await answer.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});
