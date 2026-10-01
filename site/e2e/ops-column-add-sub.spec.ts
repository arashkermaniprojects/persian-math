import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ops-column-add-sub/`;
const engine = (page: Page) => page.locator('kg-column-arithmetic');
const status = (page: Page) => page.locator('.kg-ca-status');
const box = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

async function openMission(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('.kg-ca-sheet').first()).toBeVisible();
}
const check = (page: Page, loc: string) => page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن' }).click();

test('fa-IR: place-value table, carry written above the next column', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-ca-sheet')).toHaveAttribute('dir', 'ltr');
  await expect(engine(page)).toHaveAttribute('data-ca-carry', 'above');
  await expect(page.locator('.kg-ca-h')).toHaveText(['ی', 'د']); // ones first in the DOM (and drawn on the right)
  const ones = box(page, 'حاصل، ستون یکان');
  await ones.click();
  await page.keyboard.type('۵');
  await expect(ones).toHaveClass(/\bok\b/);
  const carry = box(page, 'عدد کوچک بالای ستون دهگان');
  await expect(carry).toBeFocused();
  const top = await page.locator('.kg-ca-d', { hasText: '۵' }).first().boundingBox(); // the 5 of 58
  const c = await carry.boundingBox();
  expect(c!.y + c!.height).toBeLessThanOrEqual(top!.y + 1); // above the top number
  expect(Math.abs(c!.x + c!.width / 2 - (top!.x + top!.width / 2))).toBeLessThan(4); // same column
});

test('en: the carried digit goes below the answer line', async ({ page }) => {
  await openMission(page, 'en', 0);
  await expect(engine(page)).toHaveAttribute('data-ca-carry', 'below');
  await box(page, 'answer, ones column').click();
  await page.keyboard.type('5');
  const carry = box(page, 'carried digit, tens column');
  const tens = await box(page, 'answer, tens column').boundingBox();
  const c = await carry.boundingBox();
  expect(c!.y).toBeGreaterThanOrEqual(tens!.y + tens!.height - 1);
  await page.keyboard.type('18');
  await expect(status(page)).toContainText('Finished');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('85');
});

test('fa-IR addition: targeted feedback for the tens digit and a forgotten carry, then a correct sum', async ({ page }) => {
  await openMission(page, 'fa-IR', 0);
  const ones = box(page, 'حاصل، ستون یکان');
  await ones.click();
  await page.keyboard.type('۱'); // 8 + 7 = 15: wrote the 1
  await expect(ones).toHaveClass(/\bno\b/);
  await expect(ones).toHaveAttribute('aria-invalid', 'true');
  await expect(status(page)).toContainText('فقط یک رقم');
  await check(page, 'fa-IR'); // not finished: generic "boxes left" feedback
  await expect(page.locator('.feedback.no')).toContainText('هنوز چند خانه مانده');

  await page.keyboard.type('۵۱'); // the wrong digit is selected, so typing replaces it; then the carry
  const tens = box(page, 'حاصل، ستون دهگان');
  await expect(tens).toBeFocused();
  await expect(page.locator('.kg-ca-ask')).toContainText('۵ + ۲ + ۱');
  await page.keyboard.type('7'); // 5 + 2, forgetting the carry (Latin digits work too)
  await expect(status(page)).toContainText('عدد کوچک بالای این ستون');
  await page.keyboard.type('۸');
  await expect(status(page)).toContainText('تمام شد');
  await expect(page.locator('.kg-ca-box.ok')).toHaveCount(3);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۸۵');
  await expect(page.locator('.justify textarea')).toBeVisible();
  const st = await engine(page).evaluate((e) => (e as unknown as { state: { answer: string; wrong: number; errors: Record<string, number> } }).state);
  expect(st).toMatchObject({ answer: '85', wrong: 2, errors: { 'tens-digit': 1, 'forgot-carry': 1 } });
});

test('fa-IR subtraction: smaller-from-larger is caught; tapping the tens borrows; the old digit is caught', async ({ page }) => {
  await openMission(page, 'fa-IR', 1);
  const ones = box(page, 'حاصل، ستون یکان');
  await ones.click();
  await expect(page.locator('.kg-ca-ask')).toContainText('قرض بگیر');
  await page.keyboard.type('۵'); // 7 − 2
  await expect(ones).toHaveClass(/\bno\b/);
  await expect(status(page)).toContainText('عدد پایینی را از عدد بالایی');

  // A tap that is not a borrow is refused: the ones digit can't lend to itself.
  await page.getByRole('button', { name: 'ستون یکان، رقم ۲: قرض بگیر' }).click();
  await expect(status(page)).toContainText('لازم نیست');

  const five = page.getByRole('button', { name: 'ستون دهگان، رقم ۵: قرض بگیر' });
  await five.click();
  await expect(page.locator('.kg-ca-top.x')).toHaveCount(2);
  await expect(page.locator('.kg-ca-mark')).toHaveText(['۱۲', '۴']); // ones, tens
  await expect(page.getByRole('button', { name: 'ستون دهگان، رقم ۴: قرض بگیر' })).toBeVisible();
  // 12 − 7 = 5: the 5 already typed is right now.
  await expect(ones).toHaveClass(/\bok\b/);

  const tens = box(page, 'حاصل، ستون دهگان');
  await tens.click();
  await page.keyboard.type('۳'); // 5 − 2: used the digit before it lent
  await expect(status(page)).toContainText('عدد تازه');
  await page.keyboard.type('۲');
  await expect(tens).toHaveClass(/\bok\b/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۲۵');
});

test('fa-IR: borrowing across a zero (with the keyboard), then the inverse check sheet', async ({ page }) => {
  await openMission(page, 'fa-IR', 2);
  const check2 = page.locator('.kg-ca-check');
  await expect(check2).toBeHidden();
  await page.getByRole('button', { name: 'ستون دهگان، رقم ۰: قرض بگیر' }).click();
  await expect(status(page)).toContainText('چیزی ندارد');
  await page.getByRole('button', { name: 'ستون صدگان، رقم ۴: قرض بگیر' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'ستون دهگان، رقم ۱۰: قرض بگیر' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kg-ca-mark')).toHaveText(['۱۳', '۹', '۳']); // ones, tens, hundreds
  await expect(box(page, 'حاصل، ستون یکان').first()).toBeFocused();
  await page.keyboard.type('۵۳۲'); // 13 − 8, 9 − 6, 3 − 1
  await expect(check2).toBeVisible();
  await expect(check2).toContainText('بررسی جواب با جمع');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toBeVisible(); // the check sheet is not done yet
  // 235 + 168: 5 + 8 = 13 → 3, carry 1; 3 + 6 + 1 = 10 → 0, carry 1; 2 + 1 + 1 = 4.
  await page.keyboard.type('۳۱۰۱۴');
  await expect(status(page)).toContainText('تمام شد');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۴۰۳');
});

test('fa-IR decimals: line up the marks first, then add', async ({ page }) => {
  await openMission(page, 'fa-IR', 3);
  await expect(page.locator('.kg-ca-box:enabled')).toHaveCount(0);
  await expect(page.locator('.kg-ca-ask')).toContainText('ممیزها');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ممیزها');
  const marks = page.locator('.kg-ca-sheet .kg-ca-mk');
  const xs = async () => Promise.all((await marks.all()).map(async (m) => Math.round((await m.boundingBox())!.x)));
  expect(new Set(await xs()).size).toBeGreaterThan(1); // not lined up yet
  await page.getByRole('button', { name: 'عدد پایین را یک ستون به راست ببر' }).click();
  await expect(status(page)).toContainText('ممیزها زیر هم هستند');
  expect(new Set(await xs()).size).toBe(1); // every mark in one column, including the answer's
  await expect(page.locator('.kg-ca-pad')).toHaveText('۰'); // 12.5 is written 12.50
  await expect(page.locator('.kg-ca-align')).toBeHidden();
  await page.keyboard.type('۵۲۱۶۱'); // 0 + 5; 5 + 7 = 12 (carry 1); 2 + 3 + 1; 1
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۶/۲۵');
});

test('en: exchanging in subtraction and the reveal button', async ({ page }) => {
  await openMission(page, 'en', 1);
  await box(page, 'answer, ones column').click();
  await page.keyboard.type('5');
  await expect(status(page)).toContainText('take the bottom number away');
  await page.getByRole('button', { name: 'Show me this column' }).click();
  await expect(page.locator('.kg-ca-box.shown')).toHaveCount(1);
  await expect(page.locator('.kg-ca-top.x')).toHaveCount(2); // the reveal wrote the exchange too
  await page.keyboard.type('2');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('25');
});

test('no horizontal scroll at 390px, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < 4; i++) {
      await openMission(page, loc, i);
      const right = page.locator('.kg-ca-align button').nth(1);
      if (await right.isVisible()) await right.click();
      const reveal = page.locator('.kg-ca-reveal');
      while (await reveal.isVisible()) await reveal.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await page.locator('.kg-ca-box:visible, .kg-ca-top').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await check(page, loc);
      await expect(page.locator('.feedback.ok')).toBeVisible();
    }
  }
});
