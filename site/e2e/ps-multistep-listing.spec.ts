import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ps-multistep-listing/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;

const canvas = (page: Page) => page.locator('kg-problem-canvas');
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const tap = (page: Page, name: string) => canvas(page).getByRole(/[؟?]$/.test(name) ? 'radio' : 'button', { name, exact: true }).click();
const tool = (page: Page, t: number) => canvas(page).locator('.kg-pc-tool').nth(t);
/** Write a sentence a o b = □ in tool t: numbers a, b, then the box; set the sign; type the box's value. */
async function sentence(page: Page, t: number, a: string, sign: string, b: string, solved: string) {
  const s = tool(page, t);
  for (const [v, i] of [[a, 0], [b, 2], ['?', 4]] as const) {
    await s.locator(`.kg-pc-tray [data-v="${v}"]`).click();
    await s.locator(`[data-a="slot"][data-v="${i}"]`).click();
  }
  const o = s.locator('.kg-pc-op');
  for (let k = 0; k < 3 && (await o.textContent())?.trim() !== sign; k++) await o.click();
  await expect(o).toHaveText(sign);
  const box = s.locator('input[data-a="solve"]');
  await box.fill(solved);
  await box.press('Tab');
}
async function cell(page: Page, r: number, c: number, v: string) {
  const i = canvas(page).locator(`input[data-r="${r}"][data-c="${c}"]`);
  await i.fill(v);
  await i.press('Tab');
}
const answer = (page: Page) => canvas(page).locator('input[data-a="answer"]');
const fbNo = (page: Page) => page.locator('.feedback.no');
const fbOk = (page: Page) => page.locator('.feedback.ok');

test('fa-IR sub-problems: the first box joins the second sentence; skipping step a) is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tap(page, 'یک کتاب داستان ۳۹۵ صفحه دارد.');
  await tap(page, 'حسن در هفتهٔ اول ۱۵۰ صفحه خواند.');
  await tap(page, 'او در هفتهٔ دوم ۱۳۰ صفحه خواند.');
  await tap(page, 'چند صفحه را هنوز نخوانده است؟');
  // Wrong: starts with 395 − 150
  await sentence(page, 0, '395', '−', '150', '245');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('مرحلهٔ «الف»');
  await sentence(page, 0, '150', '+', '130', '۲۸۰');
  await expect(tool(page, 1).locator('.kg-pc-tray button')).toHaveText(['۳۹۵', '۱۵۰', '۱۳۰', '۱۲', '۲۸۰', '□']);
  await sentence(page, 1, '395', '−', '280', '۱۱۵');
  await answer(page).fill('۲۴۵');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('دو');
  await answer(page).fill('۱۱۵');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۳۹۵ − ۲۸۰ = ۱۱۵');
});

test('fa-IR simpler problem: easy numbers first; "shorter" is not add; 140 is the simpler answer', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await page.locator('.mission-tab').nth(1).click();
  await tap(page, 'قد رضا ۱۴۷ سانتی‌متر است.');
  await tap(page, 'احمد ۱۱ سانتی‌متر از رضا کوتاه‌تر است.');
  await tap(page, 'قد احمد چند سانتی‌متر است؟');
  await expect(tool(page, 0).locator('.kg-pc-tray button')).toHaveText(['۱۵۰', '۱۰', '□']);
  await sentence(page, 0, '150', '+', '10', '۱۶۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('کوتاه‌تر');
  await sentence(page, 0, '150', '−', '10', '۱۴۰');
  await sentence(page, 1, '147', '−', '11', '۱۳۶');
  await answer(page).fill('۱۴۰');
  await check(page, 'fa-IR');
  await expect(fbNo(page)).toContainText('مسئلهٔ ساده‌تر');
  await answer(page).fill('۱۳۶');
  await check(page, 'fa-IR');
  await expect(fbOk(page)).toContainText('۱۴۷ − ۱۱ = ۱۳۶');
});

test('en systematic list: the number column builds itself; a wrong digit and a repeat are caught', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(2).click();
  await tap(page, 'The tens digit is 5 or 7.');
  await tap(page, 'The ones digit is 3, 4 or 8.');
  await tap(page, 'How many two-digit numbers like this are there?');
  await cell(page, 0, 0, '5');
  await cell(page, 0, 1, '3');
  await cell(page, 1, 0, '3');
  await cell(page, 1, 1, '5');
  await expect(canvas(page).locator('td.calc')).toHaveText(['53', '35']);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('breaks the rule');
  await cell(page, 1, 0, '5');
  await cell(page, 1, 1, '3');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('twice');
  const rows = [[5, 3], [5, 4], [5, 8], [7, 3], [7, 4], [7, 8]];
  for (let r = 0; r < rows.length; r++) {
    if (r >= 2) await canvas(page).getByRole('button', { name: '+ add a row' }).click();
    await cell(page, r, 0, String(rows[r][0]));
    await cell(page, r, 1, String(rows[r][1]));
  }
  await expect(canvas(page).locator('td.calc')).toHaveText(['53', '54', '58', '73', '74', '78']);
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('6 numbers');
});

test('en choose a strategy: guess and check or draw; both lead to Ali = 6, 18 is Fatima', async ({ page }) => {
  await page.goto(URL('en'));
  await page.locator('.mission-tab').nth(3).click();
  await tap(page, 'Fatima has 3 times as many stamps as Ali.');
  await tap(page, 'Together they have 24 stamps.');
  await tap(page, 'How many stamps does Ali have?');
  await expect(canvas(page).locator('.kg-pc-tool')).toHaveCount(0);
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('Choose a strategy');
  await canvas(page).getByRole('radio', { name: 'Guess and check' }).click();
  const x = canvas(page).locator('input[data-a="gx"]');
  await x.fill('5');
  await x.press('Enter');
  await x.fill('6');
  await x.press('Enter');
  await expect(canvas(page).locator('td.cmp')).toHaveText(['< 24', '= 24 ✓']);
  await answer(page).fill('18');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('Fatima');
  // Switch to drawing: 4 equal parts of 24
  await canvas(page).getByRole('radio', { name: 'Draw a picture' }).click();
  await canvas(page).getByRole('button', { name: 'more parts' }).click();
  await canvas(page).getByRole('button', { name: 'more parts' }).click();
  await canvas(page).locator('.kg-pc-tray [data-v="24"]').click();
  await canvas(page).locator('[data-a="slot"][data-v="w"]').click();
  await canvas(page).locator('.kg-pc-tray [data-v="?"]').click();
  await canvas(page).locator('[data-a="slot"][data-v="p0"]').click();
  await expect(canvas(page).locator('[data-a="slot"]')).toHaveText(['24', '?', '?', '?', '?']);
  await answer(page).fill('8');
  await check(page, 'en');
  await expect(fbNo(page)).toContainText('4 parts altogether');
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(fbOk(page)).toContainText('6 + 18 = 24');
});

test('every mission fits 390px with no horizontal scroll, and targets are at least 44px', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 4; m++) {
      await page.locator('.mission-tab').nth(m).click();
      if (m === 3) await canvas(page).getByRole('radio').last().click();
      await expect(canvas(page).locator('.kg-pc-tool').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const small = await canvas(page).locator('button, input').evaluateAll((bs) =>
        bs.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
      expect(small, `${loc} mission ${m + 1}: targets under 44px`).toBe(0);
    }
  }
});
