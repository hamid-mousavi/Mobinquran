import { describe, it, expect } from 'vitest';
import { HELP_CACHE_TTL_MS, HelpCacheMap, parseHelpCache, pruneHelpCache } from '../services/memorization/helpCache';
import type { HelpResult } from '../services/memorization/helpTypes';

const result: HelpResult = { linkToPrevious: '', keywordIndexes: [1], memoryTip: 'نکته', confusions: [], practicePlan: '' };
const entry = (at: number) => ({ at, result });

describe('helpCache (Stage 3c)', () => {
  it('drops expired entries and keeps the newest up to the cap', () => {
    const now = 10 * HELP_CACHE_TTL_MS;
    const map: HelpCacheMap = {
      '1:1': entry(now - 1000),
      '1:2': entry(now - HELP_CACHE_TTL_MS - 1), // منقضی
      '1:3': entry(now - 500),
      '1:4': entry(now - 2000),
    };
    expect(Object.keys(pruneHelpCache(map, now))).toEqual(['1:3', '1:1', '1:4']);
    expect(Object.keys(pruneHelpCache(map, now, HELP_CACHE_TTL_MS, 2))).toEqual(['1:3', '1:1']);
  });

  it('parses stored JSON defensively', () => {
    expect(parseHelpCache(null)).toEqual({});
    expect(parseHelpCache([])).toEqual({});
    expect(parseHelpCache('x')).toEqual({});
    const parsed = parseHelpCache({
      '2:255': entry(5),
      'bad-key': entry(5),
      '3:4': { at: 'x', result },
      '5:6': { at: 1, result: { memoryTip: 3 } },
      '7:8': { at: 1, result: { ...result, confusions: 'no' } },
    });
    expect(Object.keys(parsed)).toEqual(['2:255']);
  });
});
