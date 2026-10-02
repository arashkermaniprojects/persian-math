import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/geo-flat-shapes/`;
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

test('fa-IR triangle: too many corners, then open, then closed', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.kg-sb-hint')).toContainText('روی نقطه‌ها بزن');
  // the board itself stays left-to-right
  await expect(page.locator('.kg-sb-main')).toHaveAttribute('dir', 'ltr');

  await draw(page, [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
  await expect(page.locator('kg-shape-board polygon.kg-sb-d')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بیشتر از سه گوشه');

  await clear(page);
  await draw(page, [[0, 0], [3, 0], [1, 2]]);
  await expect(page.locator('kg-shape-board .kg-sb-v.first')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('روی نقطهٔ اول بزن');

  await tapAt(page, 0, 0);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR triangle with the keyboard only', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  const svg = page.locator('kg-shape-board svg.kg-sb-svg');
  await svg.focus();
  const k = (key: string, n = 1) => (async () => { for (let i = 0; i < n; i++) await page.keyboard.press(key); })();
  await k('Enter');
  await k('ArrowRight', 3);
  await k('Enter');
  await expect(page.locator('.kg-sb-live')).toHaveText(/۳, ۰/);
  await k('ArrowUp', 2);
  await k('ArrowLeft', 2);
  await k('Enter');
  // Backspace undoes the last corner; put it back
  await k('Backspace');
  await expect(page.locator('kg-shape-board .kg-sb-v')).toHaveCount(2);
  await k('Enter');
  await k('ArrowLeft');
  await k('ArrowDown', 2);
  await k('Enter');
  await expect(page.locator('kg-shape-board polygon.kg-sb-d')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR square: a rectangle is caught, a tilted square passes', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await draw(page, [[0, 0], [3, 0], [3, 2], [0, 2], [0, 0]]);
  await expect(page.locator('kg-shape-board .kg-sb-len').first()).toHaveText('۳');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مستطیل');

  await clear(page);
  await draw(page, [[1, 0], [3, 1], [2, 3], [0, 2], [1, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR find the triangles: the open shape, a missed one, then all three', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  const shape = (name: string) => page.getByRole('checkbox', { name });
  await shape('شکل زرد').click();
  await expect(shape('شکل زرد')).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بسته نیست');

  await shape('شکل زرد').click();
  await shape('شکل نارنجی').click();
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('وارونه');

  await shape('شکل آبی').click();
  // keyboard works too
  await shape('شکل بنفش').focus();
  await page.keyboard.press('Enter');
  await expect(shape('شکل بنفش')).toHaveAttribute('aria-checked', 'true');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR fold line: the diagonal is not a fold line', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await draw(page, [[1, 1], [5, 3]]);
  await expect(page.locator('kg-shape-board line.kg-sb-d')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('گوشه به گوشه');

  await draw(page, [[3, 0], [3, 4]]);
  await expect(page.locator('kg-shape-board line.kg-sb-d')).toHaveCount(1);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR mirror: a slid copy, then the mirror image', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 4);
  await expect(page.locator('kg-shape-board .kg-sb-mirror')).toHaveCount(1);
  await draw(page, [[5, 0], [3, 0], [3, 3], [5, 5]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('کپی');

  await clear(page);
  await draw(page, [[3, 5], [5, 3], [5, 0], [3, 0]]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: every mission, wrong then right, with English digits', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // triangle
  await draw(page, [[0, 0], [3, 0], [1, 2]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('still open');
  await tapAt(page, 0, 0);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // square
  await tab(page, 1);
  await draw(page, [[0, 0], [3, 0], [3, 2], [0, 2], [0, 0]]);
  await expect(page.locator('kg-shape-board .kg-sb-len').first()).toHaveText('3');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('rectangle');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('kg-shape-board polygon.kg-sb-d')).toHaveCount(0);
  await clear(page);
  await draw(page, [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // triangles
  await tab(page, 2);
  await page.getByRole('checkbox', { name: 'Red shape' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('circle');
  await page.getByRole('checkbox', { name: 'Red shape' }).click();
  for (const n of ['Orange shape', 'Blue shape', 'Purple shape']) await page.getByRole('checkbox', { name: n }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // fold line
  await tab(page, 3);
  await draw(page, [[2, 0], [2, 4]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('middle of the shape');
  await draw(page, [[0, 2], [6, 2]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // mirror
  await tab(page, 4);
  await draw(page, [[3, 0], [4, 0], [4, 3], [3, 5]]);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('do not match');
  await clear(page);
  await draw(page, [[3, 0], [5, 0], [5, 3], [3, 5]]);
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
