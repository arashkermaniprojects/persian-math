import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/pos-transformations/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

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

test('fa-IR four quadrants: the minus sign forgotten, then (−3, 2)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.prompt .vec').first().locator('span')).toHaveText(['-۳', '۲']);
  await tapAt(page, 3, 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('علامت منفی');
  await tapAt(page, 3, 2);
  await tapAt(page, -3, 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR reflect in the y-axis: a slid copy, then the mirror image', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(page.locator('kg-shape-board .kg-sb-mirror')).toHaveCount(1);
  await draw(page, [[-4, 1], [-1, 1], [-4, 3], [-4, 1]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سُر دادی');
  await clear(page);
  await draw(page, [[-1, 1], [-4, 1], [-1, 3], [-1, 1]]);
  await expect(page.locator('kg-shape-board .kg-sb-coords.vec span')).toHaveText(['−۱', '۱']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR rotate 90° clockwise: anticlockwise is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await draw(page, [[-1, 1], [-1, 3], [-4, 1], [-1, 1]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('خلاف جهت');
  await clear(page);
  await draw(page, [[1, -1], [1, -3], [4, -1], [1, -1]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR centre of symmetry: the equilateral triangle and the kite are caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  const shape = (name: string) => page.getByRole('checkbox', { name });
  await shape('مثلث سبز').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یک‌سوم دور');
  await shape('مثلث سبز').click();
  await shape('شکل قرمز').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('محور تقارن دارد');
  await shape('شکل قرمز').click();
  for (const n of ['متوازی‌الاضلاع نارنجی', 'شکل آبی', 'مستطیل بنفش']) await shape(n).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR complete the half turn: a mirrored half is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await draw(page, [[4, 4], [4, 2], [6, 2], [7, 3]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('نیم دور به دست نمی‌آید');
  await clear(page);
  await draw(page, [[4, 4], [4, 2], [2, 2], [1, 3]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: four quadrants, reflection, rotation, centre of symmetry', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('.prompt')).toContainText('A(-3, 2)');
  await tapAt(page, 2, -3);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('swapped x and y');
  await tapAt(page, 2, -3);
  await tapAt(page, -3, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 1);
  await draw(page, [[-1, 1], [-4, 1], [-1, 4], [-1, 1]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not the reflection');
  await clear(page);
  await draw(page, [[-1, 1], [-4, 1], [-1, 3], [-1, 1]]);
  await expect(page.locator('kg-shape-board .kg-sb-coords')).toHaveText('(−1, 1)');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await draw(page, [[1, -1], [1, -3], [4, -1], [1, -1]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  for (const n of ['Orange parallelogram', 'Purple rectangle']) await page.getByRole('checkbox', { name: n }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('another shape');
  await page.getByRole('checkbox', { name: 'Blue shape' }).click();
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
