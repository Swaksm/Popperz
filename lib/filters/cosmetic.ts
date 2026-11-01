// Turns Adblock Plus element hiding filters (## and #@#) into CSS data.

export interface CosmeticData {
  generic: string[]; // hidden on every site
  genericExcept: { selector: string; except: string[] }[]; // hidden everywhere except these sites
  specific: Record<string, string[]>; // site -> selectors hidden there (subdomains included)
  exceptions: Record<string, string[]>; // site -> selectors never hidden there
}

// Procedural and extended syntax that plain CSS cannot run.
const UNSUPPORTED = /:-abp-|:has-text|:contains\(|:xpath|:upward|:remove\(|:matches-css|:style\(|:min-text-length|:watch-attr|:matches-path|:others\(/;

// Selectors are joined into shared rules, so one with stray braces, quotes or brackets would break its neighbours.
export function isSafeSelector(selector: string): boolean {
  if (/[{};]|\/\*/.test(selector)) return false;
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]!;
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') stack.push(c === '(' ? ')' : ']');
    else if (c === ')' || c === ']') { if (stack.pop() !== c) return false; }
  }
  return !quote && !stack.length;
}

export function parseCosmeticFilter(line: string): { domains: string[]; selector: string; exception: boolean } | null {
  const match = /^([^#]*)#(@?)#(.+)$/.exec(line);
  if (!match) return null; // #?#, #$# and #%# variants end up here and are skipped
  const [, domainPart = '', at, selector = ''] = match;
  if (UNSUPPORTED.test(selector) || selector.startsWith('+js(') || !isSafeSelector(selector)) return null;
  const domains = domainPart.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  return { domains, selector: selector.trim(), exception: at === '@' };
}

const add = (map: Record<string, string[]>, key: string, value: string) => {
  (map[key] ??= []).push(value);
};

export function buildCosmeticData(lines: Iterable<string>): CosmeticData {
  const genericSet = new Set<string>();
  const genericExcept = new Map<string, Set<string>>();
  const specific: Record<string, string[]> = {};
  const exceptions: Record<string, string[]> = {};

  for (const line of lines) {
    const filter = parseCosmeticFilter(line);
    if (!filter) continue;
    const positive = filter.domains.filter((d) => !d.startsWith('~'));
    const negative = filter.domains.filter((d) => d.startsWith('~')).map((d) => d.slice(1));

    if (filter.exception) {
      for (const d of positive) add(exceptions, d, filter.selector);
      continue;
    }
    if (positive.length) {
      for (const d of positive) add(specific, d, filter.selector);
      for (const d of negative) add(exceptions, d, filter.selector);
    } else if (negative.length) {
      const set = genericExcept.get(filter.selector) ?? new Set();
      negative.forEach((d) => set.add(d));
      genericExcept.set(filter.selector, set);
    } else {
      genericSet.add(filter.selector);
    }
  }

  // A generic selector with a site exception cannot live in the always-on stylesheet.
  for (const [site, selectors] of Object.entries(exceptions)) {
    for (const selector of selectors) {
      if (genericSet.delete(selector) || genericExcept.has(selector)) {
        const set = genericExcept.get(selector) ?? new Set();
        set.add(site);
        genericExcept.set(selector, set);
      }
    }
  }

  return {
    generic: [...genericSet],
    genericExcept: [...genericExcept].map(([selector, except]) => ({ selector, except: [...except] })),
    specific,
    exceptions,
  };
}

const HIDE = '{display:none!important}';
const CHUNK = 500;

// :is() forgives invalid selectors, so one bad filter cannot void a whole chunk.
export function toHidingCss(selectors: readonly string[]): string {
  const chunks: string[] = [];
  for (let i = 0; i < selectors.length; i += CHUNK) {
    chunks.push(`:is(${selectors.slice(i, i + CHUNK).join(',')})${HIDE}`);
  }
  return chunks.join('\n');
}

const matchesSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

// Selectors to add on a given host, on top of the always-on generic stylesheet.
export function selectorsForHost(data: CosmeticData, host: string): string[] {
  const excluded = new Set(
    Object.entries(data.exceptions).filter(([site]) => matchesSite(host, site)).flatMap(([, s]) => s),
  );
  const result = new Set<string>();
  for (const [site, selectors] of Object.entries(data.specific)) {
    if (matchesSite(host, site)) selectors.forEach((s) => result.add(s));
  }
  for (const { selector, except } of data.genericExcept) {
    if (!except.some((site) => matchesSite(host, site))) result.add(selector);
  }
  return [...result].filter((s) => !excluded.has(s));
}
