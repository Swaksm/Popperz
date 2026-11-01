// Isolated-world cleaner: neutralises invisible click-catching layers and runs the Zappeur.
import type { BridgeMessage, PopupMessage } from '@/lib/messages';
import { isClickTrap } from '@/lib/overlay';
import { selectorFor } from '@/lib/selector';
import { getDisabledSites, isDisabled } from '@/lib/settings';
import { addZapperRule } from '@/lib/zapper-store';

const NEUTRALISED = 'data-popperz-neutralised';
// Viewport points probed for overlays: centre and the middle of each quadrant.
const PROBES = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] as const;
const MEDIA = 'img, video, canvas, svg, picture, iframe, object, embed';

function effectiveOpacity(el: Element): number {
  let opacity = 1;
  for (let node: Element | null = el; node; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity);
  }
  return opacity;
}

function hasVisibleContent(el: Element): boolean {
  if ((el as HTMLElement).innerText?.trim()) return true;
  return [...el.querySelectorAll(MEDIA)].some((m) => {
    const box = m.getBoundingClientRect();
    return box.width > 1 && box.height > 1;
  });
}

function checkElement(el: Element, topmost: boolean): boolean {
  const style = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const visibleWidth = Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0));
  const visibleHeight = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
  return isClickTrap({
    positioned: style.position === 'fixed' || style.position === 'absolute',
    coverage: (visibleWidth * visibleHeight) / (innerWidth * innerHeight),
    topmost,
    opacity: effectiveOpacity(el),
    transparentBackground: style.backgroundImage === 'none' && /rgba\(.*,\s*0\)|transparent/.test(style.backgroundColor),
    hasVisibleContent: hasVisibleContent(el),
  });
}

// One-shot picking mode: the hovered element is outlined, a click removes it and remembers it for the site.
function startZapper(): void {
  const outline = document.createElement('div');
  outline.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;outline:2px solid #C88ABB;' +
    'background:rgba(200,138,187,0.18);border-radius:4px;transition:all 80ms ease-out';
  document.documentElement.append(outline);
  let hovered: Element | null = null;

  const onMove = (e: MouseEvent) => {
    hovered = document.elementFromPoint(e.clientX, e.clientY);
    if (!hovered || hovered === document.body || hovered === document.documentElement) return;
    const box = hovered.getBoundingClientRect();
    Object.assign(outline.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  };
  // The page must not see the picking clicks.
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onClick = (e: MouseEvent) => {
    swallow(e);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    stop();
    if (!target || target === document.body || target === document.documentElement) return;
    addZapperRule(location.href, selectorFor(target));
    (target as HTMLElement).style.setProperty('display', 'none', 'important');
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') stop();
  };
  const stop = () => {
    outline.remove();
    removeEventListener('mousemove', onMove, true);
    removeEventListener('click', onClick, true);
    removeEventListener('keydown', onKey, true);
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) removeEventListener(type, swallow, true);
  };
  addEventListener('mousemove', onMove, true);
  addEventListener('click', onClick, true);
  addEventListener('keydown', onKey, true);
  for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) addEventListener(type, swallow, true);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    if (isDisabled(location.href, await getDisabledSites())) return;

    browser.runtime.onMessage.addListener((message: PopupMessage) => {
      if (message.type === 'zap-start') startZapper();
    });

    const neutralise = (el: Element) => {
      (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      el.setAttribute(NEUTRALISED, '');
      browser.runtime.sendMessage({ type: 'blocked', url: 'overlay' } satisfies BridgeMessage).catch(() => {});
    };

    // Walk up from the element that receives clicks at each point; the trap is that element or an ancestor.
    const scanAt = (x: number, y: number) => {
      for (let node = document.elementFromPoint(x, y); node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (!node.hasAttribute(NEUTRALISED) && checkElement(node, true)) {
          neutralise(node);
          return true;
        }
      }
      return false;
    };
    const scan = () => {
      if (!document.body || !innerWidth || !innerHeight) return;
      for (const [fx, fy] of PROBES) {
        // A neutralised layer may hide another one underneath: probe the same point again.
        for (let i = 0; i < 5 && scanAt(fx * innerWidth, fy * innerHeight); i++);
      }
    };

    // DOM changes are batched into one scan per frame, so heavy pages pay a fixed cost.
    let scheduled = false;
    const scheduleScan = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    };
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'],
    });
    document.addEventListener('DOMContentLoaded', scan);
    addEventListener('load', scan);
    addEventListener('resize', scheduleScan);
    // Last chance right before a click lands.
    addEventListener('pointerdown', (e) => { if (e.isTrusted) scanAt(e.clientX, e.clientY); }, { capture: true });
    scan();
  },
});
