// Fills every [data-i18n] element with its translated message.
export function localizeDom(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = browser.i18n.getMessage(el.dataset.i18n as any);
  }
}
