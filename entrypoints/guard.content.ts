// Page-world guard: runs before the site's scripts and decides which new windows may open.
import { navigableHref, opensNewWindow, shouldAllowOpen, type ListenerHolder } from '@/lib/click-intent';
import { GUARD_EVENTS } from '@/lib/messages';

export default defineContentScript({
  registration: 'runtime', // registered by the background so disabled sites can be excluded
  world: 'MAIN',
  matches: ['<all_urls>'],
  main() {
    let gesture: { at: number; href: string | null } | null = null;

    const recordGesture = (e: Event) => {
      if (!e.isTrusted) return;
      const target = e.composedPath()[0];
      const link = target instanceof Element ? target.closest('a[href]') : null;
      gesture = {
        at: performance.now(),
        href: link instanceof HTMLAnchorElement ? navigableHref(link.href, location.href) : null,
      };
    };
    for (const type of ['pointerdown', 'mousedown', 'click', 'auxclick']) {
      window.addEventListener(type, recordGesture, { capture: true });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') recordGesture(e);
    }, { capture: true });

    const holderOf = (): ListenerHolder => {
      const current = window.event?.currentTarget;
      if (!current) return 'none';
      if (current === window || current === document || current === document.documentElement || current === document.body) {
        return 'global';
      }
      if (current instanceof Element) {
        const box = current.getBoundingClientRect();
        if (box.width * box.height >= 0.5 * innerWidth * innerHeight) return 'global';
      }
      return 'element';
    };

    const allowed = (url: string, holder: ListenerHolder) => {
      const ok = shouldAllowOpen({
        url,
        pageUrl: location.href,
        clickedHref: gesture?.href ?? null,
        gestureAge: gesture ? performance.now() - gesture.at : null,
        holder,
      });
      document.dispatchEvent(new CustomEvent(ok ? GUARD_EVENTS.allowed : GUARD_EVENTS.blocked, { detail: url }));
      return ok;
    };
    const resolve = (url: unknown) => {
      try {
        return new URL(String(url ?? '') || 'about:blank', location.href).href;
      } catch {
        return 'about:blank';
      }
    };

    // Proxies still print "[native code]", which defeats the usual override probes.
    window.open = new Proxy(window.open, {
      apply(target, thisArg, args: Parameters<typeof window.open>) {
        return allowed(resolve(args[0]), holderOf()) ? Reflect.apply(target, thisArg, args) : null;
      },
    });

    // Links clicked by script: attached ones reach this listener, detached ones go through the overrides below.
    window.addEventListener('click', (e) => {
      if (e.isTrusted) return;
      const link = e.composedPath()[0];
      if (link instanceof HTMLAnchorElement && opensNewWindow(link.target) && !allowed(link.href, 'none')) {
        e.preventDefault();
      }
    }, { capture: true });

    const blockedDetachedLink = (link: HTMLAnchorElement) =>
      !link.isConnected && opensNewWindow(link.target) && !allowed(link.href, 'none');

    const anchorProto = HTMLAnchorElement.prototype;
    anchorProto.click = new Proxy(anchorProto.click, {
      apply(target, thisArg: HTMLAnchorElement, args: []) {
        if (!blockedDetachedLink(thisArg)) Reflect.apply(target, thisArg, args);
      },
    });
    anchorProto.dispatchEvent = new Proxy(EventTarget.prototype.dispatchEvent, {
      apply(target, thisArg: HTMLAnchorElement, args: [Event]) {
        if (args[0]?.type === 'click' && blockedDetachedLink(thisArg)) return false;
        return Reflect.apply(target, thisArg, args);
      },
    });

    const formProto = HTMLFormElement.prototype;
    const guardSubmit = <T extends (...a: any[]) => unknown>(original: T) =>
      new Proxy(original, {
        apply(target, thisArg: HTMLFormElement, args: Parameters<T>) {
          if (opensNewWindow(thisArg.target) && !allowed(resolve(thisArg.action), holderOf())) return;
          return Reflect.apply(target, thisArg, args);
        },
      });
    formProto.submit = guardSubmit(formProto.submit);
    formProto.requestSubmit = guardSubmit(formProto.requestSubmit);
  },
});
