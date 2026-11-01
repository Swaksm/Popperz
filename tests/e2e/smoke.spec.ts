import { expect, test } from './fixtures';

test('service worker starts and popup renders', async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('h1')).toHaveText('Popperz');
});
