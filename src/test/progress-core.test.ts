import { describe, it, expect } from 'vitest';
import {
  addDaysToKey,
  addToReview,
  applyReviewResult,
  buildFromLegacy,
  createProgress,
  intervalDaysForBox,
  isDue,
  isEmptyProgress,
  makeKey,
  memorizedCountsBySurah,
  mergeProgress,
  parseKey,
  removeFromReview,
  sanitizeProgress,
  setMemorized,
} from '../services/progress/progressCore';

const TODAY = '2026-10-18';
const NOW = 1_800_000_000_000;

describe('progressCore — keys and dates (Stage 0)', () => {
  it('parses valid keys and rejects invalid ones', () => {
    expect(parseKey('2:255')).toEqual({ surahId: 2, verseNumber: 255 });
    expect(parseKey('114:6')).toEqual({ surahId: 114, verseNumber: 6 });
    for (const bad of ['0:1', '115:1', '2:0', '2:287', '2:', 'a:b', '2-255', '', null, 5, undefined]) {
      expect(parseKey(bad as unknown)).toBeNull();
    }
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDaysToKey('2026-10-18', 1)).toBe('2026-10-19');
    expect(addDaysToKey('2026-10-18', 30)).toBe('2026-11-17');
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('progressCore — Leitner scheduling parity with the legacy deck', () => {
  it('walks boxes 1→5 with 3/7/14/30-day intervals and caps at box 5', () => {
    let p = addToReview(createProgress(2, 255, NOW), 'البَقَرَة', true, TODAY, NOW);
    expect(p.inReview).toBe(true);
    expect(p.box).toBe(1);
    expect(p.nextReviewDate).toBe(TODAY);

    p = applyReviewResult(p, true, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([2, '2026-10-21']);
    p = applyReviewResult(p, true, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([3, '2026-10-25']);
    p = applyReviewResult(p, true, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([4, '2026-11-01']);
    p = applyReviewResult(p, true, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([5, '2026-11-17']);
    p = applyReviewResult(p, true, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([5, '2026-11-17']); // سقف جعبه
    expect(p.reps).toBe(5);
    expect(p.lapses).toBe(0);
  });

  it('a wrong answer returns to box 1 for tomorrow and counts a lapse', () => {
    let p = addToReview(createProgress(1, 1, NOW), 'الفاتحة', true, TODAY, NOW);
    p = applyReviewResult(p, true, TODAY, NOW);
    p = applyReviewResult(p, false, TODAY, NOW);
    expect([p.box, p.nextReviewDate, p.lapses]).toEqual([1, '2026-10-19', 1]);
  });

  it('re-adding an ayah that is already in the deck resets it to box 1 (legacy behaviour)', () => {
    let p = addToReview(createProgress(1, 2, NOW), 'الفاتحة', true, TODAY, NOW);
    p = applyReviewResult(p, true, TODAY, NOW);
    p = applyReviewResult(p, true, TODAY, NOW);
    expect(p.box).toBe(3);
    p = addToReview(p, 'الفاتحة', false, TODAY, NOW);
    expect([p.box, p.nextReviewDate]).toEqual([1, '2026-10-19']);
  });

  it('ignores review answers for ayahs that are not in the deck', () => {
    const p = createProgress(1, 3, NOW);
    expect(applyReviewResult(p, true, TODAY, NOW)).toBe(p);
  });

  it('knows when an ayah is due', () => {
    const p = addToReview(createProgress(1, 4, NOW), undefined, false, TODAY, NOW);
    expect(isDue(p, TODAY)).toBe(false);
    expect(isDue(p, '2026-10-19')).toBe(true);
    expect(isDue(createProgress(1, 5, NOW), TODAY)).toBe(false);
  });

  it('exposes the interval table', () => {
    expect([2, 3, 4, 5, 6].map(intervalDaysForBox)).toEqual([3, 7, 14, 30, 30]);
  });
});

describe('progressCore — memorized state and empty records', () => {
  it('keeps a record while memorized or in review, drops it when both are false', () => {
    let p = setMemorized(createProgress(2, 1, NOW), true, NOW);
    expect(isEmptyProgress(p)).toBe(false);
    p = addToReview(p, 'البقرة', true, TODAY, NOW);
    p = setMemorized(p, false, NOW);
    expect(isEmptyProgress(p)).toBe(false); // هنوز در مرور
    p = removeFromReview(p, NOW);
    expect(isEmptyProgress(p)).toBe(true);
  });

  it('removing from review keeps the memorized flag', () => {
    let p = setMemorized(createProgress(2, 2, NOW), true, NOW);
    p = addToReview(p, 'البقرة', true, TODAY, NOW);
    p = removeFromReview(p, NOW);
    expect(p.memorized).toBe(true);
    expect(p.inReview).toBe(false);
    expect(p.nextReviewDate).toBeUndefined();
  });

  it('counts memorized ayahs per surah', () => {
    const records = [
      setMemorized(createProgress(1, 1, NOW), true, NOW),
      setMemorized(createProgress(1, 2, NOW), true, NOW),
      setMemorized(createProgress(2, 1, NOW), true, NOW),
      addToReview(createProgress(3, 1, NOW), 'آل عمران', true, TODAY, NOW), // مرور، نه حفظ
    ];
    const counts = memorizedCountsBySurah(records);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
    expect(counts.has(3)).toBe(false);
  });
});

describe('progressCore — legacy migration', () => {
  it('merges memorized keys and the review deck into single records', () => {
    const out = buildFromLegacy(
      ['2:255', '112:1'],
      [
        { id: '2:255', surahId: 2, surahNameArabic: 'البَقَرَة', verseNumber: 255, addedAt: 123, box: 3, nextReviewDate: '2026-11-01' },
        { id: '94:5', surahId: 94, surahNameArabic: 'الشَّرْح', verseNumber: 5, addedAt: 456, box: 1, nextReviewDate: TODAY },
      ],
      NOW,
      TODAY
    );
    const byKey = new Map(out.map((r) => [r.key, r]));
    expect(out).toHaveLength(3);

    const both = byKey.get('2:255')!;
    expect(both.memorized).toBe(true);
    expect(both.inReview).toBe(true);
    expect([both.box, both.nextReviewDate, both.addedAt]).toEqual([3, '2026-11-01', 123]);

    expect(byKey.get('112:1')).toMatchObject({ memorized: true, inReview: false });
    expect(byKey.get('94:5')).toMatchObject({ memorized: false, inReview: true, surahNameArabic: 'الشَّرْح' });
  });

  it('survives garbage input without throwing and clamps odd values', () => {
    expect(buildFromLegacy(null, undefined, NOW, TODAY)).toEqual([]);
    expect(buildFromLegacy('nope', { a: 1 }, NOW, TODAY)).toEqual([]);

    const out = buildFromLegacy(
      ['bad', '999:1', 7, '3:4'],
      [null, 5, { id: 'x' }, { id: '5:5', box: 99, nextReviewDate: 'yesterday' }, { id: '6:6', box: -4, nextReviewDate: '2026-12-01' }],
      NOW,
      TODAY
    );
    const byKey = new Map(out.map((r) => [r.key, r]));
    expect([...byKey.keys()].sort()).toEqual(['3:4', '5:5', '6:6']);
    expect([byKey.get('5:5')!.box, byKey.get('5:5')!.nextReviewDate]).toEqual([5, TODAY]);
    expect(byKey.get('6:6')!.box).toBe(1);
  });

  it('sanitizes untrusted records and rejects empty ones', () => {
    expect(sanitizeProgress({ key: '2:255', memorized: true }, TODAY, NOW)).toMatchObject({
      key: '2:255',
      surahId: 2,
      verseNumber: 255,
      memorized: true,
      inReview: false,
    });
    expect(sanitizeProgress({ key: '2:255', memorized: false, inReview: false }, TODAY, NOW)).toBeNull();
    expect(sanitizeProgress({ key: '500:1', memorized: true }, TODAY, NOW)).toBeNull();
    expect(sanitizeProgress('x', TODAY, NOW)).toBeNull();
    const r = sanitizeProgress({ surahId: 5, verseNumber: 6, inReview: true, box: 8, reps: -3 }, TODAY, NOW)!;
    expect([r.key, r.box, r.reps, r.nextReviewDate]).toEqual(['5:6', 5, 0, TODAY]);
  });

  it('merge keeps the most recently updated record', () => {
    const older = { ...createProgress(1, 1, 100), memorized: true, updatedAt: 100 };
    const newer = { ...older, memorized: false, inReview: true, updatedAt: 200 };
    expect(mergeProgress(undefined, older)).toBe(older);
    expect(mergeProgress(older, newer)).toBe(newer);
    expect(mergeProgress(newer, older)).toBe(newer);
    expect(makeKey(1, 1)).toBe('1:1');
  });
});
