// Converts Adblock Plus network filters into declarativeNetRequest rules.
// DNR's urlFilter understands the same ||, |, ^ and * syntax, so most of the work is mapping options.

export type ResourceType =
  | 'main_frame' | 'sub_frame' | 'stylesheet' | 'script' | 'image' | 'font' | 'object'
  | 'xmlhttprequest' | 'ping' | 'media' | 'websocket' | 'other';

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' | 'allow' | 'allowAllRequests' };
  condition: {
    urlFilter?: string;
    isUrlFilterCaseSensitive?: boolean;
    resourceTypes?: ResourceType[];
    excludedResourceTypes?: ResourceType[];
    domainType?: 'firstParty' | 'thirdParty';
    initiatorDomains?: string[];
    excludedInitiatorDomains?: string[];
    excludedRequestDomains?: string[];
    requestDomains?: string[];
  };
}

const TYPE_OPTIONS: Record<string, ResourceType[]> = {
  script: ['script'], image: ['image'], stylesheet: ['stylesheet'], css: ['stylesheet'],
  object: ['object'], xmlhttprequest: ['xmlhttprequest'], xhr: ['xmlhttprequest'],
  subdocument: ['sub_frame'], frame: ['sub_frame'], ping: ['ping'], media: ['media'],
  font: ['font'], websocket: ['websocket'], other: ['other'], document: ['main_frame'], doc: ['main_frame'],
};
const ALL_TYPES: ResourceType[] = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'media', 'websocket', 'other',
];
// Options that only matter to cosmetic filtering or are harmless to drop.
const IGNORED_OPTIONS = new Set(['elemhide', 'generichide', 'specifichide', 'ehide', 'ghide', 'shide', 'genericblock']);

const PRIORITY = { block: 1, allow: 2, important: 3 } as const;

export type Conversion = { rule: Omit<DnrRule, 'id'> } | { skipped: string };

// DNR only takes plain ASCII domains, without wildcard TLDs like "example.*".
const validDomain = (d: string) => /^[a-z0-9.-]+$/.test(d) && !d.endsWith('.');

function splitOptions(line: string): [string, string[]] {
  // The option separator is the last $ that is not part of a regex.
  const at = line.lastIndexOf('$');
  if (at < 0 || (line.startsWith('/') && line.endsWith('/'))) return [line, []];
  return [line.slice(0, at), line.slice(at + 1).split(',').map((o) => o.trim().toLowerCase()).filter(Boolean)];
}

export function convertNetworkFilter(raw: string): Conversion {
  let line = raw.trim();
  const exception = line.startsWith('@@');
  if (exception) line = line.slice(2);
  const [pattern, options] = splitOptions(line);

  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) return { skipped: 'regex' };
  if (!/^[\x20-\x7e]*$/.test(pattern)) return { skipped: 'non-ascii' };
  if (pattern.startsWith('||*')) return { skipped: 'bad-pattern' };

  const condition: DnrRule['condition'] = {};
  const urlFilter = pattern === '' || pattern === '*' ? undefined : pattern;
  if (urlFilter) condition.urlFilter = urlFilter;

  const included: ResourceType[] = [];
  const excluded: ResourceType[] = [];
  let important = false;
  let documentException = false;

  for (const option of options) {
    const negated = option.startsWith('~');
    const name = negated ? option.slice(1) : option;
    const [key, value] = name.split('=', 2) as [string, string | undefined];

    if (TYPE_OPTIONS[key] && value === undefined) {
      if (exception && key.startsWith('doc') && !negated) documentException = true;
      else (negated ? excluded : included).push(...TYPE_OPTIONS[key]);
    } else if (key === 'all' && !negated) {
      included.push(...ALL_TYPES);
    } else if (key === 'third-party' || key === '3p') {
      condition.domainType = negated ? 'firstParty' : 'thirdParty';
    } else if (key === 'first-party' || key === '1p') {
      condition.domainType = negated ? 'thirdParty' : 'firstParty';
    } else if (key === 'match-case') {
      condition.isUrlFilterCaseSensitive = true;
    } else if (key === 'important') {
      important = true;
    } else if ((key === 'domain' || key === 'from') && value) {
      const domains = value.split('|');
      const include = domains.filter((d) => !d.startsWith('~')).map((d) => d.toLowerCase());
      const exclude = domains.filter((d) => d.startsWith('~')).map((d) => d.slice(1).toLowerCase());
      if (include.length) {
        const valid = include.filter(validDomain);
        if (!valid.length) return { skipped: 'domain-unsupported' };
        condition.initiatorDomains = valid;
      }
      const validExcluded = exclude.filter(validDomain);
      if (validExcluded.length) condition.excludedInitiatorDomains = validExcluded;
    } else if (key === 'denyallow' && value) {
      condition.excludedRequestDomains = value.split('|').filter(validDomain);
    } else if (IGNORED_OPTIONS.has(key)) {
      if (exception) return { skipped: 'cosmetic-exception' };
    } else {
      return { skipped: `option:${key}` };
    }
  }

  if (documentException) {
    return {
      rule: {
        priority: PRIORITY.allow,
        action: { type: 'allowAllRequests' },
        condition: { ...condition, resourceTypes: ['main_frame', 'sub_frame'] },
      },
    };
  }
  if (!condition.urlFilter && !condition.initiatorDomains && !included.length) return { skipped: 'too-broad' };
  if (included.length) condition.resourceTypes = [...new Set(included)];
  else if (excluded.length) condition.excludedResourceTypes = [...new Set(excluded)];

  const priority = exception ? PRIORITY.allow : important ? PRIORITY.important : PRIORITY.block;
  return { rule: { priority, action: { type: exception ? 'allow' : 'block' }, condition } };
}

export const isCosmeticFilter = (line: string) => /#[@?$%]?#|#@[$?]#/.test(line);
export const isComment = (line: string) => line === '' || line.startsWith('!') || line.startsWith('[');
