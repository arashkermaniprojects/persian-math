import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/pos-coordinates-translation/`;
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
async function slide(page: Page, name: string, keys: string[]) {
  await page.getByRole('button', { name }).focus();
  for (const k of keys) await page.keyboard.press(k);
}

test('fa-IR plot a point: the column bracket, x and y swapped, then right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  // Iran's books write coordinates as a column, x on top
  const vec = page.locator('.prompt .vec').first();
  await expect(vec.locator('span')).toHaveText(['۴', '۲']);
  await tapAt(page, 2, 4);
  await expect(page.locator('kg-shape-board .kg-sb-pt')).toHaveCount(1);
  await expect(page.locator('kg-shape-board .kg-sb-lt')).toHaveText('آ');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جابه‌جا');

  await tapAt(page, 2, 4); // tap again to remove
  await tapAt(page, 4, 2);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR fourth vertex of the parallelogram: a right-angled corner is caught', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await expect(page.locator('kg-shape-board .kg-sb-lt')).toHaveText(['آ', 'ب', 'پ']);
  await tapAt(page, 1, 3);
  await expect(page.locator('kg-shape-board .kg-sb-lt').last()).toHaveText('ت');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('موازی نیستند');

  await tapAt(page, 1, 3);
  await tapAt(page, 2, 3);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR translate: the readout is a column; moves swapped, then right', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await draw(page, [[3, 5], [5, 5], [3, 7], [3, 5]]);
  await expect(page.locator('kg-shape-board .kg-sb-coords.vec span')).toHaveText(['۳', '۵']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('جای دو عدد');

  await clear(page);
  await draw(page, [[5, 3], [7, 3], [5, 5]]);
  await expect(page.locator('kg-shape-board .kg-sb-coords.vec span')).toHaveText(['۵', '۵']);
  await tapAt(page, 5, 3);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR describe the translation: one short, then on the outline (keyboard)', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await slide(page, 'شکل سبز', ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هنوز درست روی خط‌چین نیست');
  await slide(page, 'شکل سبز', ['ArrowUp']);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: (x, y) in brackets; plot, translate and describe', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('.prompt')).toContainText('A(4, 2)');
  await tapAt(page, 5, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not (4, 2)');
  await tapAt(page, 5, 2);
  await tapAt(page, 4, 2);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 2);
  await draw(page, [[5, 3], [7, 3], [5, 6], [5, 3]]);
  await expect(page.locator('kg-shape-board .kg-sb-coords')).toHaveText('(5, 3)');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not triangle ABC translated');
  await clear(page);
  await draw(page, [[5, 3], [7, 3], [5, 5], [5, 3]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();

  await tab(page, 3);
  await slide(page, 'Green shape', ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp']);
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
