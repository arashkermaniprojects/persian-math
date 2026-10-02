import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-lines-angles/`;
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

test('fa-IR rays: lines and rays have arrowheads; a line is caught, then both rays', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // one arrowhead per ray, two on the line, none on the segments
  await expect(page.locator('kg-shape-board polygon.kg-sb-arrow')).toHaveCount(4);
  const fig = (name: string) => page.getByRole('checkbox', { name });
  await fig('شکل آبی').click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('از هر دو طرف');
  await fig('شکل آبی').click();
  await fig('شکل سبز').click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('یک نیم‌خط دیگر');
  await fig('شکل قرمز').click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR parallel: a level line is not parallel, the copied slope is', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await draw(page, [[1, 4], [4, 4]]);
  await expect(page.locator('kg-shape-board line.kg-sb-d')).toHaveCount(1);
  await expect(page.locator('kg-shape-board polygon.kg-sb-d.kg-sb-arrow')).toHaveCount(2);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('۳ خانه به راست');
  await draw(page, [[1, 4], [4, 5]]);
  await expect(page.locator('kg-shape-board line.kg-sb-d')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR perpendicular: upright is not perpendicular to a slanted segment', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await draw(page, [[3, 0], [3, 6]]);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('ایستاده');
  await draw(page, [[3, 3], [2, 5]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR obtuse angle against the square-corner card', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await draw(page, [[4, 1], [1, 1], [3, 3]]);
  await expect(page.locator('kg-shape-board .kg-sb-card')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('کوچک‌تر');
  await clear(page);
  await draw(page, [[4, 1], [1, 1], [0, 3]]);
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR biggest angle: long arms are a trap', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  const angle = (name: string) => page.getByRole('checkbox', { name });
  await angle('زاویهٔ نارنجی').click();
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('بلندی ضلع‌ها');
  await angle('زاویهٔ نارنجی').click();
  await angle('زاویهٔ سبز').click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: rays, parallel and obtuse, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // a level segment has no height for Playwright's visibility test, so pick it with the keyboard
  const orange = page.getByRole('checkbox', { name: 'Orange figure' });
  await orange.focus();
  await page.keyboard.press('Enter');
  await expect(orange).toHaveAttribute('aria-checked', 'true');
  await check(page, 'en');
  await expect(no(page)).toContainText('line segment');
  await orange.focus();
  await page.keyboard.press('Enter');
  for (const n of ['Green figure', 'Red figure']) await page.getByRole('checkbox', { name: n }).click();
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 1);
  await expect(page.locator('kg-shape-board .kg-sb-lt').first()).toHaveText('A');
  await draw(page, [[0, 3], [3, 4]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('red dot');
  await draw(page, [[1, 4], [4, 5]]);
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await tab(page, 3);
  await draw(page, [[4, 1], [1, 1], [1, 4]]);
  await check(page, 'en');
  await expect(no(page)).toContainText('exactly a right angle');
  await clear(page);
  await draw(page, [[4, 1], [1, 1], [0, 3]]);
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
