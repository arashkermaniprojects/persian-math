import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-triangles-quads/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

async function check(page: Page, loc: keyof typeof CHECK) {
  await page.getByRole('button', { name: CHECK[loc], exact: true }).click();
}
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board')).toBeVisible();
}
/** Tap board point (x, y): y up, from the board's own viewBox (22-unit margin, 44 units per step). */
async function tapAt(page: Page, x: number, y: number) {
  const svg = page.locator('kg-shape-board svg.kg-sb-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const [w, h, x0, y1] = await svg.evaluate((s: SVGSVGElement) => {
    const el = s.closest('kg-shape-board') as HTMLElement & { cfg: { x?: number[]; y?: number[] } };
    return [s.viewBox.baseVal.width, s.viewBox.baseVal.height, el.cfg.x?.[0] ?? 0, el.cfg.y?.[1] ?? 6];
  });
  await page.mouse.click(box.x + ((22 + (x - x0) * 44) * box.width) / w, box.y + ((22 + (y1 - y) * 44) * box.height) / h);
}
async function draw(page: Page, pts: [number, number][]) {
  for (const [x, y] of pts) await tapAt(page, x, y);
}
const clear = (page: Page) => page.locator('kg-shape-board [data-act="clear"]').click();
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');

const pick = (page: Page, name: string) => page.getByRole('checkbox', { name }).click();

test('fa-IR isosceles: a scalene one is caught, the tilted one is easy to miss', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await pick(page, 'شکل قرمز');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مختلف‌الاضلاع');
  await pick(page, 'شکل قرمز');
  await pick(page, 'شکل نارنجی');
  await pick(page, 'شکل بنفش');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مثلث کج');
  await pick(page, 'شکل سبز');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR right-angled and isosceles: unequal legs, then equal', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await draw(page, [[0, 0], [3, 0], [0, 2], [0, 0]]);
  await expect(page.locator('kg-shape-board .kg-sb-right')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هم‌اندازه نیستند');
  await clear(page);
  await draw(page, [[0, 0], [3, 0], [0, 3], [0, 0]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR rectangles: the parallelogram is a trap, the square counts', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await pick(page, 'شکل آبی');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('متوازی‌الاضلاع');
  await pick(page, 'شکل آبی');
  await pick(page, 'شکل سبز');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مربع هم مستطیل است');
  await pick(page, 'شکل نارنجی');
  await pick(page, 'شکل بنفش');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR trapezium: a parallelogram is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await draw(page, [[0, 0], [3, 0], [4, 2], [1, 2], [0, 0]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هر دو جفت');
  await clear(page);
  await draw(page, [[0, 0], [4, 0], [3, 2], [1, 2], [0, 0]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR rhombus diagonals: a side is not the diagonal', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(page.locator('kg-shape-board .kg-sb-lt')).toHaveText(['آ', 'ب', 'پ', 'ت']);
  await draw(page, [[4, 2], [5, 5]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('از ب به ت');
  await draw(page, [[4, 2], [2, 4]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: isosceles, rectangles and trapezium, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await pick(page, 'Blue shape');
  await check(page, 'en');
  await expect(no(page)).toContainText('scalene');
  await pick(page, 'Blue shape');
  for (const n of ['Orange shape', 'Green shape', 'Purple shape']) await pick(page, n);
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 2);
  for (const n of ['Orange shape', 'Green shape']) await pick(page, n);
  await check(page, 'en');
  await expect(no(page)).toContainText('A square is a rectangle too');
  await pick(page, 'Purple shape');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 3);
  await draw(page, [[0, 0], [4, 0], [5, 3], [1, 2], [0, 0]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('None of your sides');
  await clear(page);
  await draw(page, [[0, 0], [5, 0], [4, 2], [2, 2], [0, 0]]);
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();
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
