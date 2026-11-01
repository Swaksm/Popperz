import { describe, expect, it } from 'vitest';
import { navigableHref, opensNewWindow, shouldAllowOpen, type OpenRequest } from '@/lib/click-intent';

const PAGE = 'https://site.test/watch?v=1';
const AD = 'https://ads.example/pop';
const req = (r: Partial<OpenRequest>): OpenRequest => ({
  url: AD, pageUrl: PAGE, clickedHref: null, gestureAge: 100, holder: 'element', ...r,
});

describe('shouldAllowOpen', () => {
  it('blocks a global listener opening an ad after a click on the background', () => {
    expect(shouldAllowOpen(req({ holder: 'global' }))).toBe(false);
  });
  it('blocks when there was no click at all', () => {
    expect(shouldAllowOpen(req({ gestureAge: null }))).toBe(false);
  });
  it('blocks when the click is too old', () => {
    expect(shouldAllowOpen(req({ gestureAge: 9000 }))).toBe(false);
  });
  it('allows the clicked link to open its own target', () => {
    expect(shouldAllowOpen(req({ url: 'https://other.test/a#x', clickedHref: 'https://other.test/a', holder: 'global' }))).toBe(true);
  });
  it('blocks a click on a link that opens something else', () => {
    expect(shouldAllowOpen(req({ clickedHref: 'https://site.test/download' }))).toBe(false);
  });
  it('allows a button handler bound to the button itself', () => {
    expect(shouldAllowOpen(req({ url: 'https://share.test/post', holder: 'element' }))).toBe(true);
  });
  it('allows a same-site async open but blocks a cross-site one', () => {
    expect(shouldAllowOpen(req({ url: 'https://site.test/print', holder: 'none' }))).toBe(true);
    expect(shouldAllowOpen(req({ holder: 'none' }))).toBe(false);
  });
});

describe('navigableHref', () => {
  it('ignores javascript: and same-page anchors', () => {
    expect(navigableHref('javascript:void(0)', PAGE)).toBeNull();
    expect(navigableHref('#comments', PAGE)).toBeNull();
  });
  it('resolves relative links', () => {
    expect(navigableHref('/about', PAGE)).toBe('https://site.test/about');
  });
});

describe('opensNewWindow', () => {
  it('treats _blank and named targets as new windows', () => {
    expect(opensNewWindow('_blank')).toBe(true);
    expect(opensNewWindow('promo')).toBe(true);
    expect(opensNewWindow('_self')).toBe(false);
    expect(opensNewWindow('')).toBe(false);
  });
});
