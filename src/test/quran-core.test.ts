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
  textArabic: string;
  translationMakarem: string;
  translationFooladvand: string;
  translationAnsarian: string;
}

interface CorePackage {
  id: string;
  version: string;
  verses: CoreVerse[];
}

describe('Quran Core Dataset Validation (Phase 0 - P0-T9)', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/quran-core-v1.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data: CorePackage = JSON.parse(rawData);

  it('contains exactly 6236 verses', () => {
    expect(data.verses.length).toBe(6236);
  });

  it('has continuous verse IDs from 1 to 6236', () => {
    for (let i = 0; i < data.verses.length; i++) {
      expect(data.verses[i].id).toBe(i + 1);
    }
  });

  it('contains all 114 surahs with matching verse counts', () => {
    const surahCounts: Record<number, number> = {};
    for (const v of data.verses) {
      surahCounts[v.surahId] = (surahCounts[v.surahId] || 0) + 1;
    }

    expect(Object.keys(surahCounts).length).toBe(114);

    for (const s of ALL_SURAHS) {
      expect(surahCounts[s.id]).toBe(s.versesCount);
    }
  });

  it('covers all 604 pages continuously from 1 to 604', () => {
    const pages = new Set<number>();
    for (const v of data.verses) {
      pages.add(v.pageNumber);
    }
    expect(pages.size).toBe(604);
    for (let p = 1; p <= 604; p++) {
      expect(pages.has(p)).toBe(true);
    }
  });

  it('covers all 30 juzs continuously from 1 to 30', () => {
    const juzs = new Set<number>();
    for (const v of data.verses) {
      juzs.add(v.juzNumber);
    }
    expect(juzs.size).toBe(30);
    for (let j = 1; j <= 30; j++) {
      expect(juzs.has(j)).toBe(true);
    }
  });

  it('has no empty strings in Arabic text or translations', () => {
    for (const v of data.verses) {
      expect(v.textArabic?.trim().length).toBeGreaterThan(0);
      expect(v.translationMakarem?.trim().length).toBeGreaterThan(0);
      expect(v.translationFooladvand?.trim().length).toBeGreaterThan(0);
      expect(v.translationAnsarian?.trim().length).toBeGreaterThan(0);
    }
  });

  it('verse 1 of surahs 2..114 does not redundantly start with Bismillah', () => {
    for (const v of data.verses) {
      if (v.verseNumber === 1 && v.surahId >= 2) {
        // Al-Fatiha (surah 1) includes Bismillah as verse 1. Surahs 2..114 do not have Bismillah as part of verse 1.
        expect(v.textArabic.startsWith('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')).toBe(false);
      }
    }
  });
});
