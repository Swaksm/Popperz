import { beforeEach, describe, expect, it } from 'vitest';
import { isStableName, selectorFor } from '@/lib/selector';

describe('isStableName', () => {
  it('rejects generated names', () => {
    expect(isStableName('sidebar-ad')).toBe(true);
    expect(isStableName('css-1x2y3z')).toBe(false);
    expect(isStableName('ad_83920174')).toBe(false);
    expect(isStableName('a1b2c3d4e5f6')).toBe(false);
  });
});

describe('selectorFor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="promo">promo</div>
      <main id="content">
        <section class="row"><div class="box sc-a1B2c3">un</div><div class="box">deux</div></section>
        <aside class="banner css-9k2j1h">pub</aside>
      </main>`;
  });

  const unique = (selector: string) => document.querySelectorAll(selector);

  it('prefers a stable id', () => {
    expect(selectorFor(document.querySelector('#promo')!)).toBe('#promo');
  });
  it('uses stable classes and drops generated ones', () => {
    const selector = selectorFor(document.querySelector('aside')!);
    expect(selector).not.toContain('css-');
    expect(unique(selector)).toHaveLength(1);
  });
  it('disambiguates siblings with nth-of-type', () => {
    const second = document.querySelectorAll('.box')[1]!;
    const selector = selectorFor(second);
    expect(selector).toContain(':nth-of-type(2)');
    expect(unique(selector)[0]).toBe(second);
  });
});
