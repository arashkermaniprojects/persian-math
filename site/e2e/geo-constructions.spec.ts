import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-constructions/`;
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

const tool = (page: Page, t: 'pen' | 'compass') => page.locator(`kg-shape-board [data-act="${t}"]`).click();
/** A compass circle: tap the centre, then a point it goes through. */
async function circle(page: Page, c: [number, number], through: [number, number]) {
  await tool(page, 'compass');
  await tapAt(page, ...c);
  await tapAt(page, ...through);
}
const circles = (page: Page) => page.locator('kg-shape-board circle.kg-sb-circle');
const deg = Math.PI / 180;

test('fa-IR chord and arc: no circle, a diameter, then a chord', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('kg-shape-board [data-act="compass"]')).toHaveText('پرگار');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('اول با پرگار');
  await circle(page, [3, 3], [5, 3]);
  await expect(circles(page)).toHaveCount(1);
  await tool(page, 'pen');
  await draw(page, [[5, 3], [1, 3]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('بزرگ‌ترین وتر');
  await draw(page, [[5, 3], [3, 5]]);
  await expect(page.locator('kg-shape-board .kg-sb-lt')).toHaveText(['آ', 'ب']);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR perpendicular bisector: by eye fails, through the circle crossings passes', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await draw(page, [[3, 0], [3, 5]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('عمود نیست');
  await circle(page, [2, 2], [4, 3]);
  await circle(page, [4, 3], [2, 2]);
  await expect(circles(page)).toHaveCount(2);
  await tool(page, 'pen');
  const h = Math.sqrt(3.75) / Math.sqrt(5);
  await draw(page, [[3 - h, 2.5 + 2 * h], [3 + h, 2.5 - 2 * h]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR angle bisector of a 45° angle', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await tool(page, 'pen');
  await draw(page, [[1, 1], [3, 2]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('نصف نمی‌کند');
  const p: [number, number] = [1 + Math.SQRT2, 1 + Math.SQRT2];
  await circle(page, [1, 1], [3, 1]);
  await circle(page, [3, 1], p);
  await circle(page, p, [3, 1]);
  await tool(page, 'pen');
  // the far crossing of the last two circles, on the bisector at 22.5°
  const m = [(3 + p[0]) / 2, (1 + p[1]) / 2], d = Math.hypot(3 - p[0], 1 - p[1]) * (Math.sqrt(3) / 2);
  await draw(page, [[1, 1], [m[0] + d * Math.cos(22.5 * deg), m[1] + d * Math.sin(22.5 * deg)]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR equilateral: a dot near the top fails, the crossing passes', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await tool(page, 'pen');
  await draw(page, [[1, 1], [4, 1], [3, 4], [1, 1]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('برخورد دو دایره');
  await clear(page);
  await circle(page, [1, 1], [4, 1]);
  await circle(page, [4, 1], [1, 1]);
  await tool(page, 'pen');
  await draw(page, [[1, 1], [4, 1], [2.5, 1 + 1.5 * Math.sqrt(3)], [1, 1]]);
  await expect(page.locator('kg-shape-board .kg-sb-len')).toHaveText(['۳', '۳', '۳']);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: chord and the triangle from three sides, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await circle(page, [3, 3], [3, 5]);
  await tool(page, 'pen');
  await draw(page, [[3, 5], [4, 4]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('not on the circle');
  await draw(page, [[3, 5], [5, 3]]);
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 4);
  await tool(page, 'pen');
  await draw(page, [[1, 1], [5, 1], [4, 3], [1, 1]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('not 4, 3 and 2');
  await clear(page);
  await circle(page, [1, 1], [4, 1]);
  await circle(page, [5, 1], [3, 1]);
  await tool(page, 'pen');
  await draw(page, [[1, 1], [5, 1], [1 + 21 / 8, 1 + Math.sqrt(9 - (21 / 8) ** 2)], [1, 1]]);
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
