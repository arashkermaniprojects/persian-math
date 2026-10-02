import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-polygons-angles/`;
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
const answer = (page: Page) => page.locator('.int-input');

test('fa-IR regular polygons: the rhombus is a trap', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await pick(page, 'شکل آبی');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('لوزی');
  await pick(page, 'شکل آبی');
  for (const n of ['شکل نارنجی', 'شکل قرمز', 'شکل بنفش']) await pick(page, n);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR triangle sum: the board shows the angles; 360 is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await draw(page, [[0, 0], [4, 0], [0, 4], [0, 0]]);
  await expect(page.locator('kg-shape-board .kg-sb-ang')).toHaveText(['۹۰°', '۴۵°', '۴۵°']);
  await answer(page).fill('۳۶۰');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('دور کامل');
  await answer(page).fill('۱۸۰');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR missing angle: not halving is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(page.locator('kg-shape-board .kg-sb-right')).toHaveCount(1);
  await answer(page).fill('۹۰');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('تقسیم کن');
  await answer(page).fill('۴۵');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR pentagon: draw the diagonals from آ; splitting from the middle gives 900', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await draw(page, [[1, 1], [6, 4]]);
  await draw(page, [[1, 1], [3, 6]]);
  await expect(page.locator('kg-shape-board line.kg-sb-d, kg-shape-board polyline.kg-sb-d')).toHaveCount(2);
  await answer(page).fill('۹۰۰');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۳۶۰');
  await answer(page).fill('۵۴۰');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: regular, pentagon and hexagon, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await pick(page, 'Green shape');
  await check(page, 'en');
  await expect(no(page)).toContainText('rectangle');
  await pick(page, 'Green shape');
  for (const n of ['Orange shape', 'Red shape', 'Purple shape']) await pick(page, n);
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 3);
  await answer(page).fill('360');
  await check(page, 'en');
  await expect(no(page)).toContainText('quadrilateral');
  await answer(page).fill('540');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 4);
  await answer(page).fill('720');
  await check(page, 'en');
  await expect(no(page)).toContainText('one angle');
  await answer(page).fill('120');
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
