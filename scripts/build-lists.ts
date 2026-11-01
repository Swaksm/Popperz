// Downloads EasyList and EasyPrivacy and converts them into DNR rulesets and cosmetic CSS data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCosmeticData, toHidingCss } from '../lib/filters/cosmetic.ts';
import { convertNetworkFilter, isComment, isCosmeticFilter, type DnrRule } from '../lib/filters/network.ts';

const LISTS = {
  easylist: 'https://easylist.to/easylist/easylist.txt',
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
};
// Chrome guarantees this many enabled static rules per extension; more may fit in the shared global quota.
const GUARANTEED_STATIC_RULES = 30_000;

mkdirSync('public/rules', { recursive: true });
mkdirSync('public/cosmetic', { recursive: true });

const cosmeticLines: string[] = [];
let totalRules = 0;

for (const [name, url] of Object.entries(LISTS)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/).map((l) => l.trim());

  const rules: DnrRule[] = [];
  const skipped = new Map<string, number>();
  for (const line of lines) {
    if (isComment(line)) continue;
    if (isCosmeticFilter(line)) {
      cosmeticLines.push(line);
      continue;
    }
    const result = convertNetworkFilter(line);
    if ('rule' in result) rules.push({ id: rules.length + 1, ...result.rule });
    else skipped.set(result.skipped, (skipped.get(result.skipped) ?? 0) + 1);
  }

  writeFileSync(`public/rules/${name}.json`, JSON.stringify(rules));
  totalRules += rules.length;
  const skippedTotal = [...skipped.values()].reduce((a, b) => a + b, 0);
  const top = [...skipped].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${name}: ${rules.length} rules converted, ${skippedTotal} skipped (${top})`);
}

const cosmetic = buildCosmeticData(cosmeticLines);
writeFileSync('public/cosmetic/generic.css', toHidingCss(cosmetic.generic));
writeFileSync('public/cosmetic/sites.json', JSON.stringify({
  genericExcept: cosmetic.genericExcept, specific: cosmetic.specific, exceptions: cosmetic.exceptions,
}));
console.log(
  `cosmetic: ${cosmetic.generic.length} generic, ${cosmetic.genericExcept.length} generic with exceptions, ` +
    `${Object.keys(cosmetic.specific).length} sites`,
);
console.log(`total network rules: ${totalRules} (guaranteed quota ${GUARANTEED_STATIC_RULES}, popunder list not included)`);
