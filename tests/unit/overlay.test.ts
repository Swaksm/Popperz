import { describe, expect, it } from 'vitest';
import { isClickTrap, type OverlayCandidate } from '@/lib/overlay';

const trap: OverlayCandidate = {
  positioned: true, coverage: 1, topmost: true, opacity: 1, transparentBackground: true, hasVisibleContent: false,
};

describe('isClickTrap', () => {
  it('flags an empty transparent full-page layer', () => {
    expect(isClickTrap(trap)).toBe(true);
  });
  it('flags a near-invisible layer even if it has content (hidden ad iframe)', () => {
    expect(isClickTrap({ ...trap, opacity: 0.01, transparentBackground: false, hasVisibleContent: true })).toBe(true);
  });
  it('flags a layer covering more than half the page', () => {
    expect(isClickTrap({ ...trap, coverage: 0.6 })).toBe(true);
  });
  it('ignores a modal with a dimmed backdrop', () => {
    expect(isClickTrap({ ...trap, opacity: 1, transparentBackground: false })).toBe(false);
  });
  it('ignores a transparent page wrapper that holds visible content', () => {
    expect(isClickTrap({ ...trap, hasVisibleContent: true })).toBe(false);
  });
  it('ignores small layers and layers that do not get the click', () => {
    expect(isClickTrap({ ...trap, coverage: 0.2 })).toBe(false);
    expect(isClickTrap({ ...trap, topmost: false })).toBe(false);
  });
  it('ignores static elements in the normal flow', () => {
    expect(isClickTrap({ ...trap, positioned: false })).toBe(false);
  });
});
