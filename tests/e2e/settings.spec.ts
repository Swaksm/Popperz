import { expect, openFixture, test, watchNewPages } from './fixtures';

test('a disabled site gets no protection, and counters track blocks elsewhere', async ({ context, serviceWorker }) => {
  // Counter on a protected page.
  const page = await openFixture(context, 'popunder-window-open.html');
  await page.click('#play');
  await expect
    .poll(() => serviceWorker.evaluate(async () => {
      const all = await (globalThis as any).chrome.storage.session.get(null);
      return Object.values(all).reduce((n: number, s: any) => n + (s?.blocked ?? 0), 0);
    }))
    .toBeGreaterThan(0);

  // Disable localhost, wait for the guard to be re-registered, reload: the ad now opens.
  await serviceWorker.evaluate(() => (globalThis as any).chrome.storage.local.set({ disabledSites: ['localhost'] }));
  await expect
    .poll(() => serviceWorker.evaluate(async () =>
      (await (globalThis as any).chrome.scripting.getRegisteredContentScripts())[0].excludeMatches?.length ?? 0))
    .toBeGreaterThan(0);
  await page.reload();
  const opened = watchNewPages(context);
  await page.click('#play');
  await expect.poll(() => opened.map((p) => p.url()).join()).toContain('ad=window-open');
});
