import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/vec-directed-segments/`;
const CHECK = { 'fa-IR': 'بررسی کن', en: 'Check' } as const;
const CLEAR = { 'fa-IR': 'پاک کردن بردار', en: 'Clear vector' } as const;
const MISSIONS = 5;

async function open(page: Page, loc: keyof typeof CHECK, i: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(i).click();
  await expect(page.locator('kg-coord-plane svg.kg-cp-svg')).toBeVisible();
  await page.locator('kg-coord-plane').evaluate((e) => (e as HTMLElement & { ready: Promise<void> }).ready);
}
const check = (page: Page, loc: keyof typeof CHECK) => page.getByRole('button', { name: CHECK[loc], exact: true }).click();
const ok = (page: Page) => expect(page.locator('.feedback.ok')).toBeVisible();
const no = (page: Page, text: string) => expect(page.locator('.feedback.no')).toContainText(text);
const plane = (page: Page) => page.locator('kg-coord-plane');
type Plane = { vectors?: { from: number[]; to: number[] }[]; picked?: number[]; shift?: number[] | null };
const state = (page: Page) => plane(page).evaluate((e) => (e as HTMLElement & { state: { plane: Plane } }).state.plane);

/** Page position of plane point (x, y), from the engine's own mapping (x right, y up, in every locale). */
async function at(page: Page, x: number, y: number) {
  const svg = page.locator('kg-coord-plane svg.kg-cp-svg');
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const [px, py, w, h] = await svg.evaluate((s: SVGSVGElement, [x, y]) => {
    const el = s.closest('kg-coord-plane') as HTMLElement & { sx(v: number): number; sy(v: number): number };
    return [el.sx(x), el.sy(y), s.viewBox.baseVal.width, s.viewBox.baseVal.height];
  }, [x, y]);
  return [box.x + (px * box.width) / w, box.y + (py * box.height) / h];
}
async function tapAt(page: Page, x: number, y: number) {
  const [px, py] = await at(page, x, y);
  await page.mouse.click(px, py);
}
/** Drag with the mouse from one plane point to another, in small steps like a finger. */
async function dragFrom(page: Page, from: [number, number], to: [number, number]) {
  const [ax, ay] = await at(page, ...from), [bx, by] = await at(page, ...to);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 8 });
  await page.mouse.up();
}
async function press(page: Page, keys: string[]) {
  for (const k of keys) await page.keyboard.press(k);
}
const readout = (page: Page) => page.locator('kg-coord-plane .kg-cp-facts .vec > span');

test('fa-IR directed segment: B → A is caught as BA, then A → B reads as the column [5, 3]', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  await expect(page.locator('kg-coord-plane .kg-cp-lt')).toHaveText(['A', 'B']);
  await dragFrom(page, [2, 1], [-3, -2]);
  expect((await state(page)).vectors).toEqual([{ from: [2, 1], to: [-3, -2] }]);
  await expect(readout(page)).toHaveText(['−۵', '−۳']);
  await check(page, 'fa-IR');
  await no(page, 'این بردار BA است');
  await page.getByRole('button', { name: CLEAR['fa-IR'], exact: true }).click();
  expect((await state(page)).vectors).toEqual([]);
  await dragFrom(page, [-3, -2], [2, 1]);
  // a column in square brackets, x on top, in Persian digits; the components are drawn with their numbers
  await expect(readout(page)).toHaveText(['۵', '۳']);
  await expect(page.locator('kg-coord-plane .kg-cp-facts .vec')).not.toHaveClass(/round/);
  await expect(page.locator('kg-coord-plane text.kg-cp-runl')).toHaveText('۵');
  await expect(page.locator('kg-coord-plane text.kg-cp-risel')).toHaveText('۳');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR equal vectors: the opposite and a missed one are caught; position does not matter', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  const band = (i: number) => page.locator(`kg-coord-plane [data-vc="${i}"]`);
  await check(page, 'fa-IR');
  await no(page, 'هنوز روی هیچ برداری نزده‌ای');
  await tapAt(page, 2.5, 4.5); // b, equal
  await tapAt(page, 2.5, 1.5); // c, the opposite
  await expect(band(1)).toHaveAttribute('aria-pressed', 'true');
  await check(page, 'fa-IR');
  await no(page, 'قرینهٔ a است، نه مساوی آن');
  await tapAt(page, 2.5, 1.5);
  await check(page, 'fa-IR');
  await no(page, 'یک بردار مساوی دیگر هم هست');
  // the keyboard picks too: Enter on a focused arrow
  await band(2).focus();
  await page.keyboard.press('Enter');
  await expect(band(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(band(2)).toBeFocused();
  expect((await state(page)).picked).toEqual([0, 2]);
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR opposite vector: a drawn again is caught, then the head moved with the keyboard', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await check(page, 'fa-IR');
  await no(page, 'از نقطهٔ A یک بردار رسم کن');
  await dragFrom(page, [3, -2], [5, -5]);
  await check(page, 'fa-IR');
  await no(page, 'بردار تو با a مساوی است، نه قرینهٔ آن');
  // the learner's arrow is item 1 (a is item 0); Right/Up mean bigger x and y even on an RTL page
  const head = page.locator('kg-coord-plane [data-vh="1"]');
  await head.focus();
  await press(page, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp']);
  await expect(head).toBeFocused();
  await expect(head).toHaveAttribute('aria-label', 'انتهای b (۱, ۱)');
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR wrong tail: the right vector away from A is caught; sliding the whole arrow fixes it', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  await dragFrom(page, [2, -3], [0, 0]);
  await check(page, 'fa-IR');
  await no(page, 'از A شروع نشده');
  const band = page.locator('kg-coord-plane [data-vm="1"]');
  await band.focus();
  await press(page, ['ArrowRight', 'ArrowUp']);
  expect((await state(page)).vectors).toEqual([{ from: [3, -2], to: [1, 1] }]);
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR translate: components swapped is caught, then the image dragged by [3, −4]', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await check(page, 'fa-IR');
  await no(page, 'هنوز روی مثلث ABC است');
  // grab inside the image, off the half-squares (a snapped drag moves it by whole squares)
  await dragFrom(page, [-0.7, -0.6], [-5, 2]);
  expect((await state(page)).shift).toEqual([-4, 3]);
  await check(page, 'fa-IR');
  await no(page, 'عددها را جابه‌جا کردی');
  await dragFrom(page, [-4.6, 2.6], [2, -4]);
  expect((await state(page)).shift).toEqual([3, -4]);
  // every corner is joined to its image by an equal dashed arrow; the image's corners are A′ B′ C′
  await expect(page.locator('kg-coord-plane .kg-cp-vec.trail')).toHaveCount(3);
  await expect(page.locator('kg-coord-plane .kg-cp-lt')).toHaveText(['A', 'B', 'C', 'A′', 'B′', 'C′']);
  // the image moves with the keyboard too
  const img = page.locator('kg-coord-plane [data-vs]');
  await img.focus();
  await press(page, ['ArrowLeft', 'ArrowRight']);
  await expect(img).toBeFocused();
  await check(page, 'fa-IR');
  await ok(page);
});

test('fa-IR describe a translation: A′ → A is caught, then A → A′ drawn with the keyboard', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  // tap the tail, then the head
  await tapAt(page, -3, -2);
  await tapAt(page, 2, -4);
  expect((await state(page)).vectors).toEqual([{ from: [-3, -2], to: [2, -4] }]);
  await check(page, 'fa-IR');
  await no(page, 'این انتقال برعکس است');
  await page.getByRole('button', { name: CLEAR['fa-IR'], exact: true }).click();
  // the plane cursor starts at the origin: Enter at A sets the tail, Enter at A′ the head
  await page.locator('kg-coord-plane svg.kg-cp-svg').focus();
  await press(page, ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']);
  await expect(page.locator('kg-coord-plane .kg-cp-pend')).toHaveCount(1);
  await press(page, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'Enter']);
  expect((await state(page)).vectors).toEqual([{ from: [2, -4], to: [-3, -2] }]);
  await expect(readout(page)).toHaveText(['−۵', '۲']);
  await expect(page.locator('.prompt bdi.alg').first()).toHaveText('A′B′C′');
  await check(page, 'fa-IR');
  await ok(page);
});

test('en: UK column vectors in round brackets; right and wrong attempts', async ({ page }) => {
  await open(page, 'en', 0);
  await expect(page.locator('.guide .vec.round, .prompt .vec.round').first()).toBeAttached();
  await dragFrom(page, [-3, -2], [2, 0]);
  await check(page, 'en');
  await no(page, 'One of the two numbers is right');
  await page.getByRole('button', { name: CLEAR.en, exact: true }).click();
  await dragFrom(page, [-3, -2], [2, 1]);
  await expect(page.locator('kg-coord-plane .kg-cp-facts .vec.round > span')).toHaveText(['5', '3']);
  await check(page, 'en');
  await ok(page);

  await page.locator('.mission-tab').nth(1).click();
  await tapAt(page, -2, -3); // f, twice as long
  await check(page, 'en');
  await no(page, 'is longer');
  await tapAt(page, -2, -3);
  await tapAt(page, 2.5, 4.5);
  await tapAt(page, -3.5, -1.5);
  await check(page, 'en');
  await ok(page);

  await page.locator('.mission-tab').nth(3).click();
  await page.locator('kg-coord-plane').evaluate((e) => (e as HTMLElement & { ready: Promise<void> }).ready);
  await dragFrom(page, [-0.7, -0.6], [2, 3]);
  await check(page, 'en');
  await no(page, 'One direction is the wrong way round');
});

test('the vectors module loads only where a mission asks for it', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (r) => asked.push(r.url()));
  await page.goto('/fa-IR/studio/coord-gradient-lines/');
  for (let m = 0; m < 5; m++) await page.locator('.mission-tab').nth(m).click();
  await expect(page.locator('kg-coord-plane svg.kg-cp-svg')).toBeVisible();
  expect(asked.filter((u) => /\/vectors\.[\w-]+\.js/.test(u))).toEqual([]);
  await page.goto(URL('fa-IR'));
  await page.locator('kg-coord-plane').evaluate((e) => (e as HTMLElement & { ready: Promise<void> }).ready);
  expect(asked.filter((u) => /\/vectors\.[\w-]+\.js/.test(u)).length).toBe(1);
});

test('no horizontal scroll at 390px and 44px touch targets, every mission, fa-IR and en', async ({ page }) => {
  for (const loc of ['fa-IR', 'en'] as const) {
    await page.goto(URL(loc));
    await expect(page.locator('.mission-tab')).toHaveCount(MISSIONS);
    for (let m = 0; m < MISSIONS; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(page.locator('kg-coord-plane .kg-cp-hint')).toBeVisible();
      await page.locator('kg-coord-plane').evaluate((e) => (e as HTMLElement & { ready: Promise<void> }).ready);
      if (m === 0 || m === 2 || m === 4) await dragFrom(page, [-1, -3], [1, -3]); // a short arrow: its ends and band
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
      const sizes = await page.evaluate(() => [...document.querySelectorAll('kg-coord-plane :is(button, [data-vh], [data-vt], [data-vm], [data-vc], [data-vs])')]
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => Math.min(r.width, r.height)));
      expect(sizes.length, `${loc} mission ${m + 1} has targets`).toBeGreaterThan(0);
      for (const s of sizes) expect(s, `${loc} mission ${m + 1} target`).toBeGreaterThanOrEqual(44);
    }
  }
});
