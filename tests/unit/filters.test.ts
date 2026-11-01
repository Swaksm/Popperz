import { describe, expect, it } from 'vitest';
import { convertNetworkFilter, isComment, isCosmeticFilter } from '@/lib/filters/network';

const rule = (line: string) => {
  const result = convertNetworkFilter(line);
  if (!('rule' in result)) throw new Error(`skipped: ${result.skipped}`);
  return result.rule;
};

describe('convertNetworkFilter', () => {
  it('blocks a domain anchor as-is', () => {
    expect(rule('||popads.net^')).toEqual({
      priority: 1, action: { type: 'block' }, condition: { urlFilter: '||popads.net^' },
    });
  });
  it('maps third-party and resource types', () => {
    expect(rule('||ads.example^$third-party,script,~image').condition).toEqual({
      urlFilter: '||ads.example^', domainType: 'thirdParty', resourceTypes: ['script'],
    });
  });
  it('uses excluded types when only negations are given', () => {
    expect(rule('/banner/*$~xmlhttprequest').condition.excludedResourceTypes).toEqual(['xmlhttprequest']);
  });
  it('maps domain= into initiator domains', () => {
    expect(rule('/ad.js$domain=site.test|~safe.site.test').condition).toMatchObject({
      initiatorDomains: ['site.test'], excludedInitiatorDomains: ['safe.site.test'],
    });
  });
  it('turns exceptions into allow rules that beat blocks, and $important blocks above them', () => {
    expect(rule('@@||cdn.example^$script')).toMatchObject({ priority: 2, action: { type: 'allow' } });
    expect(rule('||tracker.example^$important').priority).toBe(3);
  });
  it('turns $document exceptions into allowAllRequests', () => {
    expect(rule('@@||trusted.example^$document')).toMatchObject({
      action: { type: 'allowAllRequests' }, condition: { resourceTypes: ['main_frame', 'sub_frame'] },
    });
  });
  it('skips what DNR cannot express', () => {
    expect(convertNetworkFilter('/ads[0-9]+/')).toEqual({ skipped: 'regex' });
    expect(convertNetworkFilter('||site.test^$csp=script-src none')).toEqual({ skipped: 'option:csp' });
    expect(convertNetworkFilter('||site.test^$popup')).toEqual({ skipped: 'option:popup' });
    expect(convertNetworkFilter('/ad$domain=example.*')).toEqual({ skipped: 'domain-unsupported' });
    expect(convertNetworkFilter('@@||site.test^$elemhide')).toEqual({ skipped: 'cosmetic-exception' });
    expect(convertNetworkFilter('$third-party')).toEqual({ skipped: 'too-broad' });
  });
});

describe('line classification', () => {
  it('recognises comments, headers and cosmetic filters', () => {
    expect(isComment('! Title: EasyList')).toBe(true);
    expect(isComment('[Adblock Plus 2.0]')).toBe(true);
    expect(isCosmeticFilter('##.ad-banner')).toBe(true);
    expect(isCosmeticFilter('site.test#@#.ad')).toBe(true);
    expect(isCosmeticFilter('||site.test^')).toBe(false);
  });
});
