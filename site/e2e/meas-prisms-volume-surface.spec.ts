import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-prisms-volume-surface/`;
const CHECK: Record<string, string> = { 'fa-IR': 'بررسی کن', en: 'Check' };
const MISSIONS = 5;
const sv = (page: Page) => page.locator('kg-solid-viewer');
const svg = (page: Page) => sv(page).locator('svg.kg-sv-svg');
const no = (page: Page) => page.locator('.feedback.no');
const ok = (page: Page) => page.locator('.feedback.ok');
const check = (page: Page, loc: string) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
/** Face chip n (0-based face number) in the list under the picture. */
const chip = (page: Page, f: number) => sv(page).locator(`.kg-sv-faces [data-f="${f}"]`);
const more = (page: Page) => sv(page).locator('[data-a="more"]');
/** Tap (or click) face f on the picture at its centre: the viewBox is −150…150 both ways. */
async function tapFace(page: Page, f: number, touch = false) {
  const pts = (await svg(page).locator(`polygon[data-f="${f}"]`).first().getAttribute('points'))!.split(' ').map((p) => p.split(',').map(Number));
  const [cx, cy] = [0, 1].map((k) => pts.reduce((t, p) => t + p[k], 0) / pts.length);
  await svg(page).scrollIntoViewIfNeeded();
  const box = (await svg(page).boundingBox())!;
  const x = box.x + ((cx + 150) / 300) * box.width, y = box.y + ((cy + 150) / 300) * box.height;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
async function open(page: Page, loc: string, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(svg(page).locator('polygon').first()).toBeVisible();
}
async function answer(page: Page, value: string, unit: string) {
  await sv(page).locator('.kg-sv-num').fill(value);
  await sv(page).locator(`[data-u="${unit}"]`).click();
}
async function unfold(page: Page) {
  await sv(page).locator('[data-a="open"]').click();
  await expect(sv(page).locator('.kg-sv-desc')).toHaveText(/./);
  await expect.poll(() => sv(page).evaluate((e) => (e as HTMLElement & { state: { solid: { unfolded: number } } }).state.solid.unfolded)).toBe(1);
}

test('fa-IR find the bases: a rectangle is the wrong base, one triangle is not both, then turn and tap the hidden one', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(sv(page).locator('.kg-sv-hint')).toContainText('بچرخان');
  // the picture has a text alternative: the solid's name and which faces are in view
  await expect(svg(page)).toHaveAttribute('aria-label', /منشور مثلثی/);
  const desc = sv(page).locator('.kg-sv-desc');
  await expect(desc).toContainText('از این طرف می‌بینی');
  await expect(desc).toContainText('مثلث ۲ (راست)');
  await expect(desc).not.toContainText('مثلث ۱');
  await expect(chip(page, 0)).toHaveText('مثلث ۱');
  await expect(chip(page, 2)).toHaveText(/مستطیل/);

  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز وجهی را انتخاب نکرده‌ای');
  // the rectangle it lies on
  await chip(page, 2).click();
  await expect(chip(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('یک مستطیل را انتخاب کرده‌ای');
  await chip(page, 2).click();
  // tap the triangle that can be seen, on the picture itself
  await tapFace(page, 1);
  await expect(chip(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('یک قاعده را پیدا کردی');
  // the other triangle is hidden: it can't be tapped until the solid is turned
  await expect(svg(page).locator('polygon[data-f="0"]')).toHaveCount(0);
  for (let k = 0; k < 3; k++) await sv(page).locator('[data-a="right"]').click();
  await expect(desc).toContainText('مثلث ۱');
  await tapFace(page, 0);
  await check(page, 'fa-IR');
  await expect(ok(page)).toContainText('دو مثلثِ دو سر');
  await expect(page.locator('.justify textarea')).toBeVisible();
});

test('fa-IR fill the ramp: not full, the lying rectangle as base, cm², then 36 cm³', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(sv(page).locator('.kg-sv-count')).toHaveText('۱ لایه');
  // lengths on the picture in Persian digits
  await expect(svg(page).locator('text.kg-sv-dim')).toHaveText(['۴', '۳', '۵', '۶']);
  await answer(page, '۳۶', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('هنوز پر نشده');
  for (let k = 0; k < 6; k++) await more(page).click(); // stops at full
  await expect(sv(page).locator('.kg-sv-count')).toHaveText('۶ لایه');
  await answer(page, '۷۲', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('قاعده گرفتی');
  await answer(page, '۶', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('فقط یک لایه');
  await answer(page, '۳۶', 'cm2');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('واحد مساحت است');
  await sv(page).locator('[data-u="cm3"]').click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR open the box: the three faces seen, cm³, then 94 cm² on the open net', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await answer(page, '۴۷', 'cm2');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سه وجهی را که می‌بینی');
  await answer(page, '۶۴', 'cm2');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('سقف و کف');
  await unfold(page);
  await expect(sv(page).locator('.kg-sv-desc')).toHaveText('گسترده باز است.');
  await expect(sv(page).locator('[data-a="open"]')).toHaveText('ببند');
  // six faces, each with its area
  await expect(svg(page).locator('polygon')).toHaveCount(6);
  await expect(svg(page).locator('text.kg-sv-area')).toHaveText(['۱۵', '۱۵', '۲۰', '۱۲', '۲۰', '۱۲']);
  await answer(page, '۹۴', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('واحد حجم است');
  await sv(page).locator('[data-u="cm2"]').click();
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('fa-IR the label on a can: πr²h is caught, then 314 cm² from the 2πr × h rectangle', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await unfold(page);
  await expect(svg(page).locator('text.kg-sv-dim')).toHaveText(['۲πr = ۳۱/۴', 'h = ۱۰']);
  await answer(page, '۷۸۵', 'cm2');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('این حجم قوطی است');
  await answer(page, '۶۲۸', 'cm2');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('قطر');
  await answer(page, '۳۱۴', 'cm2');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
  // fold it back up with the slider
  await sv(page).locator('.kg-sv-range').fill('0');
  await expect(sv(page).locator('.kg-sv-desc')).toContainText('سطح خمیده');
});

test('fa-IR how much the can holds: the label area is caught, then 785 cm³ (۷۸۵/۴ also accepted)', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  for (let k = 0; k < 9; k++) await more(page).click();
  await expect(sv(page).locator('.kg-sv-count')).toHaveText('۱۰ لایه');
  await answer(page, '۳۱۴', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('مساحت برچسب بود');
  await answer(page, '۷۸/۵', 'cm3');
  await check(page, 'fa-IR');
  await expect(no(page)).toContainText('فقط یک لایه است');
  await answer(page, '۷۸۵/۴', 'cm3');
  await check(page, 'fa-IR');
  await expect(ok(page)).toBeVisible();
});

test('en: wrong then right on every mission', async ({ page }) => {
  await open(page, 'en', 0);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await chip(page, 3).click();
  await check(page, 'en');
  await expect(no(page)).toContainText('You chose a rectangle');
  await chip(page, 3).click();
  await chip(page, 0).click();
  await chip(page, 1).click();
  await check(page, 'en');
  await expect(ok(page)).toContainText('two triangles');

  await open(page, 'en', 1);
  for (let k = 0; k < 5; k++) await more(page).click();
  await answer(page, '36', 'cm');
  await check(page, 'en');
  await expect(no(page)).toContainText('cm measures length');
  await answer(page, '84', 'cm3');
  await check(page, 'en');
  await expect(no(page)).toContainText('area of all the faces');
  await answer(page, '36', 'cm3');
  await check(page, 'en');
  await expect(ok(page)).toContainText('36 cm³');

  await open(page, 'en', 2);
  await unfold(page);
  await expect(svg(page).locator('text.kg-sv-area')).toHaveText(['15', '15', '20', '12', '20', '12']);
  await answer(page, '60', 'cm2');
  await check(page, 'en');
  await expect(no(page)).toContainText('volume of the box');
  await answer(page, '94', 'cm2');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await open(page, 'en', 3);
  await answer(page, '300', 'cm2');
  await check(page, 'en');
  await expect(no(page)).toContainText('You took π as 3');
  await answer(page, '471', 'cm2');
  await check(page, 'en');
  await expect(no(page)).toContainText('lids');
  await answer(page, '314.16', 'cm2');
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();

  await open(page, 'en', 4);
  await answer(page, '785', 'cm3');
  await check(page, 'en');
  await expect(no(page)).toContainText("isn't full yet");
  for (let k = 0; k < 9; k++) await more(page).click();
  await answer(page, '785', 'cm2');
  await check(page, 'en');
  await expect(no(page)).toContainText('not cm²');
  await sv(page).locator('[data-u="cm3"]').click();
  await check(page, 'en');
  await expect(ok(page)).toBeVisible();
});

test('keyboard: arrow keys turn the solid, Tab reaches the faces, layers, number and unit', async ({ page }) => {
  await open(page, 'en', 0);
  const desc = sv(page).locator('.kg-sv-desc');
  await expect(desc).not.toContainText('Triangle 1');
  await svg(page).focus();
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await expect(desc).toContainText('Triangle 1');
  const tilt = () => sv(page).evaluate((e) => (e as HTMLElement & { state: { solid: { turned: number[] } } }).state.solid.turned[1]);
  const t0 = await tilt();
  await page.keyboard.press('ArrowDown');
  expect(await tilt()).toBe(t0 + 15);
  // Tab: turn buttons (4), hidden edges, then the face list
  for (let k = 0; k < 6; k++) await page.keyboard.press('Tab');
  await expect(chip(page, 0)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(chip(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(ok(page)).toBeVisible();

  await open(page, 'en', 1);
  await more(page).focus();
  for (let k = 0; k < 5; k++) await page.keyboard.press('Enter');
  await expect(sv(page).locator('.kg-sv-count')).toHaveText('6 layers');
  await page.keyboard.press('Tab');
  await expect(sv(page).locator('.kg-sv-num')).toBeFocused();
  await page.keyboard.type('36');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(sv(page).locator('[data-u="cm3"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(ok(page)).toBeVisible();

  // the hidden-edges toggle
  await open(page, 'en', 2);
  await expect(svg(page).locator('line.dash')).toHaveCount(0);
  await sv(page).locator('[data-a="hidden"]').press('Enter');
  await expect(sv(page).locator('[data-a="hidden"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(svg(page).locator('line.dash')).toHaveCount(3);
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('drag turns the solid and a tap picks a face', async ({ page }) => {
    await open(page, 'fa-IR', 0);
    await svg(page).scrollIntoViewIfNeeded();
    const box = (await svg(page).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const turned = () => sv(page).evaluate((e) => (e as HTMLElement & { state: { solid: { turned: number[]; turns: number } } }).state.solid);
    const before = (await turned()).turned[0];
    // a finger drag to the right, as pointer events of type touch
    await svg(page).dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
    for (let k = 1; k <= 6; k++) await svg(page).dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: x + k * 20, clientY: y, isPrimary: true });
    await svg(page).dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x + 120, clientY: y, isPrimary: true });
    const after = await turned();
    expect(after.turned[0]).toBeGreaterThan(before + 50);
    expect(after.turns).toBe(1);
    await expect(sv(page).locator('.kg-sv-desc')).toContainText('مثلث ۱');
    // a tap (no movement) on a face picks it
    await tapFace(page, 0, true);
    await expect(chip(page, 0)).toHaveAttribute('aria-pressed', 'true');
  });
});

test('no horizontal scroll at 390px and 44px targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    for (let i = 0; i < MISSIONS; i++) {
      await open(page, loc, i);
      if (i === 2 || i === 3) await unfold(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${i + 1}`).toBeLessThanOrEqual(0);
      for (const b of await sv(page).locator('button, input').all()) {
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height), `${loc} mission ${i + 1} target`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
