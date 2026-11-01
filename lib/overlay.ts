// Recognises invisible layers laid over a page to catch clicks.

export interface OverlayCandidate {
  positioned: boolean; // position fixed or absolute
  coverage: number; // share of the viewport covered, 0..1
  topmost: boolean; // receives clicks at the viewport point being checked
  opacity: number; // effective opacity, parents included
  transparentBackground: boolean; // no background colour or image
  hasVisibleContent: boolean; // text or media a user could see
}

const MIN_COVERAGE = 0.5;
const MAX_OPACITY = 0.1;

export function isClickTrap(c: OverlayCandidate): boolean {
  if (!c.positioned || !c.topmost || c.coverage < MIN_COVERAGE) return false;
  return c.opacity <= MAX_OPACITY || (c.transparentBackground && !c.hasVisibleContent);
}
