import { expect, test, type Page } from '@playwright/test';

const ID = 'num-negative';
async function tapTick(page: Page, i: number) {
  await page.locator('kg-number-line svg').scrollIntoViewIfNeeded();
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const tickX = async (page: Page, i: number) => {
  const b = (await page.locator(`kg-number-line [data-tick="${i}"]`).boundingBox())!;
  return b.x + b.width / 2;
};
const check = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const mission = (page: Page, n: number) => page.locator('.mission-tab').nth(n).click();

test('fa-IR: negatives are left of zero, minus on the left; 4 below zero', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await tickX(page, -5)).toBeLessThan(await tickX(page, 0));
  expect(await tickX(page, 0)).toBeLessThan(await tickX(page, 5));
  await expect(page.locator('kg-number-line .kg-nl-lab').first()).toHaveText('−۱۰');
  await tapTick(page, 4);
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('سمت چپ صفر');
  await tapTick(page, -4);
  await expect(page.locator('kg-number-line .kg-nl-pt')).toHaveAttribute('aria-valuetext', '−۴');
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
  // the minus sign of the rendered {{num:-4}} sits on the left of its digit inside the RTL sentence
  const bdi = page.locator('.feedback.ok bdi').first();
  await expect(bdi).toHaveAttribute('dir', 'ltr');
});

test('fa-IR: −8 is less than −3', async ({ page }) => {
  await page.goto(`/fa-IR/studio/${ID}/`);
  await mission(page, 1);
  await expect(page.locator('kg-number-line .kg-nl-fixed')).toHaveCount(2);
  await page.locator('.choice').nth(1).click();
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.no')).toContainText('سمت چپ');
  await page.locator('.choice').nth(0).click();
  await check(page, 'بررسی کن');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: 3 − 7 crosses zero (4 is caught)', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 3);
  await tapTick(page, 4);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('Keep going past zero');
  await tapTick(page, -4);
  await expect(page.locator('kg-number-line .kg-nl-hop')).toHaveText('−7');
  await expect(page.locator('kg-number-line .kg-nl-val')).toHaveText('−4');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('en: −3 + 5 hops right', async ({ page }) => {
  await page.goto(`/en/studio/${ID}/`);
  await mission(page, 2);
  await tapTick(page, -8);
  await check(page, 'Check');
  await expect(page.locator('.feedback.no')).toContainText('jumping right');
  await tapTick(page, 2);
  await expect(page.locator('kg-number-line .kg-nl-hop')).toHaveText('+5');
  await check(page, 'Check');
  await expect(page.locator('.feedback.ok')).toBeVisible();
});

test('no horizontal scroll at phone width, on every mission', async ({ page }) => {
  for (const loc of ['fa-IR', 'en']) {
    await page.goto(`/${loc}/studio/${ID}/`);
    for (let m = 0; m < 4; m++) {
      await mission(page, m);
      await expect(page.locator('kg-number-line svg')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${loc} mission ${m + 1}`).toBeLessThanOrEqual(0);
    }
  }
});
