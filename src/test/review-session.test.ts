import { describe, it, expect } from 'vitest';
import { groupBySurah, totalsOf, SessionResult } from '../services/progress/reviewSession';

const r = (surahId: number, verseNumber: number, grade: SessionResult['grade']): SessionResult => ({
  surahId,
  surahName: `س${surahId}`,
  verseNumber,
  grade,
});

describe('reviewSession (Stage 1b)', () => {
  it('counts grades', () => {
    expect(totalsOf([r(1, 1, 'good'), r(1, 2, 'hard'), r(2, 5, 'again'), r(2, 6, 'good')])).toEqual({
      total: 4, again: 1, hard: 1, good: 2,
    });
    expect(totalsOf([])).toEqual({ total: 0, again: 0, hard: 0, good: 0 });
  });

  it('groups results per surah with verse range and success/failure counts', () => {
    const out = groupBySurah([
      r(36, 9, 'good'),
      r(2, 255, 'again'),
      r(36, 3, 'hard'),
      r(2, 256, 'good'),
      r(36, 12, 'again'),
    ]);
    expect(out.map((x) => x.surahId)).toEqual([2, 36]);
    expect(out[0]).toEqual({ surahId: 2, surahNameArabic: 'س2', range: { start: 255, end: 256 }, correct: 1, wrong: 1 });
    expect(out[1]).toEqual({ surahId: 36, surahNameArabic: 'س36', range: { start: 3, end: 12 }, correct: 2, wrong: 1 });
  });
});
