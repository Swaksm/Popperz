import { resolve } from 'node:path';
import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';

export const SITE = 'http://localhost:4173';
export const OTHER_SITE = 'http://127.0.0.1:4173';

// POPPERZ_EXTENSION lets the suite run against an unzipped release instead of the build folder.
const EXTENSION = resolve(process.env.POPPERZ_EXTENSION ?? '.output/chrome-mv3');

export const test = base.extend<{ lang: string; context: BrowserContext; serviceWorker: Worker; extensionId: string }>({
  lang: ['fr', { option: true }],
  context: async ({ lang }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      locale: lang,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, `--lang=${lang}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // The guard is registered at install time; pages opened before that would run unprotected.
    await expect
      .poll(() => worker.evaluate(async () => (await (globalThis as any).chrome.scripting.getRegisteredContentScripts()).length))
      .toBeGreaterThan(0);
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

// Collects every page opened after the call, to assert on what the site managed to open.
export function watchNewPages(context: BrowserContext): Page[] {
  const pages: Page[] = [];
  context.on('page', (p) => pages.push(p));
  return pages;
}

export async function openFixture(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${SITE}/${path}`);
  return page;
}
