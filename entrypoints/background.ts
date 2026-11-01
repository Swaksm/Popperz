import { selectorsForHost, toHidingCss, type CosmeticData } from '@/lib/filters/cosmetic';
import type { BridgeMessage } from '@/lib/messages';
import { DISABLED_SITES_KEY, excludeMatchesFor, getDisabledSites, isDisabled, siteKey } from '@/lib/settings';
import { siteAllowRules } from '@/lib/site-rules';
import { emptyTabState, judgeNewTab, rememberAllowed, type TabState } from '@/lib/tab-verdict';
import { getZapperRules, zapperSelectorsFor } from '@/lib/zapper-store';

const GUARD_ID = 'popperz-guard';
const COSMETIC_ID = 'popperz-cosmetic';

// Scripts registered at runtime, so disabled sites can be left out of them.
async function registerScripts(disabled: string[]): Promise<void> {
  const common = {
    matches: ['<all_urls>'],
    excludeMatches: excludeMatchesFor(disabled),
    runAt: 'document_start' as const,
    allFrames: true,
    matchOriginAsFallback: true,
  };
  const scripts = [
    { ...common, id: GUARD_ID, js: ['content-scripts/guard.js'], world: 'MAIN' as const },
    { ...common, id: COSMETIC_ID, css: ['cosmetic/generic.css'] },
  ];
  const existing = new Set((await browser.scripting.getRegisteredContentScripts()).map((s) => s.id));
  const toUpdate = scripts.filter((s) => existing.has(s.id));
  const toRegister = scripts.filter((s) => !existing.has(s.id));
  if (toUpdate.length) await browser.scripting.updateContentScripts(toUpdate);
  if (toRegister.length) await browser.scripting.registerContentScripts(toRegister);
}

async function syncSiteAllowRules(disabled: string[]): Promise<void> {
  const current = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: current.map((r) => r.id),
    addRules: siteAllowRules(disabled) as Browser.declarativeNetRequest.Rule[],
  });
}

async function applySettings(): Promise<void> {
  const disabled = await getDisabledSites();
  await Promise.all([registerScripts(disabled), syncSiteAllowRules(disabled)]);
}

async function setup(): Promise<void> {
  await browser.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
  await browser.action.setBadgeBackgroundColor({ color: '#C88ABB' });
  await applySettings();
}

// Tab state lives in storage.session: the service worker sleeps after ~30 s and would forget it otherwise.
const tabKey = (tabId: number) => `tab:${tabId}`;
const pendingKey = (tabId: number) => `pending:${tabId}`;

async function readTab(tabId: number): Promise<TabState> {
  const key = tabKey(tabId);
  return ((await browser.storage.session.get(key))[key] as TabState | undefined) ?? emptyTabState();
}

// Updates run one after another so concurrent messages never overwrite each other.
let updates = Promise.resolve();
function updateTab(tabId: number, change: (state: TabState) => TabState): Promise<void> {
  updates = updates
    .then(async () => browser.storage.session.set({ [tabKey(tabId)]: change(await readTab(tabId)) }))
    .catch(() => {});
  return updates;
}

// The guard's "allowed" message can land just after the new tab event.
const ALLOWED_GRACE_MS = 250;

async function onBridgeMessage(message: BridgeMessage, sender: Browser.runtime.MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  const now = Date.now();
  if (message.type === 'gesture') await updateTab(tabId, (s) => ({ ...s, gesture: { href: message.href, at: now } }));
  else if (message.type === 'allowed') await updateTab(tabId, (s) => rememberAllowed(s, message.url, now));
  else if (message.type === 'blocked') await updateTab(tabId, (s) => ({ ...s, blocked: s.blocked + 1 }));
}

async function judge(tabId: number, sourceTabId: number, url: string): Promise<void> {
  const source = await browser.tabs.get(sourceTabId).catch(() => null);
  if (!source?.url || isDisabled(source.url, await getDisabledSites())) return;
  let verdict = judgeNewTab(url, await readTab(sourceTabId), Date.now());
  if (verdict === 'close') {
    await new Promise((r) => setTimeout(r, ALLOWED_GRACE_MS));
    await updates;
    verdict = judgeNewTab(url, await readTab(sourceTabId), Date.now());
  }
  if (verdict === 'wait') {
    await browser.storage.session.set({ [pendingKey(tabId)]: sourceTabId });
    return;
  }
  await browser.storage.session.remove(pendingKey(tabId));
  if (verdict === 'close') {
    await browser.tabs.remove(tabId).catch(() => {});
    await browser.tabs.update(sourceTabId, { active: true }).catch(() => {});
    await updateTab(sourceTabId, (s) => ({ ...s, blocked: s.blocked + 1 }));
  }
}

// Site-specific hiding (lists + Zappeur), loaded once per service worker lifetime.
let cosmeticData: Promise<CosmeticData> | null = null;
const loadCosmeticData = () =>
  (cosmeticData ??= fetch(browser.runtime.getURL('/cosmetic/sites.json'))
    .then((r) => r.json())
    .then((d) => ({ generic: [], ...d })));

async function injectSiteCss(tabId: number, frameId: number, url: string): Promise<void> {
  const host = siteKey(url);
  if (!host || isDisabled(url, await getDisabledSites())) return;
  const selectors = [...selectorsForHost(await loadCosmeticData(), host), ...zapperSelectorsFor(await getZapperRules(), url)];
  if (!selectors.length) return;
  await browser.scripting.insertCSS({ target: { tabId, frameIds: [frameId] }, css: toHidingCss(selectors) }).catch(() => {});
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(setup);
  browser.runtime.onStartup.addListener(setup);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && DISABLED_SITES_KEY in changes) applySettings();
  });

  browser.runtime.onMessage.addListener((message: BridgeMessage, sender) => {
    onBridgeMessage(message, sender);
  });

  browser.webNavigation.onCreatedNavigationTarget.addListener(({ tabId, sourceTabId, url }) => {
    judge(tabId, sourceTabId, url);
  });

  // A blank popup gets judged on its first real navigation.
  browser.webNavigation.onBeforeNavigate.addListener(async ({ tabId, frameId, url }) => {
    if (frameId !== 0) return;
    const key = pendingKey(tabId);
    const sourceTabId = (await browser.storage.session.get(key))[key] as number | undefined;
    if (sourceTabId !== undefined && url !== 'about:blank') await judge(tabId, sourceTabId, url);
  });

  browser.webNavigation.onCommitted.addListener(({ tabId, frameId, url, transitionType }) => {
    injectSiteCss(tabId, frameId, url);
    // Counters are per page: reset when the tab loads a new document.
    if (frameId === 0 && transitionType !== 'auto_subframe') {
      updateTab(tabId, (s) => ({ ...s, blocked: 0, allowed: [] }));
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    browser.storage.session.remove([tabKey(tabId), pendingKey(tabId)]);
  });
});
