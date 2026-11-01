// Renders the chosen SVG logo to the PNG sizes the manifest needs.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SOURCE = 'design/icons/8-logo-fendu.svg';
const SIZES = [16, 32, 48, 128];

const svg = readFileSync(SOURCE, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
}
await browser.close();
console.log(`icons: ${SIZES.join(', ')} px written to public/icon/`);
