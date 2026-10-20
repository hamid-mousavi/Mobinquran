import { describe, it, expect } from 'vitest';
import {
  REFLECTION_QUESTIONS,
  consecutiveDays,
  dailyPoolIndex,
  dayNumber,
  isDoneOn,
  parseLog,
  questionFor,
  upsertEntry,
} from '../services/tadabbur/tadabburCore';
import { addDaysToKey } from '../services/progress/progressCore';

const e = (date: string, surahId = 2, verseNumber = 255) => ({ date, surahId, verseNumber });

describe('tadabburCore — daily ayah (Stage 4b)', () => {
  it('is stable within a day and always inside the pool', () => {
    expect(dailyPoolIndex('2026-10-20', 54)).toBe(dailyPoolIndex('2026-10-20', 54));
    for (let i = 0; i < 400; i++) {
      const idx = dailyPoolIndex(addDaysToKey('2026-01-01', i), 54);
      expect(idx >= 0 && idx < 54).toBe(true);
    }
    expect(dailyPoolIndex('2026-10-20', 0)).toBe(0);
  });

  it('never repeats within one full cycle and differs from day to day', () => {
    const n = 54;
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) seen.add(dailyPoolIndex(addDaysToKey('2026-03-01', i), n));
    expect(seen.size).toBe(n);
    expect(dailyPoolIndex('2026-10-20', n) === dailyPoolIndex('2026-10-21', n)).toBe(false);
  });

  it('counts days independent of daylight saving', () => {
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-29')).toBe(1);
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-25')).toBe(1);
  });

  it('picks a stable question that changes with the day or ayah', () => {
    const q = questionFor('2026-10-20', 2, 255);
    expect(REFLECTION_QUESTIONS.includes(q)).toBe(true);
    expect(questionFor('2026-10-20', 2, 255)).toBe(q);
    const variety = new Set<string>();
    for (let i = 0; i < 30; i++) variety.add(questionFor(addDaysToKey('2026-10-01', i), 2, 255));
    expect(variety.size).toBeGreaterThan(3);
  });
});

describe('tadabburCore — journal log (Stage 4b)', () => {
  it('keeps one entry per day, newest first, and replaces a same-day entry', () => {
    let log = [e('2026-10-18'), e('2026-10-20')];
    log = upsertEntry(log, e('2026-10-19', 13, 28));
    expect(log.map((x) => x.date)).toEqual(['2026-10-20', '2026-10-19', '2026-10-18']);
    log = upsertEntry(log, e('2026-10-19', 94, 5));
    expect(log).toHaveLength(3);
    expect(log.find((x) => x.date === '2026-10-19')).toMatchObject({ surahId: 94, verseNumber: 5 });
    expect(upsertEntry(log, e('2026-10-21'), 2)).toHaveLength(2);
  });

  it('parses stored data defensively', () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog('x')).toEqual([]);
    const out = parseLog([
      e('2026-10-18'),
      e('2026-10-18', 3, 4), // تاریخ تکراری
      { date: 'bad', surahId: 1, verseNumber: 1 },
      { date: '2026-10-17', surahId: 0, verseNumber: 1 },
      { date: '2026-10-16', surahId: 2, verseNumber: 1.5 },
      null,
      e('2026-10-19', 112, 1),
    ]);
    expect(out.map((x) => x.date)).toEqual(['2026-10-19', '2026-10-18']);
  });

  it('counts consecutive days and keeps the streak alive until the end of today', () => {
    const log = [e('2026-10-20'), e('2026-10-19'), e('2026-10-18'), e('2026-10-15')];
    expect(consecutiveDays(log, '2026-10-20')).toBe(3);
    expect(consecutiveDays(log.slice(1), '2026-10-20')).toBe(2); // امروز هنوز انجام نشده، رشته نشکسته
    expect(consecutiveDays([e('2026-10-17')], '2026-10-20')).toBe(0);
    expect(consecutiveDays([], '2026-10-20')).toBe(0);
    expect(isDoneOn(log, '2026-10-19')).toBe(true);
    expect(isDoneOn(log, '2026-10-17')).toBe(false);
  });
});
