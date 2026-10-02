import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-solids/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 5;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board')).toBeVisible();
}
const solid = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tile = (page: Page, n: number) => page.locator(`kg-shape-board [data-act="pick"][data-n="${n}"]`);

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
const cells = async (page: Page, cs: [number, number][]) => { for (const [x, y] of cs) await tapAt(page, x + 0.5, y + 0.5); };

test('fa-IR find the cube: the cuboid is caught, then the cube', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.kg-sb-hint')).toContainText('روی شکل‌های درست بزن');
  await expect(page.locator('kg-shape-board .kg-sb-solid')).toHaveCount(6);
  await solid(page, 'جسم نارنجی').click();
  await expect(solid(page, 'جسم نارنجی')).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جعبهٔ کفش');

  await solid(page, 'جسم نارنجی').click();
  await solid(page, 'جسم آبی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR faces of a cube: the faces in the picture are not all of them', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await expect(page.locator('kg-shape-board figure.kg-sb-solid')).toHaveCount(1);
  await expect(tile(page, 6)).toHaveText('۶');
  await tile(page, 3).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('پشت مکعب');
  await tile(page, 4).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بالا و پایین');
  await tile(page, 6).click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR cube net: a 2 × 3 block does not fold into a cube, a cross does', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await cells(page, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
  await expect(page.locator('.kg-sb-facts')).toContainText('۶ مربع');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یک وجه باز می‌ماند');

  await page.locator('kg-shape-board [data-act="clear"]').click();
  await cells(page, [[0, 1], [1, 1], [2, 1], [3, 1], [1, 2]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('۶ خانه لازم است');
  await cells(page, [[1, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: what rolls, and the edges of a pyramid, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 1);
  await solid(page, 'Orange shape').click(); // cylinder
  await solid(page, 'Purple shape').click(); // sphere
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('A cone rolls');
  await solid(page, 'Red shape').click(); // prism
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('only flat faces');
  await solid(page, 'Red shape').click();
  await solid(page, 'Blue shape').click(); // cone
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await tile(page, 5).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('dashed lines are edges');
  await tile(page, 8).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  // six in a row is not a net either
  await tab(page, 4);
  await cells(page, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('same face');
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
