import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/ratio-scale-similar/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 4;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board')).toBeVisible();
}
/** Tap board point (x, y), y up: 44 units per step, margin 32 with numbered axes (22 without). */
async function tapAt(page: Page, x: number, y: number) {
  const svg = page.locator('kg-shape-board svg.kg-sb-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const [w, h, x0, y1, m] = await svg.evaluate((s: SVGSVGElement) => {
    const el = s.closest('kg-shape-board') as HTMLElement & { cfg: { x?: number[]; y?: number[]; axes?: boolean } };
    return [s.viewBox.baseVal.width, s.viewBox.baseVal.height, el.cfg.x?.[0] ?? 0, el.cfg.y?.[1] ?? 6, el.cfg.axes ? 32 : 22];
  });
  await page.mouse.click(box.x + ((m + (x - x0) * 44) * box.width) / w, box.y + ((m + (y1 - y) * 44) * box.height) / h);
}
async function draw(page: Page, pts: [number, number][]) {
  for (const [x, y] of pts) await tapAt(page, x, y);
}
const clear = (page: Page) => page.locator('kg-shape-board [data-act="clear"]').click();

const pick = (page: Page, n: string) => page.getByRole('radio', { name: n, exact: true }).click();

test('fa-IR enlarge by 2: adding 2 to each side is caught, then 6 by 2', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await draw(page, [[0, 0], [5, 0], [5, 3], [0, 3], [0, 0]]);
  await expect(page.locator('kg-shape-board .kg-sb-len').filter({ hasText: '۵' })).toHaveCount(2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۲ اضافه کردی');
  await clear(page);
  await draw(page, [[0, 0], [6, 0], [6, 2], [0, 2], [0, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR which are similar: added and one-way stretches are caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  const shape = (name: string) => page.getByRole('checkbox', { name });
  await expect(shape('مستطیل نارنجی')).toHaveCount(0); // the reference cannot be tapped
  await shape('مستطیل آبی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('به هر ضلع ۱ اضافه شده');
  await shape('مستطیل آبی').click();
  await shape('مستطیل قرمز').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('فقط یک ضلع');
  await shape('مستطیل قرمز').click();
  await shape('مستطیل سبز').click();
  await shape('مستطیل بنفش').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR scale factor: the difference is caught, then 3', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await pick(page, '۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('تفاوت دو ضلع');
  await pick(page, '۳');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR draw a similar rectangle: 3 by 5 is caught, then 3 by 6', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await draw(page, [[3, 0], [6, 0], [6, 5], [3, 5], [3, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۳ در ۵');
  await clear(page);
  await draw(page, [[3, 0], [6, 0], [6, 6], [3, 6], [3, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: enlarge, which are similar, scale factor', async ({ page }) => {
  await page.goto(URL('en'));
  await draw(page, [[0, 0], [3, 0], [3, 1], [0, 1], [0, 0]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Right shape, wrong size');
  await clear(page);
  await draw(page, [[4, 0], [6, 0], [6, 6], [4, 6], [4, 0]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 1);
  await page.getByRole('checkbox', { name: 'Green rectangle' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('turned round');
  await page.getByRole('checkbox', { name: 'Purple rectangle' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await pick(page, '6');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('side length');
  await pick(page, '3');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

for (const loc of ['fa-IR', 'en']) {
  test(`${loc}: no horizontal scroll at 390px on any mission`, async ({ page }) => {
    await page.goto(URL(loc));
    for (let i = 0; i < MISSIONS; i++) {
      await tab(page, i);
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `mission ${i + 1}`).toBeLessThanOrEqual(cw);
    }
  });
}
