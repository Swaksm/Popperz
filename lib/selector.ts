// Builds a CSS selector for an element that should still match it on the next visit.

// Ids and classes produced by build tools or frameworks change between page loads.
const GENERATED = /\d{4,}|^(css|sc|jsx|svelte|emotion|styled)-|^[a-z]{1,3}[A-Z0-9][a-zA-Z0-9]{4,}$|[a-f0-9]{8,}/;

export const isStableName = (name: string) => /^[A-Za-z_][\w-]*$/.test(name) && name.length <= 40 && !GENERATED.test(name);

const escape = (name: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name);

function step(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = [...el.classList].filter(isStableName).slice(0, 3).map((c) => `.${escape(c)}`).join('');
  const parent = el.parentElement;
  if (!parent) return tag + classes;
  const sameKind = [...parent.children].filter((c) => c.tagName === el.tagName);
  const ambiguous = sameKind.filter((c) => classes === '' || c.matches(tag + classes)).length > 1;
  return ambiguous ? `${tag}${classes}:nth-of-type(${sameKind.indexOf(el) + 1})` : tag + classes;
}

export function selectorFor(el: Element, root: ParentNode = el.ownerDocument): string {
  if (el.id && isStableName(el.id)) return `#${escape(el.id)}`;
  const parts: string[] = [];
  for (let node: Element | null = el; node && node.tagName !== 'BODY' && node.tagName !== 'HTML'; node = node.parentElement) {
    if (node !== el && node.id && isStableName(node.id)) {
      parts.unshift(`#${escape(node.id)}`);
      break;
    }
    parts.unshift(step(node));
    const selector = parts.join(' > ');
    if (root.querySelectorAll(selector).length === 1) return selector;
  }
  return parts.join(' > ');
}
