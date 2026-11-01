import type { Page } from '@playwright/test';
import { expect, openFixture, test, watchNewPages } from './fixtures';

// Clicks where a user would, without Playwright's actionability checks, so an overlay really gets in the way.
async function userClick(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} not visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('a transparent full-page link no longer catches the click', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'click-overlay.html');
  await page.waitForLoadState('load');
  const opened = watchNewPages(context);
  await userClick(page, '#play');
  await expect(page.locator('#play')).toHaveText('played');
  expect(opened).toHaveLength(0);
});

test('a real modal with a dimmed backdrop is left alone', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'legit-modal.html');
  await page.waitForLoadState('load');
  await userClick(page, '#accept');
  await expect(page.locator('#accept')).toHaveText('accepted');
  expect(await page.locator('#backdrop').getAttribute('data-popperz-neutralised')).toBeNull();
});

test('a layer re-injected every second stays neutralised', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'overlay-reinject.html');
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(1100);
    await userClick(page, '#play');
    await expect(page.locator('#play')).toHaveText(`played ${i}`);
  }
  expect(await page.title()).not.toBe('trapped');
});

test('a 5000-node insertion is handled within two frames', async ({ context, serviceWorker }) => {
  const page = await openFixture(context, 'heavy-dom.html');
  const elapsed = await page.evaluate(async () => {
    (window as any).addNodes();
    document.body.offsetHeight; // force layout so only the frames and the scan are timed
    const start = performance.now();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - start;
  });
  expect(elapsed).toBeLessThan(100);
});
