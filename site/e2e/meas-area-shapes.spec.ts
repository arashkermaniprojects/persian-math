import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-area-shapes/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const MISSIONS = 6;

const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const answer = (page: Page) => page.locator('.int-input');
async function tab(page: Page, i: number) {
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-shape-board')).toBeVisible();
}
const piece = (page: Page) => page.locator('kg-shape-board [data-k="0"]');
/** Where piece 0 has moved to. */
const pieceAt = (page: Page) =>
  page.locator('kg-shape-board').evaluate((el) => (el as unknown as { state: { board: { pieces: { at: [number, number] }[] } } }).state.board.pieces[0].at);
/** Slide piece 0 with the arrow keys (the keyboard way) so it ends `at` [x, y]. */
async function slideTo(page: Page, to: [number, number]) {
  const at = await pieceAt(page);
  await piece(page).focus();
  const dx = to[0] - at[0], dy = to[1] - at[1];
  for (let i = 0; i < Math.abs(dx); i++) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.abs(dy); i++) await page.keyboard.press(dy > 0 ? 'ArrowUp' : 'ArrowDown');
  expect(await pieceAt(page)).toEqual(to);
}

test('fa-IR slide the triangle: halfway is not a fit, the dashed gap is', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await expect(page.locator('.kg-sb-hint')).toContainText('جای خط‌چین');
  await slideTo(page, [2, 0]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ننشسته است');

  // drag it the rest of the way with the mouse (2 squares to the right)
  const box = (await piece(page).boundingBox())!;
  const unit = box.width / 2; // the triangle is 2 units wide
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75 + unit, box.y + box.height * 0.8, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.75 + 2 * unit, box.y + box.height * 0.8, { steps: 4 });
  await page.mouse.up();
  expect(await pieceAt(page)).toEqual([4, 0]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('مستطیل');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR parallelogram: base × slanted side is caught, base × height passes', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 1);
  await answer(page).fill('۳۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ضلع کج');
  await answer(page).fill('۱۲');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('فقط برای مثلث');
  await answer(page).fill('۲۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR two triangles: sliding without turning does not fit; a half turn then slide does', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 2);
  await slideTo(page, [1, -4]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('بچرخانش');

  await page.locator('kg-shape-board [data-act="clear"]').click();
  await page.getByRole('button', { name: 'چرخش ساعتگرد' }).click();
  await page.getByRole('button', { name: 'چرخش ساعتگرد' }).click();
  // turned half a turn about (2, 5): its corners are now (4, 6), (0, 6), (3, 3); the gap is (5, 3), (1, 3), (4, 0)
  await slideTo(page, [1, -3]);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toContainText('متوازی‌الاضلاع');
});

test('fa-IR house: the roof not halved, then the right total', async ({ page }) => {
  await page.goto(URL('fa-IR'));
  await tab(page, 3);
  await answer(page).fill('۳۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('نصف نکردی');
  await answer(page).fill('۲۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: two trapezia and the circle, wrong then right', async ({ page }) => {
  await page.goto(URL('en'));
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await tab(page, 4);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('does not fit');
  const turn = page.getByRole('button', { name: 'Turn anticlockwise' });
  await turn.click();
  await turn.click();
  // a half turn about (3, 5) puts the corners at (6, 6), (1, 6), (3, 4), (5, 4); the gap starts at (8, 2)
  await slideTo(page, [2, -4]);
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('parallelogram');

  await tab(page, 5);
  const choices = page.locator('.choice');
  await expect(choices).toHaveCount(4);
  await choices.nth(0).click(); // 9 = radius × radius
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('radius × radius');
  await choices.nth(2).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toContainText('28.26');
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
