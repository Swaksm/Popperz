import { localizeDom } from '@/lib/i18n-dom';
import type { PopupMessage } from '@/lib/messages';
import { getDisabledSites, isDisabled, setSiteEnabled, siteKey } from '@/lib/settings';
import type { TabState } from '@/lib/tab-verdict';
import { getZapperRules, removeZapperRule, zapperSelectorsFor } from '@/lib/zapper-store';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const t = (key: string) => browser.i18n.getMessage(key as any);

localizeDom();

// ?tabId= lets the e2e tests point the popup at a given tab.
async function currentTab(): Promise<Browser.tabs.Tab | undefined> {
  const forced = Number(new URLSearchParams(location.search).get('tabId'));
  if (forced) return browser.tabs.get(forced);
  return (await browser.tabs.query({ active: true, currentWindow: true }))[0];
}

async function renderRules(url: string, site: string): Promise<void> {
  const selectors = zapperSelectorsFor(await getZapperRules(), url);
  const list = $('rules');
  list.replaceChildren(
    ...selectors.map((selector) => {
      const item = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = selector;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${t('removeRule')} ${selector}`);
      remove.addEventListener('click', async () => {
        await removeZapperRule(site, selector);
        $('reload-hint').hidden = false;
        await renderRules(url, site);
      });
      item.append(code, remove);
      return item;
    }),
  );
  $('rules-empty').hidden = selectors.length > 0;
}

async function main(): Promise<void> {
  const tab = await currentTab();
  const site = tab?.url ? siteKey(tab.url) : null;
  if (!tab?.id || !tab.url || !site) {
    $('not-applicable').hidden = false;
    return;
  }
  const { id: tabId, url } = tab;
  $('controls').hidden = false;
  $('site-host').textContent = site;

  const toggle = $<HTMLInputElement>('site-toggle');
  const showState = () => { $('site-state').textContent = t(toggle.checked ? 'siteOn' : 'siteOff'); };
  toggle.checked = !isDisabled(url, await getDisabledSites());
  showState();
  toggle.addEventListener('change', async () => {
    showState();
    await setSiteEnabled(url, toggle.checked);
    $('reload-hint').hidden = false;
  });

  const matched = await browser.declarativeNetRequest.getMatchedRules({ tabId }).catch(() => ({ rulesMatchedInfo: [] }));
  $('stat-ads').textContent = String(matched.rulesMatchedInfo.length);
  const key = `tab:${tabId}`;
  const state = (await browser.storage.session.get(key))[key] as TabState | undefined;
  $('stat-traps').textContent = String(state?.blocked ?? 0);

  $('zap').addEventListener('click', async () => {
    await browser.tabs.sendMessage(tabId, { type: 'zap-start' } satisfies PopupMessage).catch(() => {});
    window.close();
  });

  await renderRules(url, site);
}

main();
