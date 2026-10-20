import { describe, it, expect } from 'vitest';
import {
  applyPlanEdit,
  buildPlan,
  dayStates,
  daysForType,
  ensureSinglePrimary,
  normalizeTitle,
  pickPrimaryId,
  planGlance,
  sanitizeStartDate,
} from '../utils/khatmPlans';
import { buildKhatmSegments } from '../utils/khatmMath';
import type { KhatmPlan } from '../types';

const TODAY = '2026-10-18';
const NOW = 1_800_000_000_000;
const custom = (days: number) => buildKhatmSegments('custom', days, [], []).segments;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const plan = (over: Partial<KhatmPlan> = {}): KhatmPlan => ({
  id: 'p1', title: 'x', type: 'custom', startDate: TODAY, targetDays: 30, totalPages: 604,
  completedPages: [], currentDay: 1, isActive: false, ...over,
});

describe('khatmPlans — create/update rules', () => {
  it('builds a plan from a template or a clamped custom length', () => {
    expect(daysForType('ramadan_30')).toBe(30);
    expect(daysForType('arbaeen_40')).toBe(40);
    expect(daysForType('hizb_120')).toBe(120);
    expect(daysForType('custom', 3)).toBe(10);
    expect(daysForType('custom', 9999)).toBe(365);
    expect(daysForType('custom', 45.4)).toBe(45);
    const p = buildPlan({ type: 'ramadan_30' }, TODAY, NOW);
    expect([p.id, p.targetDays, p.startDate, p.isActive, p.completedPages.length]).toEqual([`plan_${NOW}`, 30, TODAY, false, 0]);
    expect(p.title).toContain('۳۰');
  });

  it('normalizes titles and start dates', () => {
    expect(normalizeTitle('  ختم   من  ', 'پیش‌فرض')).toBe('ختم من');
    expect(normalizeTitle('   ', 'پیش‌فرض')).toBe('پیش‌فرض');
    expect(normalizeTitle(42, 'پیش‌فرض')).toBe('پیش‌فرض');
    expect(normalizeTitle('ا'.repeat(200), 'f')).toHaveLength(80);
    expect(sanitizeStartDate('2026-10-01', TODAY)).toBe('2026-10-01');
    expect(sanitizeStartDate('2026-10-19', TODAY)).toBe(TODAY); // آینده
    expect(sanitizeStartDate('2026-02-31', TODAY)).toBe(TODAY); // تاریخ ناممکن
    expect(sanitizeStartDate('yesterday', TODAY)).toBe(TODAY);
    expect(sanitizeStartDate(undefined, TODAY)).toBe(TODAY);
  });

  it('edits: title and start for any plan, length only for custom plans', () => {
    const c = plan({ type: 'custom', targetDays: 30 });
    expect(applyPlanEdit(c, { title: 'نو', targetDays: 50, startDate: '2026-10-10' }, TODAY)).toMatchObject({
      title: 'نو', targetDays: 50, startDate: '2026-10-10',
    });
    const t = plan({ type: 'ramadan_30', targetDays: 30 });
    expect(applyPlanEdit(t, { targetDays: 99 }, TODAY).targetDays).toBe(30);
    expect(applyPlanEdit(c, { title: '  ' }, TODAY).title).toBe('x'); // خالی ← عنوان قبلی
    expect(applyPlanEdit(c, {}, TODAY)).toEqual(c);
  });

  it('keeps exactly one primary plan', () => {
    const plans = [plan({ id: 'a', isActive: true }), plan({ id: 'b', isActive: true }), plan({ id: 'c' })];
    expect(ensureSinglePrimary(plans, 'c').map((p) => p.isActive)).toEqual([false, false, true]);
    expect(ensureSinglePrimary(plans, null).every((p) => !p.isActive)).toBe(true);
    expect(pickPrimaryId(plans)).toBe('a');
    expect(pickPrimaryId([plan({ id: 'z' })])).toBe('z');
    expect(pickPrimaryId([])).toBeNull();
  });
});

describe('khatmPlans — at-a-glance state', () => {
  it('classifies each day for the strip', () => {
    const seg = custom(10);
    const done = [...range(seg[0].startPage, seg[0].endPage), ...range(seg[2].startPage, seg[2].startPage)];
    const st = dayStates(done, seg, 5);
    expect(st[0]).toBe('done');
    expect(st[1]).toBe('missed');
    expect(st[2]).toBe('partial');
    expect(st[3]).toBe('missed');
    expect(st[4]).toBe('today');
    expect(st[5]).toBe('future');
    const ahead = dayStates(range(seg[7].startPage, seg[7].endPage), seg, 5);
    expect(ahead[7]).toBe('done'); // جلو افتاده
  });

  it('summarizes a plan for the list card', () => {
    const seg = custom(30);
    const p = plan({ startDate: '2026-10-08', targetDays: 30, completedPages: range(1, seg[4].endPage) });
    const g = planGlance(p, seg, new Date(2026, 9, 18, 12)); // روز ۱۱ برنامه
    expect(g.currentDay).toBe(11);
    expect(g.totalDays).toBe(30);
    expect(g.completedCount).toBe(seg[4].endPage);
    expect(g.behindCount).toBe(seg[9].endPage - seg[4].endPage); // روزهای ۶ تا ۱۰
    expect(g.todayRange).toEqual({ start: seg[10].startPage, end: seg[10].endPage });
    expect(g.todayDone).toBe(false);
    expect(g.daysLeft).toBe(20);
    expect(g.isComplete).toBe(false);
    const all = planGlance(plan({ completedPages: range(1, 604) }), seg, new Date(2026, 9, 18, 12));
    expect([all.isComplete, all.percent, all.behindCount]).toEqual([true, 100, 0]);
  });
});
