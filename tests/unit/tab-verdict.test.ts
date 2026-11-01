import { describe, expect, it } from 'vitest';
import { emptyTabState, judgeNewTab, rememberAllowed } from '@/lib/tab-verdict';

const NOW = 1_000_000;
const AD = 'https://ads.example/pop';

describe('judgeNewTab', () => {
  it('closes a tab nobody asked for', () => {
    expect(judgeNewTab(AD, emptyTabState(), NOW)).toBe('close');
  });
  it('keeps the target of the clicked link', () => {
    const state = { ...emptyTabState(), gesture: { href: 'https://news.test/a', at: NOW - 2000 } };
    expect(judgeNewTab('https://news.test/a#top', state, NOW)).toBe('keep');
    expect(judgeNewTab(AD, state, NOW)).toBe('close');
  });
  it('keeps what the page guard allowed, for a short while', () => {
    const state = rememberAllowed(emptyTabState(), 'https://share.test/post', NOW - 1000);
    expect(judgeNewTab('https://share.test/post', state, NOW)).toBe('keep');
    expect(judgeNewTab('https://share.test/post', state, NOW + 20_000)).toBe('close');
  });
  it('waits on blank tabs unless the guard approved a blank window', () => {
    expect(judgeNewTab('about:blank', emptyTabState(), NOW)).toBe('wait');
    const state = rememberAllowed(emptyTabState(), 'about:blank', NOW);
    expect(judgeNewTab('about:blank', state, NOW)).toBe('keep');
  });
  it('keeps only the last 10 allowed opens', () => {
    let state = emptyTabState();
    for (let i = 0; i < 12; i++) state = rememberAllowed(state, `https://x.test/${i}`, NOW);
    expect(state.allowed).toHaveLength(10);
    expect(state.allowed[0]?.url).toBe('https://x.test/2');
  });
});
