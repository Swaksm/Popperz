import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { excludeMatchesFor, getDisabledSites, isDisabled, setSiteEnabled, siteKey } from '@/lib/settings';

describe('siteKey', () => {
  it('drops www. and ignores non-web pages', () => {
    expect(siteKey('https://www.site.test/a')).toBe('site.test');
    expect(siteKey('chrome://extensions')).toBeNull();
    expect(siteKey('not a url')).toBeNull();
  });
});

describe('isDisabled', () => {
  it('covers the site and its subdomains, not lookalikes', () => {
    const disabled = ['site.test'];
    expect(isDisabled('https://www.site.test/', disabled)).toBe(true);
    expect(isDisabled('https://player.site.test/', disabled)).toBe(true);
    expect(isDisabled('https://othersite.test/', disabled)).toBe(false);
  });
});

describe('excludeMatchesFor', () => {
  it('builds match patterns for the site and subdomains', () => {
    expect(excludeMatchesFor(['site.test'])).toEqual(['*://site.test/*', '*://*.site.test/*']);
  });
});

describe('setSiteEnabled', () => {
  beforeEach(() => fakeBrowser.reset());

  it('toggles a site without duplicates', async () => {
    await setSiteEnabled('https://www.site.test/x', false);
    await setSiteEnabled('https://site.test/y', false);
    expect(await getDisabledSites()).toEqual(['site.test']);
    await setSiteEnabled('https://site.test/', true);
    expect(await getDisabledSites()).toEqual([]);
  });
});
