import { describe, it, expect } from 'vitest';
import { ALL_SURAHS } from '../data/surahs';
import { JUZ_STARTS, computeJuzProgress, computeJuzTotals, juzOf } from '../services/progress/juzMap';

const counts = ALL_SURAHS.map((s) => s.versesCount);

describe('juzMap (Stage 1b)', () => {
  it('has 30 strictly increasing juz starts', () => {
    expect(JUZ_STARTS).toHaveLength(30);
    for (let i = 1; i < JUZ_STARTS.length; i++) {
      const [ps, pv] = JUZ_STARTS[i - 1];
      const [s, v] = JUZ_STARTS[i];
      expect(s > ps || (s === ps && v > pv)).toBe(true);
    }
  });

  it('maps boundary ayahs to the right juz', () => {
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1);
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(4, 147)).toBe(5);
    expect(juzOf(4, 148)).toBe(6);
    expect(juzOf(77, 50)).toBe(29);
    expect(juzOf(78, 1)).toBe(30);
    expect(juzOf(114, 6)).toBe(30);
  });

  it('totals cover every ayah of the Quran exactly once and match known juz sizes', () => {
    const totals = computeJuzTotals(counts);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6236);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(6236);
    expect(totals[0]).toBe(148);
    expect(totals[28]).toBe(431);
    expect(totals[29]).toBe(564);
  });

  it('computes per-juz memorized counts', () => {
    const totals = computeJuzTotals(counts);
    const progress = computeJuzProgress(
      [
        { surahId: 1, verseNumber: 1 },
        { surahId: 1, verseNumber: 2 },
        { surahId: 2, verseNumber: 142 },
        { surahId: 114, verseNumber: 1 },
      ],
      totals
    );
    expect(progress).toHaveLength(30);
    expect([progress[0].memorized, progress[0].total]).toEqual([2, 148]);
    expect(progress[1].memorized).toBe(1);
    expect(progress[29].memorized).toBe(1);
    expect(progress[5].memorized).toBe(0);
  });
});
