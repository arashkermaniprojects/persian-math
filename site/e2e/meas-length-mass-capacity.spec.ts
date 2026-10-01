import { expect, test, type Page } from '@playwright/test';

const URL = (loc: string) => `/${loc}/studio/meas-length-mass-capacity/`;
const engine = (page: Page) => page.locator('kg-measure');
const answer = (page: Page) => page.locator('.int-input');

async function open(page: Page, loc: string, m: number) {
  await page.goto(URL(loc));
  await page.locator('.mission-tab').nth(m).click();
  await expect(engine(page).locator('.kg-ms-svg')).toBeVisible();
}
async function check(page: Page, loc: string) {
  await page.getByRole('button', { name: loc === 'en' ? 'Check' : 'بررسی کن' }).click();
}

test('fa-IR ruler: reading the end without starting from 0 is caught; drag the ruler to 0 and read 7', async ({ page }) => {
  await open(page, 'fa-IR', 0);
  const ruler = page.getByRole('slider', { name: /خط‌کش/ });
  await expect(ruler).toHaveAttribute('aria-valuenow', '-2');
  await answer(page).fill('۵');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('مداد از صفر شروع نشده است');
  // The right number with the ruler still in the wrong place: line it up first.
  await answer(page).fill('۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('صفرِ خط‌کش هنوز زیر سرِ مداد نیست');
  // Drag the ruler 2 cm to the left (the distance between two number labels is 1 cm).
  const labs = engine(page).locator('.kg-ms-lab');
  const a = (await labs.nth(0).boundingBox())!, b = (await labs.nth(1).boundingBox())!;
  const cm = b.x - a.x;
  const box = (await ruler.boundingBox())!;
  const y = box.y + box.height / 2, x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - cm, y, { steps: 4 });
  await page.mouse.move(x - 2 * cm, y, { steps: 4 });
  await page.mouse.up();
  await expect(ruler).toHaveAttribute('aria-valuenow', '0');
  await expect(ruler).toHaveAttribute('aria-valuetext', 'سر روی ۰، ته روی ۷');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en ruler: move the ruler with the arrow keys', async ({ page }) => {
  await open(page, 'en', 0);
  const ruler = page.getByRole('slider', { name: /Ruler/ });
  await ruler.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(ruler).toHaveAttribute('aria-valuetext', 'start at −1, end at 6');
  await answer(page).fill('6');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('does not start at 0');
  await ruler.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(ruler).toHaveAttribute('aria-valuenow', '0');
  await answer(page).fill('7');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR balance: too many weights tip the balance; 500 g + 100 g balance the apples', async ({ page }) => {
  await open(page, 'fa-IR', 1);
  await expect(page.locator('kg-measure .kg-ms-svg')).toHaveAttribute('aria-label', /کفهٔ سیب‌ها پایین/);
  await page.getByRole('button', { name: '۵۰۰ گرم' }).click();
  await page.getByRole('button', { name: '۲۰۰ گرم' }).click();
  await expect(page.locator('kg-measure .kg-ms-svg')).toHaveAttribute('aria-label', /کفهٔ وزنه‌ها پایین/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('یکی را بردار');
  await page.getByRole('button', { name: '۲۰۰ گرم' }).click();
  await expect(page.getByRole('button', { name: '۲۰۰ گرم' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '۱۰۰ گرم' }).first().click();
  await expect(page.locator('kg-measure .kg-ms-svg')).toHaveAttribute('aria-label', /ترازو صاف است/);
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en balance: too light first, then level', async ({ page }) => {
  await open(page, 'en', 1);
  await page.getByRole('button', { name: '500 g' }).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('Add another weight');
  await page.getByRole('button', { name: '100 g' }).nth(1).click();
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR jug: pour to 600 (too little), then to the unlabelled 700 mark', async ({ page }) => {
  await open(page, 'fa-IR', 2);
  const more = page.getByRole('button', { name: 'آب بیشتر بریز' });
  for (let i = 0; i < 6; i++) await more.click();
  const level = page.getByRole('slider', { name: 'پیمانهٔ مدرج' });
  await expect(level).toHaveAttribute('aria-valuetext', '۶۰۰ میلی‌لیتر');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('آب کم است');
  await level.focus();
  await page.keyboard.press('ArrowUp');
  await expect(level).toHaveAttribute('aria-valuenow', '700');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en jug: tap the jug to set the level, too much first', async ({ page }) => {
  await open(page, 'en', 2);
  await engine(page).locator('.kg-ms-svg').scrollIntoViewIfNeeded();
  const svg = (await engine(page).locator('.kg-ms-svg').boundingBox())!;
  // Tap near the top of the jug: about 1000 ml.
  await page.mouse.click(svg.x + svg.width / 2, svg.y + 50);
  const level = page.getByRole('slider', { name: 'Measuring jug' });
  await expect(level).toHaveAttribute('aria-valuenow', /^(900|1000)$/);
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('too much water');
  await page.getByRole('button', { name: 'Pour some water out' }).click();
  if ((await level.getAttribute('aria-valuenow')) === '900') await page.getByRole('button', { name: 'Pour some water out' }).click();
  await page.getByRole('button', { name: 'Pour some water out' }).click();
  await expect(level).toHaveAttribute('aria-valuenow', '700');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR dial scale: a mark is 50 g, not 10 g', async ({ page }) => {
  await open(page, 'fa-IR', 3);
  await expect(engine(page).locator('.kg-ms-lab')).toHaveCount(11);
  await answer(page).fill('۶۱۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('هر خط کوچک ۱ یا ۱۰ گرم نیست');
  await answer(page).fill('۶۵۰');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en dial scale: rounding to a number is caught', async ({ page }) => {
  await open(page, 'en', 3);
  await answer(page).fill('600');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('not exactly on a number');
  await answer(page).fill('650');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('fa-IR leaf in mm: writing centimetres is caught, 64 mm is right', async ({ page }) => {
  await open(page, 'fa-IR', 4);
  await answer(page).fill('۶');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.no')).toContainText('ما میلی‌متر خواستیم');
  await answer(page).fill('۶۴');
  await check(page, 'fa-IR');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en leaf in mm: the nearest cm is not accurate enough', async ({ page }) => {
  await open(page, 'en', 4);
  await answer(page).fill('60');
  await check(page, 'en');
  await expect(page.locator('.feedback.no')).toContainText('nearest centimetre');
  await answer(page).fill('64');
  await check(page, 'en');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(URL(loc));
    for (let m = 0; m < 5; m++) {
      await page.locator('.mission-tab').nth(m).click();
      await expect(engine(page).locator('.kg-ms-svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
