import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/seq-machines-rules/`;
const pm = (page: Page) => page.locator('kg-pattern-machine');
const field = (page: Page, key: string) => pm(page).locator(`input[data-key="${key}"]`);
const op = (page: Page, o: string) => pm(page).locator(`.kg-pm-op[data-v="${o}"]`);
const tab = (page: Page, i: number) => page.locator('.mission-tab').nth(i).click();
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const fill = async (page: Page, vals: Record<string, string>) => {
  for (const [k, v] of Object.entries(vals)) await field(page, k).fill(v);
};
const FA = 'بررسی کن';

test('fa-IR: add-7 machine — running the given output forward (37) is caught, then 16, 22, 23 is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pm(page).locator('.kg-pm-mach')).toHaveAttribute('dir', 'ltr');
  await expect(pm(page).locator('.kg-pm-stage')).toHaveText('+۷');
  await expect(pm(page).locator('.kg-pm-cellin').first()).toHaveText('۲');
  await expect(pm(page).locator('.kg-pm-cellout').first()).toHaveText('۹');
  await expect(field(page, 'r4')).toHaveAttribute('aria-label', 'ورودی ردیف ۴');

  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('همهٔ خانه‌های خالی');

  await fill(page, { r2: '۱۶', r3: '۲۲', r4: '۳۷' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('۳۰ خروجی است');

  await fill(page, { r2: '۲', r4: '۲۳' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('اضافه');

  await fill(page, { r2: '۱۶' });
  await check(page, FA);
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR: hidden rule — "+ 4" fits only the first row and is caught, then × 3 is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(pm(page).locator('.kg-pm-op')).toHaveCount(4);
  await expect(pm(page).locator('.kg-pm-cellout')).toHaveText(['۶', '۱۵', '۳۰']);
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('یک علامت');

  await op(page, '+').click();
  await expect(op(page, '+')).toHaveAttribute('aria-checked', 'true');
  await field(page, 'rule').fill('۴');
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('فقط برای یک ردیف');

  await op(page, '×').click();
  await expect(op(page, '+')).toHaveAttribute('aria-checked', 'false');
  await field(page, 'rule').fill('۲');
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('هیچ ردیفی');

  await field(page, 'rule').fill('۳');
  await check(page, FA);
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: two-step machine — swapped order (14) is caught, then undoing in the wrong order, then 11, 23, 5', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(pm(page).locator('.kg-pm-stage')).toHaveText(['×۲', '+۳']);
  await fill(page, { r2: '۱۴', r3: '۲۳', r4: '۵' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('ترتیب مرحله‌ها');

  await fill(page, { r2: '۱۱', r4: '۲۹' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('دوباره وارد ماشین');

  await fill(page, { r4: '۸' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('ماشین ۳ تا اضافه کرده است');

  await fill(page, { r4: '۵' });
  await check(page, FA);
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: doubling sequence — adding the last gap (18) is caught, then ×2 with 24, 48, 96', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await expect(pm(page).locator('.kg-pm-hop b').first()).toHaveText('×?');
  await field(page, 'step').fill('۲');
  await expect(pm(page).locator('.kg-pm-hop b').first()).toHaveText('×۲');
  await fill(page, { t4: '۱۸', t5: '۳۶', t6: '۷۲' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('۱۲ + ۶');

  await fill(page, { t4: '۱۵' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('قاعده جمع نیست');

  await fill(page, { t4: '۲۴', t5: '۴۸', t6: '۹۶', step: '۳' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('چند برابر شده');

  await field(page, 'step').fill('۲');
  await check(page, FA);
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR: position-to-term — 3 × position only (30) and doubling term 10 (64) are caught, then 32 and 62', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(pm(page).locator('.kg-pm-seq .kg-pm-t')).toHaveText(['۵', '۸', '۱۱', '۱۴', '…']);
  await field(page, 't10').fill('۳۰');
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('هر دو خانه');

  await field(page, 't20').fill('۶۰');
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('فقط شمارهٔ خانه را در ۳ ضرب');

  await fill(page, { t10: '۳۲', t20: '۶۴' });
  await check(page, FA);
  await expect(page.locator('.feedback.no')).toContainText('دو بار حساب شد');

  await field(page, 't20').fill('۶۲');
  await check(page, FA);
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: add-7 machine and two-step machine (undo order 3.5, then right)', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await fill(page, { r2: '16', r3: '22', r4: '37' });
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('You put 30 through the machine');
  await field(page, 'r4').fill('23');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await fill(page, { r2: '11', r3: '26', r4: '5' });
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('other way round');
  await fill(page, { r3: '23', r4: '3.5' });
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('start with the last step');
  await field(page, 'r4').fill('5');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: position-to-term — one jump too many (35) and too few (29), then right', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 4);
  await fill(page, { t10: '35', t20: '62' });
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('one jump too many');
  await field(page, 't10').fill('29');
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('one jump too few');
  await field(page, 't10').fill('32');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: find the rule with the keyboard only ("+ 10" caught, then × 3)', async ({ page }) => {
  await page.goto(URL('en'));
  await tab(page, 1);
  await op(page, '+').focus();
  await page.keyboard.press('Enter');
  await expect(op(page, '+')).toHaveAttribute('aria-checked', 'true');
  await op(page, '÷').focus();
  await page.keyboard.press('Tab');
  await expect(field(page, 'rule')).toBeFocused();
  await page.keyboard.type('10');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback.no')).toContainText('just one row');

  await op(page, '×').focus();
  await page.keyboard.press('Space');
  await expect(op(page, '×')).toHaveAttribute('aria-checked', 'true');
  await op(page, '÷').focus();
  await page.keyboard.press('Tab'); // tabbing in selects the old number, so typing replaces it
  await expect(field(page, 'rule')).toBeFocused();
  await page.keyboard.type('3');
  await expect(field(page, 'rule')).toHaveValue('3');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await tab(page, i);
      await expect(pm(page)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await pm(page).locator('button, input').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} target`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
