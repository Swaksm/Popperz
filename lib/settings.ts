// Per-site on/off switch. A site is stored by host without "www.", and covers its subdomains.

export const DISABLED_SITES_KEY = 'disabledSites';

export function siteKey(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isDisabled(url: string, disabled: readonly string[]): boolean {
  const host = siteKey(url);
  return !!host && disabled.some((site) => host === site || host.endsWith(`.${site}`));
}

export function excludeMatchesFor(disabled: readonly string[]): string[] {
  return disabled.flatMap((site) => [`*://${site}/*`, `*://*.${site}/*`]);
}

export async function getDisabledSites(): Promise<string[]> {
  const stored = await browser.storage.local.get(DISABLED_SITES_KEY);
  return (stored[DISABLED_SITES_KEY] as string[] | undefined) ?? [];
}

export async function setSiteEnabled(url: string, enabled: boolean): Promise<void> {
  const site = siteKey(url);
  if (!site) return;
  const others = (await getDisabledSites()).filter((s) => s !== site);
  await browser.storage.local.set({ [DISABLED_SITES_KEY]: enabled ? others : [...others, site] });
}
