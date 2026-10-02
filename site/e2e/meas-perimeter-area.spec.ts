import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-perimeter-area/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const answer = (page: Page) => page.locator('.int-input');
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
const draw = async (page: Page, pts: [number, number][]) => { for (const [x, y] of pts) await tapAt(page, x, y); };
/** Shade the unit cell whose lower-left corner is (x, y). */
const cell = (page: Page, x: number, y: number) => tapAt(page, x + 0.5, y + 0.5);
const clear = (page: Page) => page.locator('kg-shape-board [data-act="clear"]').click();

// The L-shape's 12 unit cells (lower-left corners).
const L_CELLS: [number, number][] = [
  [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [1, 4], [2, 4],
];

test('fa-IR cover the shape: a square outside, one missed, then all 12', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.kg-sb-hint')).toContainText('خانه‌های داخل شکل');
  await cell(page, 4, 4); // outside the L
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیرون از شکل');

  await cell(page, 4, 4); // tap again to unshade
  for (const [x, y] of L_CELLS.slice(0, 11)) await cell(page, x, y);
  await expect(page.locator('.kg-sb-facts')).toContainText('مساحت: ۱۱');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('سفید مانده');

  await cell(page, ...L_CELLS[11]);
  await expect(page.locator('.kg-sb-facts')).toContainText('مساحت: ۱۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('۱۲');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR walk round: counting edge squares and giving the area are caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await answer(page).fill('۱۱');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('دو بار حساب شود');
  await answer(page).fill('۱۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یعنی مساحت');
  await answer(page).fill('۱۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR same area: the 4 × 3 rug has too small a perimeter, 6 × 2 is right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await draw(page, [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]]);
  await expect(page.locator('.kg-sb-facts')).toContainText('محیط: ۱۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('درازتر و باریک‌تر');

  await clear(page);
  await draw(page, [[0, 0], [6, 0], [6, 2], [0, 2], [0, 0]]);
  await expect(page.locator('.kg-sb-facts')).toContainText('مساحت: ۱۲');
  await expect(page.locator('.kg-sb-facts')).toContainText('محیط: ۱۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: rectangle and L-shape areas, wrong then right; an L with area 12 and perimeter 16', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 2);
  await expect(page.locator('kg-shape-board .kg-sb-len').first()).toHaveText('6');
  await answer(page).fill('20');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('perimeter');
  await answer(page).fill('24');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await answer(page).fill('27');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('counted one part twice');
  await answer(page).fill('30');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('top right corner is empty');
  await answer(page).fill('21');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // any rectilinear shape works: an L of 4 × 2 + 2 × 2
  await tab(page, 4);
  await draw(page, [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4], [0, 0]]);
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
