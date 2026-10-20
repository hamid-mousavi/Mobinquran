import { describe, it, expect } from 'vitest';
import { computeKhatmStatus, withPagesCompleted } from '../utils/khatmProgress';
import { buildKhatmSegments } from '../utils/khatmMath';

// ۶۰ روزهٔ سفارشی: بازه‌های هم‌تا روی ۶۰۴ صفحه (ورودی تهی برای مرزهای واقعی)
const custom = (days: number) => buildKhatmSegments('custom', days, [], []).segments;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('khatmProgress (Stage 2)', () => {
  it('is on schedule when every earlier day is done', () => {
    const seg = custom(60);
    const doneThrough = seg[9].endPage; // روزهای ۱ تا ۱۰ خوانده شده
    const s = computeKhatmStatus(range(1, doneThrough), seg, 11, 60);
    expect(s.isBehind).toBe(false);
    expect(s.catchUp).toBeNull();
    expect(s.behindPages).toEqual([]);
    expect(s.completedCount).toBe(doneThrough);
    expect(s.daysLeft).toBe(50);
  });

  it('measures the backlog and redistributes the remaining pages over the days left', () => {
    const seg = custom(60);
    // روز ۲۰ هستیم ولی فقط ۱۰ روز اول خوانده شده
    const doneThrough = seg[9].endPage;
    const s = computeKhatmStatus(range(1, doneThrough), seg, 20, 60);
    expect(s.isBehind).toBe(true);
    expect(s.behindPages[0]).toBe(doneThrough + 1);
    expect(s.behindPages[s.behindPages.length - 1]).toBe(seg[18].endPage); // تا پایان روز ۱۹
    expect(s.behindPages).toHaveLength(seg[18].endPage - doneThrough);
    expect(s.daysLeft).toBe(41); // ۶۰ − ۲۰ + ۱
    const remaining = 604 - doneThrough;
    expect(s.remainingPages).toBe(remaining);
    expect(s.catchUp!.quotaPerDay).toBe(Math.ceil(remaining / 41));
    expect(s.catchUp!.originalPerDay).toBe(11);
    expect(s.catchUp!.todayPages).toHaveLength(s.catchUp!.quotaPerDay);
    expect(s.catchUp!.todayPages[0]).toBe(doneThrough + 1);
    expect(s.firstUnreadPage).toBe(doneThrough + 1);
  });

  it('reads gaps correctly when pages were read out of order', () => {
    const seg = custom(10);
    const s = computeKhatmStatus([1, 2, 3, 100, 101], seg, 3, 10);
    expect(s.behindPages).not.toContain(1);
    expect(s.behindPages).toContain(4);
    expect(s.firstUnreadPage).toBe(4);
    expect(s.catchUp!.todayPages.slice(0, 3)).toEqual([4, 5, 6]);
  });

  it('handles the last day and a finished khatm', () => {
    const seg = custom(30);
    const last = computeKhatmStatus(range(1, 500), seg, 30, 30);
    expect(last.daysLeft).toBe(1);
    expect(last.catchUp!.quotaPerDay).toBe(104); // همهٔ باقی‌مانده در یک روز
    const done = computeKhatmStatus(range(1, 604), seg, 30, 30);
    expect(done.isComplete).toBe(true);
    expect(done.catchUp).toBeNull();
    expect(done.firstUnreadPage).toBeNull();
  });

  it('clamps an out-of-range day and ignores invalid pages', () => {
    const seg = custom(30);
    const s = computeKhatmStatus([0, 5, 5, 9999, -3], seg, 99, 30);
    expect(s.currentDay).toBe(30);
    expect(s.completedCount).toBe(1);
  });

  it('adds pages uniquely and in order, within the valid range', () => {
    expect(withPagesCompleted([5, 1], [3, 5, 700, 0, 2.5])).toEqual([1, 3, 5]);
  });
});
