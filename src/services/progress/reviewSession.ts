/**
 * خلاصه‌سازی جلسهٔ مرور (مرحلهٔ ۱ب) — خالص و تست‌پذیر.
 * هر پاسخ «تثبیت شد/سخت بود» موفق و «نیاز به تکرار» ناموفق شمرده می‌شود.
 */

import type { ReviewGrade } from './progressCore';

export interface SessionResult {
  surahId: number;
  surahName: string;
  verseNumber: number;
  grade: ReviewGrade;
}

export interface SessionTotals {
  total: number;
  again: number;
  hard: number;
  good: number;
}

export interface SurahSessionRecord {
  surahId: number;
  surahNameArabic: string;
  range: { start: number; end: number };
  correct: number;
  wrong: number;
}

export function totalsOf(results: readonly SessionResult[]): SessionTotals {
  const t: SessionTotals = { total: results.length, again: 0, hard: 0, good: 0 };
  for (const r of results) t[r.grade] += 1;
  return t;
}

export function groupBySurah(results: readonly SessionResult[]): SurahSessionRecord[] {
  const map = new Map<number, SurahSessionRecord>();
  for (const r of results) {
    const cur = map.get(r.surahId) ?? {
      surahId: r.surahId,
      surahNameArabic: r.surahName,
      range: { start: r.verseNumber, end: r.verseNumber },
      correct: 0,
      wrong: 0,
    };
    cur.range.start = Math.min(cur.range.start, r.verseNumber);
    cur.range.end = Math.max(cur.range.end, r.verseNumber);
    if (r.grade === 'again') cur.wrong += 1;
    else cur.correct += 1;
    map.set(r.surahId, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.surahId - b.surahId);
}
