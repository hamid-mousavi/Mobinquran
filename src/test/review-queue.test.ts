import { describe, it, expect } from 'vitest';
import {
  AyahProgress,
  DEFAULT_DAILY_REVIEW_LIMIT,
  LEECH_LAPSES,
  addToReview,
  applyReviewGrade,
  buildReviewQueue,
  clampDailyLimit,
  createProgress,
  daysBetween,
  enrollForReview,
  isLeech,
  lapseFactor,
  overdueDays,
  setMemorized,
  spreadDueDate,
} from '../services/progress/progressCore';

const TODAY = '2026-10-18';
const NOW = 1_800_000_000_000;

function inReview(surah: number, verse: number, box: number, due: string, lapses = 0): AyahProgress {
  return { ...enrollForReview(createProgress(surah, verse, NOW), 'س', due, NOW), box, lapses };
}

describe('review grades (Stage 1a)', () => {
  it('"hard" keeps the box and brings the next review closer', () => {
    const p = inReview(2, 1, 3, TODAY);
    const out = applyReviewGrade(p, 'hard', TODAY, NOW);
    expect([out.box, out.nextReviewDate, out.reps, out.lapses]).toEqual([3, '2026-10-21', 0, 0]);
    expect(applyReviewGrade(inReview(2, 2, 1, TODAY), 'hard', TODAY, NOW).nextReviewDate).toBe('2026-10-19');
    expect(applyReviewGrade(inReview(2, 3, 5, TODAY), 'hard', TODAY, NOW).nextReviewDate).toBe('2026-10-30');
  });

  it('"good" shortens intervals for ayahs that were forgotten before', () => {
    expect([0, 1, 2, 3, 4, 9].map(lapseFactor)).toEqual([1, 1, 0.7, 0.7, 0.5, 0.5]);
    const fresh = applyReviewGrade(inReview(1, 1, 2, TODAY, 0), 'good', TODAY, NOW); // → جعبه ۳: ۷ روز
    const shaky = applyReviewGrade(inReview(1, 2, 2, TODAY, 2), 'good', TODAY, NOW); // ۷×۰٫۷ ≈ ۵
    const leech = applyReviewGrade(inReview(1, 3, 2, TODAY, 4), 'good', TODAY, NOW); // ۷×۰٫۵ ≈ ۴
    expect(fresh.nextReviewDate).toBe('2026-10-25');
    expect(shaky.nextReviewDate).toBe('2026-10-23');
    expect(leech.nextReviewDate).toBe('2026-10-22');
    expect(shaky.box).toBe(3);
  });

  it('"again" resets to box 1 for tomorrow and flags leeches after repeated lapses', () => {
    let p = inReview(3, 1, 4, TODAY);
    for (let i = 0; i < LEECH_LAPSES; i++) p = applyReviewGrade(p, 'again', TODAY, NOW);
    expect([p.box, p.nextReviewDate, p.lapses]).toEqual([1, '2026-10-19', LEECH_LAPSES]);
    expect(isLeech(p)).toBe(true);
    expect(isLeech({ ...p, inReview: false })).toBe(false);
  });

  it('never lets an interval fall below one day', () => {
    const p = applyReviewGrade(inReview(1, 5, 1, TODAY, 9), 'good', TODAY, NOW);
    expect(daysBetween(TODAY, p.nextReviewDate!) >= 1).toBe(true);
  });
});

describe('daily review queue (Stage 1a)', () => {
  it('measures overdue days and date differences', () => {
    expect(daysBetween('2026-10-18', '2026-10-21')).toBe(3);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(overdueDays(inReview(1, 1, 1, '2026-10-10'), TODAY)).toBe(8);
    expect(overdueDays(inReview(1, 1, 1, '2026-10-25'), TODAY)).toBe(0);
  });

  it('caps the day, reports what was deferred, and orders by most overdue first', () => {
    const records = [
      inReview(2, 10, 3, '2026-10-17'), // ۱ روز تأخیر
      inReview(2, 11, 1, '2026-10-10'), // ۸ روز تأخیر
      inReview(2, 12, 2, TODAY), //        امروز
      inReview(2, 13, 5, '2026-10-25'), // هنوز موعدش نرسیده
      createProgress(2, 14, NOW), //       اصلاً در مرور نیست
    ];
    const q = buildReviewQueue(records, TODAY, 5); // کمینهٔ سقف = ۵ → همه جا می‌شوند
    expect(q.items.map((r) => r.verseNumber)).toEqual([11, 10, 12]);
    expect([q.totalDue, q.deferred, q.overdue]).toEqual([3, 0, 2]);
  });

  it('defers the rest when the backlog exceeds the daily limit', () => {
    const backlog: AyahProgress[] = [];
    for (let v = 1; v <= 40; v++) backlog.push(inReview(2, v, 1, TODAY));
    const q = buildReviewQueue(backlog, TODAY, 10);
    expect(q.items).toHaveLength(10);
    expect([q.totalDue, q.deferred]).toEqual([40, 30]);
    expect(q.items[0].verseNumber).toBe(1); // هم‌رتبه‌ها: ترتیب مصحف
  });

  it('breaks ties by lower box, then more lapses', () => {
    const a = inReview(5, 1, 3, TODAY);
    const b = inReview(5, 2, 1, TODAY);
    const c = { ...inReview(5, 3, 1, TODAY), lapses: 3 };
    expect(buildReviewQueue([a, b, c], TODAY, 10).items.map((r) => r.verseNumber)).toEqual([3, 2, 1]);
  });

  it('clamps the daily limit to a sane range', () => {
    expect(clampDailyLimit(0)).toBe(5);
    expect(clampDailyLimit(1000)).toBe(100);
    expect(clampDailyLimit(30)).toBe(30);
    expect(clampDailyLimit('x')).toBe(DEFAULT_DAILY_REVIEW_LIMIT);
    expect(clampDailyLimit(NaN)).toBe(DEFAULT_DAILY_REVIEW_LIMIT);
  });
});

describe('staggered enrollment (Stage 1a)', () => {
  it('spreads many newly memorized ayahs across days instead of one big queue', () => {
    const days = [0, 19, 20, 39, 40].map((i) => spreadDueDate(TODAY, i, 20));
    expect(days).toEqual(['2026-10-19', '2026-10-19', '2026-10-20', '2026-10-20', '2026-10-21']);
    expect(spreadDueDate(TODAY, 0, 20, 0)).toBe(TODAY);
  });

  it('enrolling keeps the memorized flag and starts in box 1', () => {
    const memorized = setMemorized(createProgress(2, 255, NOW), true, NOW);
    const p = enrollForReview(memorized, 'البقرة', '2026-10-19', NOW);
    expect([p.memorized, p.inReview, p.box, p.nextReviewDate, p.surahNameArabic]).toEqual([
      true, true, 1, '2026-10-19', 'البقرة',
    ]);
    // رفتار قدیمی «افزودن دستی» دست‌نخورده می‌ماند
    expect(addToReview(p, 'البقرة', true, TODAY, NOW).nextReviewDate).toBe(TODAY);
  });
});
