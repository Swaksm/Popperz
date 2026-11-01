// Dynamic DNR rules that switch network blocking off on disabled sites.
import type { DnrRule } from './filters/network';

// Above every list rule (block 1, allow 2, important 3).
const SITE_ALLOW_PRIORITY = 100;

export function siteAllowRules(disabled: readonly string[]): DnrRule[] {
  return disabled.map((site, i) => ({
    id: i + 1,
    priority: SITE_ALLOW_PRIORITY,
    action: { type: 'allowAllRequests' },
    condition: { requestDomains: [site], resourceTypes: ['main_frame', 'sub_frame'] },
  }));
}
