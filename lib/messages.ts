// Messages from content scripts to the service worker.
export type BridgeMessage =
  | { type: 'gesture'; href: string | null }
  | { type: 'allowed'; url: string }
  | { type: 'blocked'; url: string };

// Messages from the popup to the content scripts of the active tab.
export type PopupMessage = { type: 'zap-start' };

// Events the page-world guard fires on document for the bridge to relay.
export const GUARD_EVENTS = { blocked: 'popperz:blocked', allowed: 'popperz:allowed' } as const;
