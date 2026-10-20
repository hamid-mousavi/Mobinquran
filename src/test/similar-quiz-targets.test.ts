import { describe, it, expect } from 'vitest';
import { prioritizeTargets } from '../services/memorization/similarQuizTargets';
import { mulberry32 } from '../services/memorization/similarQuiz';

const rec = (s: number, v: number, memorized: boolean, inReview: boolean, lapses = 0) => ({
  surahId: s, verseNumber: v, memorized, inReview, lapses,
});

describe('similarQuizTargets (Stage 4a)', () => {
  it('puts error-prone ayahs first, then review ones, then the rest of the memorized', () => {
    const out = prioritizeTargets(
      [rec(1, 1, true, false), rec(2, 1, true, true, 0), rec(3, 1, true, true, 4), rec(4, 1, false, true, 2), rec(5, 1, false, false)],
      mulberry32(1)
    ).map((r) => r.surahId);
    expect(out.slice(0, 2).sort()).toEqual([3, 4]); // پرخطا
    expect(out[2]).toBe(2); // در مرور
    expect(out[3]).toBe(1); // فقط حفظ‌شده
    expect(out).toHaveLength(4); // رکورد بی‌وضعیت نادیده گرفته شد
  });

  it('is deterministic for a seed and handles empty input', () => {
    const rows = Array.from({ length: 10 }, (_, i) => rec(2, i + 1, true, false));
    const a = prioritizeTargets(rows, mulberry32(4)).map((r) => r.verseNumber);
    const b = prioritizeTargets(rows, mulberry32(4)).map((r) => r.verseNumber);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(prioritizeTargets([], mulberry32(1))).toEqual([]);
  });
});
