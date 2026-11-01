import { expect, openFixture, test, watchNewPages } from './fixtures';

for (const path of ['popunder-window-open.html', 'popunder-anchor.html', 'popunder-anchor.html?detached', 'popunder-form.html', 'popunder-bypass.html']) {
  test(`no ad tab opens on ${path}`, async ({ context, serviceWorker }) => {
    const page = await openFixture(context, path);
    const opened = watchNewPages(context);
    await page.click('#play');
    await page.waitForTimeout(1000);
    expect(opened.map((p) => p.url())).toEqual([]);
  });
}

test('the click still reaches the site', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'popunder-window-open.html');
  await page.click('#play');
  await expect(page.locator('#play')).toHaveText('played');
});

test('real links and buttons still open their tab', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'legit-link.html');
  for (const [selector, marker] of [['#link', 'legit=link'], ['#share', 'legit=share']] as const) {
    const next = context.waitForEvent('page');
    await page.click(selector);
    const tab = await next;
    await tab.waitForLoadState();
    expect(tab.url()).toContain(marker);
    // The service worker safety net must not close it either.
    await page.waitForTimeout(600);
    expect(tab.isClosed()).toBe(false);
  }
});

test('the service worker closes a popunder that got past the page guard', async ({ context, serviceWorker }) => {
  // Simulate a guard bypass by removing the guard entirely.
  await serviceWorker.evaluate(() => (globalThis as any).chrome.scripting.unregisterContentScripts());
  const page = await openFixture(context, 'popunder-window-open.html');
  const opened = watchNewPages(context);
  await page.click('#play');
  await page.waitForTimeout(1500);
  expect(opened.length, 'the fixture must really get past the page guard').toBeGreaterThan(0);
  const stillOpen = opened.filter((p) => !p.isClosed()).map((p) => p.url());
  expect(stillOpen).toEqual([]);
});
