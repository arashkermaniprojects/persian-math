import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/stat-averages-range/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
type Loc = keyof typeof CHECK;
const check = (page: Page, loc: Loc) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tab = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();
const cb = (page: Page) => page.locator('kg-chart-builder');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');
const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const cards = (page: Page) => cb(page).locator('.kg-cbs-card');
const ask = (page: Page, k: string) => cb(page).locator(`input[data-ask="${k}"]`);
const tool = (page: Page, name: string) => cb(page).getByRole('radio', { name });

/** The numbers on the cards, left to right (Persian digits read back as numbers). */
async function row(page: Page) {
  const t = await cards(page).allTextContents();
  return t.map((s) => +s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
}

/** Selection sort by taps: pick the smallest remaining card, then tap the place it goes. */
async function sortByTaps(page: Page) {
  const n = await cards(page).count();
  for (let i = 0; i < n; i++) {
    const r = await row(page);
    const j = r.indexOf(Math.min(...r.slice(i)), i);
    await cards(page).nth(j).click();
    await cards(page).nth(i).click();
  }
}

test('fa-IR median-odd: the middle of the unordered row is caught, then the cards are lined up and the middle marked', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(cards(page)).toHaveCount(7);
  // The cards run left to right in every locale: the first card dealt (35) is on the left.
  await expect(cb(page).locator('.kg-cbs-line')).toHaveAttribute('dir', 'ltr');
  await expect(cards(page).first()).toHaveText('۳۵');
  const b0 = (await cards(page).nth(0).boundingBox())!;
  const b1 = (await cards(page).nth(1).boundingBox())!;
  expect(b0.x).toBeLessThan(b1.x);
  expect(b0.width).toBeGreaterThanOrEqual(44);

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز مرتب نیستند');

  // Mark the middle card of the row as dealt (15): the classic slip.
  await tool(page, '✓ علامت بزن').click();
  await cards(page).nth(3).click();
  await expect(cards(page).nth(3)).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('کارت‌ها هنوز مرتب نیستند. میانه');
  await cards(page).nth(3).click(); // unmark

  await tool(page, '↔ جابه‌جا کن').click();
  await cards(page).nth(0).click();
  await expect(cb(page).locator('.kg-cbs-say')).toContainText('روی جایی بزن');
  await cards(page).nth(0).click(); // put it back down
  await sortByTaps(page);
  expect(await row(page)).toEqual([15, 20, 25, 30, 35, 40, 45]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('کارت‌ها مرتب‌اند');

  await tool(page, '✓ علامت بزن').click();
  await cards(page).nth(2).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('این کارت وسط نیست');
  await cards(page).nth(2).click();
  await cards(page).nth(3).click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('میانه ۳۰ دقیقه');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('en median-odd with the keyboard: pick a card up with Enter and move it with the arrow keys', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(cards(page)).toHaveCount(7);
  // 35 20 45 15 40 25 30: move 15 (4th) to the front with Enter + three ArrowLefts.
  await cards(page).nth(3).focus();
  await page.keyboard.press('Enter');
  await expect(cards(page).nth(3)).toHaveAttribute('aria-pressed', 'true');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowLeft');
  expect(await row(page)).toEqual([15, 35, 20, 45, 40, 25, 30]);
  await expect(cards(page).nth(0)).toBeFocused(); // focus follows the card
  await page.keyboard.press('Enter'); // put it down
  await expect(cards(page).nth(0)).toHaveAttribute('aria-pressed', 'false');
  await sortByTaps(page);
  await tool(page, '✓ Mark').click();
  await cards(page).nth(3).focus();
  await page.keyboard.press('Enter');
  await expect(cards(page).nth(3)).toHaveAttribute('aria-label', '30 — marked');
  await check(page, 'en');
  await expect(ok(page)).toContainText('the median is 30 minutes');
});

test('fa-IR median-even: one middle card is not enough, then the median is typed with the Iranian decimal mark', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(cards(page)).toHaveCount(6);
  await sortByTaps(page);
  expect(await row(page)).toEqual([3, 4, 6, 7, 8, 9]);
  await tool(page, '✓ علامت بزن').click();
  await cards(page).nth(2).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دو کارت وسط داریم');
  await cards(page).nth(3).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('میانه را در جای خالی بنویس');
  await ask(page, 'median').fill('۷');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دو کارت وسط داریم');
  await ask(page, 'median').fill('۷/۵'); // the middle of the row as dealt (9 and 6)
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مرتب نیستند');
  await ask(page, 'median').fill('۶/۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('۶/۵');
});

test('en mode and range on a dot plot: the frequency and the largest value get their own hints', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 2);
  const plot = cb(page).locator('svg.kg-cbs-plot');
  await expect(plot).toHaveCount(1);
  await expect(plot.locator('circle.dot')).toHaveCount(12);
  // A stack can be tapped to highlight it.
  const s38 = plot.locator('[data-k="stack-0-38"]');
  await expect(s38).toHaveAttribute('aria-label', '38: 4 dots');
  await s38.click();
  await expect(plot.locator('[data-k="stack-0-38"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(plot.locator('circle.dot.on')).toHaveCount(4);

  await check(page, 'en');
  await expect(no(page)).toContainText('Type both');
  await ask(page, 'mode').fill('4');
  await ask(page, 'range').fill('5');
  await check(page, 'en');
  await expect(no(page)).toContainText('4 is how many pupils');
  await ask(page, 'mode').fill('38');
  await ask(page, 'range').fill('41');
  await check(page, 'en');
  await expect(no(page)).toContainText('41 is the largest size');
  await ask(page, 'range').fill('5');
  await check(page, 'en');
  await expect(ok(page)).toContainText('41 − 36 = 5');
});

test('fa-IR mean-outlier: drag a score out with the pointer; the median stays, the mean moves', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  const plot = cb(page).locator('svg.kg-cbs-plot');
  const handle = plot.locator('circle.hd');
  await expect(handle).toHaveCount(1);
  await expect(cb(page).locator('.kg-cbs-read')).toContainText('میانه: ۱۴');
  await ask(page, 'mean').fill('۱۴');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول نقطهٔ آخر');

  // The plot runs 10 … 20 left to right; drag the handle to the right end.
  const box = (await plot.boundingBox())!;
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 30, h.y + h.height / 2, { steps: 6 });
  await page.mouse.move(box.x + box.width - 18, h.y + h.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect(plot.locator('circle.hd')).toHaveAttribute('aria-valuenow', '20');
  await expect(cb(page).locator('.kg-cbs-read')).toContainText('میانه: ۱۴');
  await expect(cb(page).locator('.kg-cbs-read')).toContainText('دامنهٔ تغییرات: ۸');

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۱۴ میانه است');
  await ask(page, 'mean').fill('۷۵');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۷۵ مجموع است');
  await ask(page, 'mean').fill('۱۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('۷۵ ÷ ۵ = ۱۵');
});

test('en mean-outlier with the keyboard: arrow keys move the dot and the balance point follows', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 3);
  const handle = cb(page).locator('circle.hd');
  const fulcrum = cb(page).locator('path.fulcrum');
  await expect(fulcrum).toBeVisible();
  const x0 = (await fulcrum.boundingBox())!.x;
  await handle.focus();
  for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowRight');
  await expect(cb(page).locator('circle.hd')).toHaveAttribute('aria-valuenow', '20');
  await expect(cb(page).locator('circle.hd')).toBeFocused();
  expect((await fulcrum.boundingBox())!.x).toBeGreaterThan(x0); // the mean moved right
  await ask(page, 'mean').fill('15');
  await check(page, 'en');
  await expect(ok(page)).toContainText('the median stayed at 14');
});

test('en best-wages: the mean pulled up by one large value is caught; the median is best', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 4);
  await expect(cb(page).locator('.kg-cbs-read')).toContainText('Mean: 8');
  await check(page, 'en');
  await expect(no(page)).toContainText('Choose one');
  await page.getByRole('radio', { name: 'Mean' }).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('six of the seven earn less');
  await page.getByRole('radio', { name: 'Mode' }).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('lowest pay');
  await page.getByRole('radio', { name: 'Median' }).click();
  await expect(page.getByRole('radio', { name: 'Median' })).toHaveAttribute('aria-checked', 'true');
  await check(page, 'en');
  await expect(ok(page)).toContainText('The median (4');
});

test('fa-IR best-colours: no mean or median of words; the mode is the only average', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 5);
  await expect(cb(page).locator('.kg-cb-table')).toContainText('آبی');
  await expect(cb(page).locator('.kg-cb-svg rect.bar')).toHaveCount(4);
  await page.getByRole('radio', { name: 'میانه' }).click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('رنگ‌ها عدد نیستند');
  await page.getByRole('radio', { name: 'مد' }).click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('آبی');
});

for (const loc of ['fa-IR', 'en'] as const) {
  test(`${loc}: no horizontal scroll at 390px on any mission`, async ({ page }) => {
    await page.goto(URL(loc));
    const n = await page.locator('.mission-tab').count();
    expect(n).toBe(6);
    for (let i = 0; i < n; i++) {
      await tab(page, i);
      await expect(cb(page)).toBeVisible();
      await expect(cb(page).locator('.kg-cbs-card, svg.kg-cbs-plot, .kg-cbs-best').first()).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `mission ${i + 1}`).toBeLessThanOrEqual(0);
    }
  });
}
