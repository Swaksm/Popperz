// Isolated-world relay: reports trusted clicks and guard decisions to the service worker.
import { navigableHref } from '@/lib/click-intent';
import { GUARD_EVENTS, type BridgeMessage } from '@/lib/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchOriginAsFallback: true,
  main() {
    const send = (message: BridgeMessage) => browser.runtime.sendMessage(message).catch(() => {});

    // The page cannot forge isTrusted, so the service worker can rely on these clicks.
    const onGesture = (e: Event) => {
      if (!e.isTrusted) return;
      const target = e.composedPath()[0];
      const link = target instanceof Element ? target.closest('a[href]') : null;
      send({ type: 'gesture', href: link instanceof HTMLAnchorElement ? navigableHref(link.href, location.href) : null });
    };
    // click covers keyboard activation, which fires no pointerdown.
    for (const type of ['pointerdown', 'click', 'auxclick', 'contextmenu']) {
      window.addEventListener(type, onGesture, { capture: true });
    }

    // shortcut: a page that knows Popperz could forge "allowed" events to whitelist one URL in the safety net;
    // the page guard still blocks it in-page. Upgrade to a private MessageChannel if this is ever abused.
    document.addEventListener(GUARD_EVENTS.allowed, (e) => send({ type: 'allowed', url: String((e as CustomEvent).detail) }));
    document.addEventListener(GUARD_EVENTS.blocked, (e) => send({ type: 'blocked', url: String((e as CustomEvent).detail) }));
  },
});
