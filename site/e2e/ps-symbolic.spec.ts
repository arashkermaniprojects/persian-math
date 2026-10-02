import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ps-symbolic/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const canvas = (page: Page) => page.locator('kg-problem-canvas');
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
/** Tap a fact (button) or a question (radio, ends in ? / ؟) in step 1 by its text. */
const tap = (page: Page, name: string) => canvas(page).getByRole(/[؟?]$/.test(name) ? 'radio' : 'button', { name, exact: true }).click();
/** Put tray value v ('?' = the box) into sentence slot i (token index) of tool t. */
async function put(page: Page, v: string, i: number, t = 0) {
  const tool = canvas(page).locator('.kg-pc-tool').nth(t);
  await tool.locator(`.kg-pc-tray [data-v="${v}"]`).click();
  await tool.locator(`[data-a="slot"][data-v="${i}"]`).click();
}
/** Tap the operation at token i until it shows `op`. */
async function op(page: Page, i: number, sym: string) {
  const b = canvas(page).locator(`.kg-pc-op[data-v="${i}"]`);
  for (let k = 0; k < 4 && (await b.textContent())?.trim() !== sym; k++) await b.click();
  await expect(b).toHaveText(sym);
}
const answer = (page: Page) => canvas(page).locator('input[data-a="answer"]');
const fbNo = (page: Page) => page.locator('.feedback.no');
const fbOk = (page: Page) => page.locator('.feedback.ok');
const sentence = (page: Page) => canvas(page).locator('.kg-pc-sent');

test('fa-IR missing addend: 27 + 53 = □ is false, 80 is the "added" trap, 27 + □ = 53 → 26', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(canvas(page).locator('.kg-pc-hint')).toContainText('□');
  await expect(canvas(page).locator('.kg-pc-tray button')).toHaveText(['۲۷', '۵۳', '□']);
  await tap(page, 'زهرا ۲۷ برچسب دارد.');
  await tap(page, 'او می‌خواهد ۵۳ برچسب داشته باشد.');
  await tap(page, 'زهرا الان چند برچسب دارد؟');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('نمی‌دانیم');
  await tap(page, 'زهرا چند برچسب دیگر لازم دارد؟');

  // Wrong sentence: adds the two numbers
  await put(page, '27', 0);
  await put(page, '53', 2);
  await put(page, '?', 4);
  await expect(sentence(page)).toHaveText('۲۷+۵۳=□');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('تساوی‌ات را بلند بخوان');

  await put(page, '?', 2);
  await put(page, '53', 4);
  await expect(sentence(page)).toHaveText('۲۷+□=۵۳');
  await answer(page).fill('۸۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('از ۵۳ هم بیشتر');
  await answer(page).fill('۲۶');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۲۷ + ۲۶ = ۵۳');
});

test('fa-IR shared total: the 2 bags are left out, □ ÷ 4 = 7, 3 is the "subtracted" trap', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'حسن گردوها را بین ۴ کودک به طور مساوی تقسیم کرد.');
  await tap(page, 'گردوها در ۲ کیسه بودند.');
  await tap(page, 'به هر کودک ۷ گردو رسید.');
  await tap(page, 'حسن چند گردو داشت؟');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('کیسه‌ها');
  await tap(page, 'گردوها در ۲ کیسه بودند.');

  // Wrong: 7 ÷ 4 = □ is a sentence that is not true for 28
  await put(page, '7', 0);
  await op(page, 1, '÷');
  await put(page, '4', 2);
  await put(page, '?', 4);
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('مربع کجای تساوی است');
  await put(page, '?', 0);
  await put(page, '7', 4);
  await expect(sentence(page)).toHaveText('□÷۴=۷');
  await answer(page).fill('۳');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('کمتر گردو داشت');
  await answer(page).fill('۲۸');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۲۸ ÷ ۴ = ۷');
});

test('fa-IR two operations: 2 × 40 + □ = 95, one notebook only is a trap', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'علی ۲ دفتر و یک پاک‌کن خرید.');
  await tap(page, 'او روی هم ۹۵ هزار تومان پول داد.');
  await tap(page, 'قیمت هر دفتر ۴۰ هزار تومان است.');
  await tap(page, 'قیمت پاک‌کن چقدر است؟');
  await put(page, '2', 0);
  await op(page, 1, '×');
  await put(page, '40', 2);
  await put(page, '?', 4);
  await put(page, '95', 6);
  await expect(sentence(page)).toHaveText('۲×۴۰+□=۹۵');
  await answer(page).fill('۵۵');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('یک');
  await answer(page).fill('۱۵');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۱۵ هزار تومان');
});

test('en: plates and the two-operation story, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.locator('.mission-tab').nth(1).click();
  await tap(page, 'Maryam has 24 cakes.');
  await tap(page, 'She puts 6 cakes on each plate.');
  await tap(page, 'How many plates does Maryam need?');
  // 24 + 6 = □ is not true for 4
  await put(page, '24', 0);
  await put(page, '6', 2);
  await put(page, '?', 4);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('Change the sign');
  await op(page, 1, '÷');
  await answer(page).fill('144');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('24 plates of 6');
  await answer(page).fill('4');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('4 × 6 = 24');

  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'Ali bought 2 notebooks and a rubber.');
  await tap(page, 'He paid 95p altogether.');
  await tap(page, 'Each notebook costs 40p.');
  await tap(page, 'How much does the rubber cost?');
  // Only 95 − 40: not every number used
  await put(page, '95', 0);
  await op(page, 1, '−');
  await put(page, '40', 2);
  await op(page, 3, '−');
  await put(page, '?', 4);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('sentence');
  await put(page, '2', 4);
  await op(page, 3, '×');
  await put(page, '?', 6);
  await expect(sentence(page)).toHaveText('95−40×2=□');
  await answer(page).fill('15');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('The rubber costs 15p');
});

test('every mission fits 390px with no horizontal scroll, and targets are at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(sentence(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await canvas(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toBe(0);
    }
  }
});
