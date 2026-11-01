import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const keys = (lang: string) =>
  Object.keys(JSON.parse(readFileSync(`public/_locales/${lang}/messages.json`, 'utf8'))).sort();

describe('locales', () => {
  it('fr and en define exactly the same keys', () => {
    expect(keys('en')).toEqual(keys('fr'));
  });

  it('every key used by the popup exists', () => {
    const html = readFileSync('entrypoints/popup/index.html', 'utf8');
    const script = readFileSync('entrypoints/popup/main.ts', 'utf8');
    const used = [
      ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...script.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...script.matchAll(/'(site(?:On|Off))'/g)].map((m) => m[1]),
    ];
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((k) => !keys('fr').includes(k!))).toEqual([]);
  });
});
