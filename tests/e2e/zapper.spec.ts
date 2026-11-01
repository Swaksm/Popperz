import type { Page, Worker } from '@playwright/test';
import { expect, openFixture, test } from './fixtures';

async function startZapper(serviceWorker: Worker, page: Page) {
  await serviceWorker.evaluate(async (url) => {
    const api = (globalThis as any).chrome;
    const [tab] = await api.tabs.query({ url });
    await api.tabs.sendMessage(tab.id, { type: 'zap-start' });
  }, page.url());
}

test('a zapped element stays hidden after reload, and comes back once its rule is removed', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'ads-cosmetic.html');
  await startZapper(serviceWorker, page);
  const box = (await page.locator('#zap-me').boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(page.locator('#zap-me')).toBeHidden();

  const rules = await serviceWorker.evaluate(async () =>
    (await (globalThis as any).chrome.storage.local.get('zapperRules')).zapperRules);
  expect(rules).toEqual({ localhost: ['#zap-me'] });

  await page.reload();
  await expect(page.locator('#zap-me')).toBeHidden();
  await expect(page.locator('#content')).toBeVisible();

  await serviceWorker.evaluate(() => (globalThis as any).chrome.storage.local.set({ zapperRules: {} }));
  await page.reload();
  await expect(page.locator('#zap-me')).toBeVisible();
});

test('Escape leaves the Zappeur without removing anything', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'ads-cosmetic.html');
  await startZapper(serviceWorker, page);
  await page.keyboard.press('Escape');
  const box = (await page.locator('#zap-me').boundingBox())!;
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(page.locator('#zap-me')).toBeVisible();
});

test('a disabled site gets no cosmetic hiding', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => (globalThis as any).chrome.storage.local.set({ disabledSites: ['localhost'] }));
  await expect
    .poll(() => serviceWorker.evaluate(async () =>
      (await (globalThis as any).chrome.scripting.getRegisteredContentScripts()).every((s: any) => s.excludeMatches?.length)))
    .toBe(true);
  const page = await openFixture(context, 'ads-cosmetic.html');
  await page.waitForTimeout(500);
  await expect(page.locator('#top_ad')).toBeVisible();
});
