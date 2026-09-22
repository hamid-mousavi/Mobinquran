import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ALL_SURAHS } from '../data/surahs';

interface CoreVerse {
  id: number;
  surahId: number;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  hizbQuarter?: number;
  sajda?: { id: number; recommended: boolean; obligatory: boolean };
  textArabic: string;
}

interface CorePackage {
  id: string;
  version: string;
  verses: CoreVerse[];
}

describe('Mushaf Pages Validation (Phase 3 - P3-T4)', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/quran-core-v1.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data: CorePackage = JSON.parse(rawData);
  const verses: CoreVerse[] = data.verses;

  // گروه‌بندی بر اساس صفحه و مرتب‌کردن بر اساس ترتیب قرائت (id)
  const byPage = new Map<number, CoreVerse[]>();
  const pageList: number[] = [];
  for (const v of verses) {
    if (!byPage.has(v.pageNumber)) {
      byPage.set(v.pageNumber, []);
      pageList.push(v.pageNumber);
    }
    byPage.get(v.pageNumber)!.push(v);
  }
  pageList.sort((a, b) => a - b);
  for (const arr of byPage.values()) {
    arr.sort((a, b) => a.id - b.id);
  }

  it('covers all 604 pages with at least one verse each and no gaps', () => {
    expect(pageList.length).toBe(604);
    expect(pageList[0]).toBe(1);
    expect(pageList[pageList.length - 1]).toBe(604);
    for (let p = 1; p <= 604; p++) {
      const arr = byPage.get(p);
      expect(arr).toBeDefined();
      expect(arr!.length).toBeGreaterThan(0);
    }
  });

  it('first page starts with Al-Fatiha 1:1 and last page ends with An-Nas 114:6', () => {
    const first = byPage.get(1)![0];
    const last = byPage.get(604)![byPage.get(604)!.length - 1];
    expect(first.surahId).toBe(1);
    expect(first.verseNumber).toBe(1);
    expect(last.surahId).toBe(114);
    expect(last.verseNumber).toBe(6);
  });

  it('page numbers are non-decreasing and never skip in reading order', () => {
    for (let i = 1; i < verses.length; i++) {
      const prev = verses[i - 1].pageNumber;
      const curr = verses[i].pageNumber;
      expect(curr).toBeGreaterThanOrEqual(prev);
      expect(curr - prev).toBeLessThanOrEqual(1);
    }
  });

  it('total verses across all pages equals 6236', () => {
    const total = [...byPage.values()].reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(6236);
  });

  it('verses of the same surah on a page are consecutive (no missing verse numbers)', () => {
    for (const arr of byPage.values()) {
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const curr = arr[i];
        if (prev.surahId === curr.surahId) {
          expect(curr.verseNumber).toBe(prev.verseNumber + 1);
        } else {
          // شروع سورهٔ جدید همیشه آیهٔ ۱ است
          expect(curr.verseNumber).toBe(1);
        }
      }
    }
  });

  it('first verse of each surah lands exactly on its ALL_SURAHS startPage', () => {
    const surahStartPage = new Map<number, number>();
    for (const v of verses) {
      if (v.verseNumber === 1) surahStartPage.set(v.surahId, v.pageNumber);
    }
    expect(surahStartPage.size).toBe(114);
    for (const s of ALL_SURAHS) {
      expect(surahStartPage.get(s.id)).toBe(s.startPage);
    }
  });

  it('juz labels are non-decreasing and cover 1..30 exactly once per change', () => {
    const seen = new Set<number>();
    for (let i = 0; i < verses.length; i++) {
      const j = verses[i].juzNumber;
      seen.add(j);
      if (i > 0) {
        expect(j).toBeGreaterThanOrEqual(verses[i - 1].juzNumber);
      }
    }
    expect(seen.size).toBe(30);
    for (let j = 1; j <= 30; j++) expect(seen.has(j)).toBe(true);
  });

  it('hizbQuarter labels are non-decreasing where present', () => {
    for (let i = 1; i < verses.length; i++) {
      const prev = verses[i - 1].hizbQuarter ?? 0;
      const curr = verses[i].hizbQuarter ?? 0;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('contained sajda verses are exactly the 15 documented ones (4 obligatory)', () => {
    const sajdaList = verses.filter((v) => v.sajda);
    expect(sajdaList.length).toBe(15);

    const sajdaIds = sajdaList.map((v) => v.id).sort((a, b) => a - b);
    expect(sajdaIds).toEqual([
      1160, 1722, 1951, 2138, 2308, 2613, 2672, 2915, 3185, 3518, 3994, 4256, 4846, 5905, 6125,
    ]);

    const obligatory = sajdaList.filter((v) => v.sajda!.obligatory);
    expect(obligatory.map((v) => v.id).sort((a, b) => a - b)).toEqual([3518, 4256, 4846, 6125]);

    // هیچ آیه‌ای نباید همزمان هم مستحب و هم واجب باشد
    for (const v of sajdaList) {
      expect(v.sajda!.obligatory && v.sajda!.recommended).toBe(false);
    }
  });
});