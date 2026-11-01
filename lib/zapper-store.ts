// Elements the user removed with the Zappeur, stored per site.
import { siteKey } from './settings';

export const ZAPPER_KEY = 'zapperRules';

export type ZapperRules = Record<string, string[]>;

export async function getZapperRules(): Promise<ZapperRules> {
  return ((await browser.storage.local.get(ZAPPER_KEY))[ZAPPER_KEY] as ZapperRules | undefined) ?? {};
}

export async function addZapperRule(url: string, selector: string): Promise<void> {
  const site = siteKey(url);
  if (!site) return;
  const rules = await getZapperRules();
  rules[site] = [...new Set([...(rules[site] ?? []), selector])];
  await browser.storage.local.set({ [ZAPPER_KEY]: rules });
}

export async function removeZapperRule(site: string, selector: string): Promise<void> {
  const rules = await getZapperRules();
  rules[site] = (rules[site] ?? []).filter((s) => s !== selector);
  if (!rules[site].length) delete rules[site];
  await browser.storage.local.set({ [ZAPPER_KEY]: rules });
}

export function zapperSelectorsFor(rules: ZapperRules, url: string): string[] {
  const host = siteKey(url);
  if (!host) return [];
  return Object.entries(rules)
    .filter(([site]) => host === site || host.endsWith(`.${site}`))
    .flatMap(([, selectors]) => selectors);
}
