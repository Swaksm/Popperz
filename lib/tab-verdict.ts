// Service worker safety net: decides whether a tab opened by a page may stay open.
import { sameTarget } from './click-intent';

export interface TabState {
  gesture: { href: string | null; at: number } | null; // last trusted click seen by the bridge
  allowed: { url: string; at: number }[]; // opens the page guard let through
  blocked: number;
}

export const emptyTabState = (): TabState => ({ gesture: null, allowed: [], blocked: 0 });

const ALLOWED_WINDOW_MS = 10_000;
// A click on a matching link is strong evidence, so a long window covers "open in new tab" from the context menu.
const LINK_WINDOW_MS = 60_000;
const MAX_ALLOWED = 10;

export type Verdict = 'keep' | 'close' | 'wait';

const isBlank = (url: string) => url === '' || url === 'about:blank';

export function judgeNewTab(url: string, state: TabState, now: number): Verdict {
  const recentlyAllowed = state.allowed.filter((a) => now - a.at < ALLOWED_WINDOW_MS);
  if (isBlank(url)) {
    // A blank window the guard approved (print view, OAuth popup) may navigate anywhere afterwards.
    return recentlyAllowed.some((a) => isBlank(a.url)) ? 'keep' : 'wait';
  }
  if (recentlyAllowed.some((a) => sameTarget(a.url, url))) return 'keep';
  const g = state.gesture;
  if (g?.href && now - g.at < LINK_WINDOW_MS && sameTarget(url, g.href)) return 'keep';
  return 'close';
}

export function rememberAllowed(state: TabState, url: string, now: number): TabState {
  return { ...state, allowed: [...state.allowed, { url, at: now }].slice(-MAX_ALLOWED) };
}
