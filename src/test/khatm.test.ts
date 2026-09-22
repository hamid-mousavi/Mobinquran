import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildKhatmSegments, segmentsFromBoundaries, KhatmSegment } from '../utils/khatmMath';
import { localDateKey, daysSinceStart, currentKhatmDay } from '../utils/date';

interface CoreVerse {
  id: number;
  surahId: number;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  hizbQuarter?: number;
}

describe('Khatm boundary math (Phase 3 - P3-T9)', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/quran-core-v1.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { verses: CoreVerse[] };
  const verses = data.verses;

  // مرزهای واقعی از دادهٔ بسته
  const juzStartPages: number[] = [];
  for (let j = 1; j <= 30; j++) {
    const v = verses.find((x) => x.juzNumber === j);
    juzStartPages.push(v?.pageNumber ?? 1);
  }
  const quarterStartPages: number[] = [];
  for (let q = 1; q <= 240; q++) {
    const v = verses.find((x) => x.hizbQuarter === q);
    quarterStartPages.push(v?.pageNumber ?? 1);
  }

  function expectSegmentsCoverClosed(segs: KhatmSegment[]) {
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].startPage).toBe(1);
    expect(segs[segs.length - 1].endPage).toBe(604);
    for (let i = 0; i < segs.length; i++) {
      expect(segs[i].day).toBe(i + 1);
      expect(segs[i].startPage).toBeLessThanOrEqual(segs[i].endPage);
      if (i > 0) {
        expect(segs[i].startPage).toBe(segs[i - 1].endPage + 1); // بدون فاصله یا هم‌پوشانی
      }
    }
  }

  it('30-day Ramadan plan maps each day to a real juz boundary from the dataset', () => {
    const { segments, perDayLabel } = buildKhatmSegments(
      'ramadan_30',
      30,
      juzStartPages,
      quarterStartPages
    );
    expect(segments.length).toBe(30);
    expect(perDayLabel).toContain('جزء');
    for (let i = 0; i < 30; i++) {
      expect(segments[i].startPage).toBe(juzStartPages[i]);
      expect(segments[i].label).toBe(`جزء ${i + 1}`);
    }
    expectSegmentsCoverClosed(segments);
  });

  it('120-day hizb plan produces 120 non-overlapping segments ending at page 604', () => {
    const { segments, perDayLabel } = buildKhatmSegments(
      'hizb_120',
      120,
      juzStartPages,
      quarterStartPages
    );
    expect(segments.length).toBe(120);
    expect(perDayLabel).toContain('ربع حزب');
    expectSegmentsCoverClosed(segments);
  });

  it('40-day plan produces 40 non-overlapping segments ending at page 604', () => {
    const { segments } = buildKhatmSegments('arbaeen_40', 40, juzStartPages, quarterStartPages);
    expect(segments.length).toBe(40);
    expectSegmentsCoverClosed(segments);
  });

  it('custom plan falls back to even split that still covers exactly 604 pages', () => {
    const { segments } = buildKhatmSegments('custom', 37, juzStartPages, quarterStartPages);
    expect(segments.length).toBe(37);
    expectSegmentsCoverClosed(segments);
  });

  it('segments from synthetic boundaries are monotonic and complete', () => {
    const segs = segmentsFromBoundaries([1, 10, 21, 50, 604], [1, 21], [1, 10, 50]);
    expect(segs.length).toBe(4);
    expect(segs.map((s) => s.startPage)).toEqual([1, 10, 21, 50]);
    expect(segs.map((s) => s.label)).toEqual(['جزء 1', 'ربع حزب 2', 'جزء 2', 'ربع حزب 3']);
    expectSegmentsCoverClosed(segs);
  });
});

describe('Local date helpers (Phase 3 - P3-T9)', () => {
  it('localDateKey produces YYYY-MM-DD from local time', () => {
    const d = new Date(2026, 8, 17, 23, 59, 59); // ۱۷ شهریور ۱۴۰۵
    expect(localDateKey(d)).toBe('2026-09-17');
  });

  it('daysSinceStart counts whole local days (today - start)', () => {
    const start = '2026-09-10';
    expect(daysSinceStart(start, new Date(2026, 8, 10, 0, 0))).toBe(0);
    expect(daysSinceStart(start, new Date(2026, 8, 12, 23, 59))).toBe(2);
    expect(daysSinceStart(start, new Date(2026, 9, 10))).toBe(30);
  });

  it('currentKhatmDay clamps to [1, targetDays]', () => {
    const start = '2026-09-10';
    expect(currentKhatmDay(start, 30, new Date(2026, 8, 9))).toBe(1); // قبل شروع: روز ۱
    expect(currentKhatmDay(start, 30, new Date(2026, 8, 10))).toBe(1);
    expect(currentKhatmDay(start, 30, new Date(2026, 8, 15))).toBe(6);
    expect(currentKhatmDay(start, 30, new Date(2026, 10, 1))).toBe(30); // بعد از پایان: روز آخر
  });
});