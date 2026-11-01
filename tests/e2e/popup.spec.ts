import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, openFixture, test } from './fixtures';

async function openPopupFor(context: BrowserContext, serviceWorker: Worker, extensionId: string, site: Page) {
  const tabId = await serviceWorker.evaluate(
    async (url) => (await (globalThis as any).chrome.tabs.query({ url }))[0].id,
    site.url(),
  );
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 480 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
  return popup;
}

test('popup shows counters, toggles the site and manages zapped elements', async ({ context, serviceWorker, extensionId }) => {
  await serviceWorker.evaluate(() => (globalThis as any).chrome.storage.local.set({ zapperRules: { localhost: ['#zap-me'] } }));
  const site = await openFixture(context, 'popunder-window-open.html');
  await site.click('#play');
  await site.waitForTimeout(500);

  const popup = await openPopupFor(context, serviceWorker, extensionId, site);
  await expect(popup.locator('#site-host')).toHaveText('localhost');
  await expect(popup.locator('#site-state')).toHaveText('Activée');
  await expect(popup.locator('#stat-traps')).not.toHaveText('0');
  await expect(popup.locator('#rules li')).toHaveCount(1);

  for (const scheme of ['light', 'dark'] as const) {
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.screenshot({ path: `design/screens/popup-fr-${scheme}.png` });
  }

  await popup.locator('.switch').click();
  await expect(popup.locator('#site-state')).toHaveText('Désactivée');
  await expect(popup.locator('#reload-hint')).toBeVisible();
  expect(await serviceWorker.evaluate(async () =>
    (await (globalThis as any).chrome.storage.local.get('disabledSites')).disabledSites)).toEqual(['localhost']);

  await popup.getByRole('button', { name: /Supprimer #zap-me/ }).click();
  await expect(popup.locator('#rules li')).toHaveCount(0);
  await expect(popup.locator('#rules-empty')).toBeVisible();
});

test('popup explains when a page is out of reach', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#not-applicable')).toBeVisible();
  await expect(popup.locator('#controls')).toBeHidden();
});

test.describe('in English', () => {
  test.use({ lang: 'en' });

  test('popup speaks English', async ({ context, serviceWorker, extensionId }) => {
    const site = await openFixture(context, 'blank.html');
    const popup = await openPopupFor(context, serviceWorker, extensionId, site);
    await expect(popup.locator('#site-state')).toHaveText('On');
    await expect(popup.locator('#zap')).toHaveText('Zap an element');
    for (const scheme of ['light', 'dark'] as const) {
      await popup.emulateMedia({ colorScheme: scheme });
      await popup.screenshot({ path: `design/screens/popup-en-${scheme}.png` });
    }
  });
});
