import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DWELL_MS,
  initialPageViewState,
  leavePage,
  pendingCandidates,
  toRanges,
  viewPage,
} from '../services/khatm/pageViewCore';

const D = DEFAULT_DWELL_MS;

describe('pageViewCore (Stage 2)', () => {
  it('credits a page only after enough dwell time, when the reader moves on', () => {
    let s = initialPageViewState();
    s = viewPage(s, 12, 0);
    s = viewPage(s, 13, D + 1); // روی ۱۲ مانده بود
    expect(s.candidates).toEqual([12]);
    s = viewPage(s, 14, D + 1 + 3_000); // ۱۳ را فقط ۳ ثانیه دیده
    expect(s.candidates).toEqual([12]);
    expect(s.current).toBe(14);
  });

  it('does not credit fast page flipping', () => {
    let s = initialPageViewState();
    for (let p = 1; p <= 20; p++) s = viewPage(s, p, p * 1_500);
    expect(s.candidates).toEqual([]);
  });

  it('ignores repeated reports of the same page and invalid pages', () => {
    let s = viewPage(initialPageViewState(), 5, 0);
    const same = viewPage(s, 5, D * 10);
    expect(same).toBe(s); // زمان ورود تغییر نمی‌کند
    for (const bad of [0, 605, -1, 1.5, NaN]) expect(viewPage(s, bad, 1)).toBe(s);
  });

  it('credits the current page when leaving after a long stay, but not a short one', () => {
    let s = viewPage(initialPageViewState(), 40, 0);
    expect(leavePage(s, D + 1).candidates).toEqual([40]);
    expect(leavePage(s, 1_000).candidates).toEqual([]);
    expect(leavePage(s, D + 1).current).toBeNull();
    s = initialPageViewState();
    expect(leavePage(s, 5)).toBe(s);
  });

  it('keeps candidates sorted and unique', () => {
    let s = initialPageViewState([30, 10]);
    s = viewPage(s, 20, 0);
    s = viewPage(s, 10, D + 1); // ۲۰ اضافه می‌شود
    s = viewPage(s, 20, 2 * D + 5); // ۱۰ دوباره، تکراری
    expect(s.candidates).toEqual([10, 20, 30]);
  });

  it('removes pages that are already recorded in the khatm', () => {
    expect(pendingCandidates([3, 4, 5, 9], [4, 9])).toEqual([3, 5]);
    expect(pendingCandidates([700, 3], [])).toEqual([3]);
  });

  it('compresses pages into contiguous ranges', () => {
    expect(toRanges([12, 13, 14, 20, 22, 21])).toEqual([[12, 14], [20, 22]]);
    expect(toRanges([5, 5, 5])).toEqual([[5, 5]]);
    expect(toRanges([])).toEqual([]);
  });
});
