// Decides whether a page may open a new window, from what the user really clicked.

export type ListenerHolder = 'global' | 'element' | 'none';

export interface OpenRequest {
  url: string; // absolute URL the page wants to open
  pageUrl: string;
  clickedHref: string | null; // href of the real link the user clicked, if any
  gestureAge: number | null; // ms since the last trusted click, null if none
  holder: ListenerHolder; // where the running listener is attached ('none' = async, outside any event)
}

const GESTURE_WINDOW_MS = 5000;

function parse(url: string, base?: string): URL | null {
  try {
    return new URL(url || 'about:blank', base);
  } catch {
    return null;
  }
}

// A link counts as a navigation target unless it is javascript: or only points to an anchor on the same page.
export function navigableHref(href: string, pageUrl: string): string | null {
  const url = parse(href, pageUrl);
  if (!url || url.protocol === 'javascript:') return null;
  const page = parse(pageUrl);
  if (page && url.hash && url.origin === page.origin && url.pathname === page.pathname && url.search === page.search) {
    return null;
  }
  return url.href;
}

export function sameTarget(a: string, b: string): boolean {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return false;
  x.hash = '';
  y.hash = '';
  return x.href === y.href;
}

function sameOrigin(a: string, b: string): boolean {
  const x = parse(a);
  const y = parse(b);
  return !!x && !!y && x.origin === y.origin;
}

export function shouldAllowOpen(r: OpenRequest): boolean {
  // The user clicked a real link: only that link's target may open.
  if (r.clickedHref) return sameTarget(r.url, r.clickedHref);
  if (r.gestureAge === null || r.gestureAge > GESTURE_WINDOW_MS) return false;
  // Listeners on window/document/body (or a page-wide layer) fire on any click: classic popunder.
  if (r.holder === 'global') return false;
  // Opened later, outside the click handler: we cannot see who asked, so stay on the same site.
  if (r.holder === 'none') return sameOrigin(r.url, r.pageUrl);
  return true;
}

const SAME_WINDOW_TARGETS = new Set(['', '_self', '_parent', '_top']);

export function opensNewWindow(target: string | null | undefined): boolean {
  return !SAME_WINDOW_TARGETS.has((target ?? '').trim().toLowerCase());
}
