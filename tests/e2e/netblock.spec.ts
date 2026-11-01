import { expect, openFixture, test } from './fixtures';


test('all three rulesets are enabled', async ({ serviceWorker }) => {
  const enabled = await serviceWorker.evaluate(() => (globalThis as any).chrome.declarativeNetRequest.getEnabledRulesets());
  expect(enabled.sort()).toEqual(['easylist', 'easyprivacy', 'popunder']);
});

test('list rules match known ad and tracker requests', async ({ serviceWorker }) => {
  const matches = await serviceWorker.evaluate(async () => {
    const dnr = (globalThis as any).chrome.declarativeNetRequest;
    const check = async (url: string, type: string) =>
      (await dnr.testMatchOutcome({ url, type, initiator: 'https://news.example', tabId: -1 })).matchedRules.length;
    return {
      popads: await check('https://popads.net/pop.js', 'script'),
      adsense: await check('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', 'script'),
      analytics: await check('https://www.google-analytics.com/analytics.js', 'script'),
      harmless: await check('https://news.example/app.js', 'script'),
    };
  });
  expect(matches).toEqual({ popads: expect.any(Number), adsense: expect.any(Number), analytics: expect.any(Number), harmless: 0 });
  expect(matches.popads && matches.adsense && matches.analytics).toBeGreaterThan(0);
});

test('blocked requests do not load, and a disabled site lets them through', async ({ context, serviceWorker }) => {
  // Session rules survive the dynamic-rule rewrite done when a site is disabled.
  await serviceWorker.evaluate(() => (globalThis as any).chrome.declarativeNetRequest.updateSessionRules({
    addRules: [{ id: 1, priority: 1, action: { type: 'block' }, condition: { urlFilter: '|http://127.0.0.1:4173/ads/' } }],
  }));
  const page = await openFixture(context, 'ads-network.html');
  expect(await page.evaluate(() => (window as any).loadAds())).toEqual({ script: 'blocked', image: 'blocked' });

  await serviceWorker.evaluate(() => (globalThis as any).chrome.storage.local.set({ disabledSites: ['localhost'] }));
  await expect
    .poll(() => serviceWorker.evaluate(async () => (await (globalThis as any).chrome.declarativeNetRequest.getDynamicRules()).length))
    .toBe(1);
  await page.reload();
  expect(await page.evaluate(() => (window as any).loadAds())).toEqual({ script: 'loaded', image: 'loaded' });
});

test('cosmetic filters hide ad slots', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'ads-cosmetic.html');
  await expect(page.locator('#top_ad')).toBeHidden();
  await expect(page.locator('#content')).toBeVisible();
});

