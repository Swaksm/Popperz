import { describe, expect, it } from 'vitest';
import { buildCosmeticData, isSafeSelector, parseCosmeticFilter, selectorsForHost, toHidingCss } from '@/lib/filters/cosmetic';

describe('parseCosmeticFilter', () => {
  it('reads domains, selector and exception flag', () => {
    expect(parseCosmeticFilter('a.test,~b.a.test##.ad')).toEqual({ domains: ['a.test', '~b.a.test'], selector: '.ad', exception: false });
    expect(parseCosmeticFilter('a.test#@#.ad')).toMatchObject({ exception: true });
  });
  it('skips procedural and scriptlet filters', () => {
    expect(parseCosmeticFilter('a.test#?#div:-abp-has(.ad)')).toBeNull();
    expect(parseCosmeticFilter('a.test##div:has-text(Sponsored)')).toBeNull();
    expect(parseCosmeticFilter('a.test##+js(nobab)')).toBeNull();
  });
});

describe('isSafeSelector', () => {
  it('accepts balanced selectors and rejects ones that would break a shared rule', () => {
    expect(isSafeSelector('a[href*="x,(y"]')).toBe(true);
    expect(isSafeSelector('div:not(.a)')).toBe(true);
    expect(isSafeSelector('a[href="x]')).toBe(false);
    expect(isSafeSelector('div:not(.a')).toBe(false);
    expect(isSafeSelector('div{color:red}')).toBe(false);
  });
});

describe('buildCosmeticData and selectorsForHost', () => {
  const data = buildCosmeticData([
    '##.ad-banner',
    '##.sponsor',
    'news.test#@#.sponsor',
    'video.test##.preroll',
    'video.test,~kids.video.test##.overlay-ad',
    '~shop.test##.promo',
  ]);

  it('keeps only exception-free selectors in the always-on stylesheet', () => {
    expect(data.generic).toEqual(['.ad-banner']);
  });
  it('adds site selectors, subdomains included', () => {
    expect(selectorsForHost(data, 'www.video.test')).toEqual(expect.arrayContaining(['.preroll', '.overlay-ad', '.sponsor', '.promo']));
  });
  it('honours exceptions on the site and generic exceptions', () => {
    expect(selectorsForHost(data, 'kids.video.test')).not.toContain('.overlay-ad');
    expect(selectorsForHost(data, 'news.test')).not.toContain('.sponsor');
    expect(selectorsForHost(data, 'shop.test')).not.toContain('.promo');
  });
});

describe('toHidingCss', () => {
  it('wraps selectors in forgiving :is() chunks', () => {
    expect(toHidingCss(['.a', '#b'])).toBe(':is(.a,#b){display:none!important}');
  });
});
