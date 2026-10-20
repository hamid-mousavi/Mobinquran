/**
 * کش محلی نتیجهٔ «کمک هوشمند حفظ» (مرحلهٔ ۳ج): هر آیه یک‌بار پرسیده می‌شود و سهمیه مصرف نمی‌کند.
 * خالص: فقط نگهداری، انقضا و سقف؛ خواندن/نوشتن localStorage در کلاینت انجام می‌شود.
 */

import type { HelpResult } from './helpTypes';

export interface HelpCacheEntry {
  at: number;
  result: HelpResult;
}

export type HelpCacheMap = Record<string, HelpCacheEntry>;

export const HELP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const HELP_CACHE_MAX = 100;

/** حذف منقضی‌ها و نگه‌داشتن تازه‌ترین‌ها تا سقف */
export function pruneHelpCache(
  entries: HelpCacheMap,
  now: number,
  ttlMs: number = HELP_CACHE_TTL_MS,
  max: number = HELP_CACHE_MAX
): HelpCacheMap {
  const alive = Object.entries(entries).filter(([, e]) => e && typeof e.at === 'number' && now - e.at <= ttlMs);
  alive.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(alive.slice(0, max));
}

/** ورودی ناشناخته (JSON خوانده‌شده) را به نقشهٔ معتبر تبدیل می‌کند */
export function parseHelpCache(raw: unknown): HelpCacheMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: HelpCacheMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{1,3}:\d{1,3}$/.test(key) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const r = v.result as Record<string, unknown> | undefined;
    if (typeof v.at !== 'number' || !r || typeof r.memoryTip !== 'string' || !Array.isArray(r.keywordIndexes) || !Array.isArray(r.confusions)) continue;
    out[key] = value as unknown as HelpCacheEntry;
  }
  return out;
}
