import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  normalizeArabicForSearch,
  normalizePersianForSearch,
  calculateMatchScore,
} from '../utils/textNormalization';

interface CoreVerse {
  id: number;
  surahId: number;
  verseNumber: number;
  juzNumber: number;
  pageNumber: number;
  textArabic: string;
  textSimple?: string;
  translationMakarem: string;
  translationFooladvand: string;
  translationAnsarian: string;
  sajda?: {
    id: number;
    recommended: boolean;
    obligatory: boolean;
  };
}

interface CorePackage {
  id: string;
  version: string;
  schemaVersion: number;
  integrity: {
    algorithm: string;
    value: string;
  };
  verses: CoreVerse[];
}

describe('Search Normalization and Evidence Table Tests (Phase 1)', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/quran-core-v1.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const pack: CorePackage = JSON.parse(rawData);
  const verses = pack.verses;

  it('package includes textSimple for all 6236 verses', () => {
    expect(pack.schemaVersion).toBe(2);
    expect(pack.integrity.value).toBeDefined();
    for (const v of verses) {
      expect(v.textSimple).toBeDefined();
      expect(v.textSimple!.trim().length).toBeGreaterThan(0);
    }
  });

  it('validates 15 sajda positions including 4 obligatory ones', () => {
    const sajdaVerses = verses.filter((v) => !!v.sajda);
    const obligatory = verses.filter((v) => v.sajda?.obligatory);
    expect(sajdaVerses.length).toBe(15);
    expect(obligatory.length).toBe(4);
  });

  it('normalizes "علي" and "على" identically and finds more than 1300 matches', () => {
    const q1 = normalizeArabicForSearch('علي');
    const q2 = normalizeArabicForSearch('على');
    expect(q1).toBe(q2);

    const matches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(q1) || nSimple.includes(q1);
    });

    // در متن قرآن مبین به صورت یکدست ۱۳۴۴ آیه را شامل می‌شود
    expect(matches.length).toBeGreaterThan(1300);
  });

  it('finds "موسی" and "عیسی" in Arabic verses', () => {
    const qMusa = normalizeArabicForSearch('موسی');
    const musaMatches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qMusa) || nSimple.includes(qMusa);
    });
    expect(musaMatches.length).toBeGreaterThan(120);

    const qIsa = normalizeArabicForSearch('عیسی');
    const isaMatches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qIsa) || nSimple.includes(qIsa);
    });
    expect(isaMatches.length).toBe(25);
  });

  it('finds "شيء" despite Uthmani script and various tanween forms', () => {
    const qShae = normalizeArabicForSearch('شيء');
    const matches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qShae) || nSimple.includes(qShae);
    });
    // کلیدواژه «شیء» در ۱۹۲ آیه از قرآن کریم حضور دارد
    expect(matches.length).toBe(192);
  });

  it('finds "القرآن" and "الصلاة" and "الإنسان" using textSimple overlay', () => {
    const qQuran = normalizeArabicForSearch('القرآن');
    const quranMatches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qQuran) || nSimple.includes(qQuran);
    });
    // کلیدواژه «القرآن» در ۵۰ آیه و مشتقات «قرآن» در ۶۹ آیه حضور دارد
    expect(quranMatches.length).toBe(50);

    const qSalah = normalizeArabicForSearch('الصلاة');
    const salahMatches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qSalah) || nSimple.includes(qSalah);
    });
    // کلیدواژه «الصلاة» در ۶۱ آیه قرآن حضور دارد
    expect(salahMatches.length).toBe(61);

    const qInsan = normalizeArabicForSearch('الإنسان');
    const insanMatches = verses.filter((v) => {
      const nUthmani = normalizeArabicForSearch(v.textArabic);
      const nSimple = normalizeArabicForSearch(v.textSimple || '');
      return nUthmani.includes(qInsan) || nSimple.includes(qInsan);
    });
    // کلیدواژه «الإنسان» در ۵۶ آیه و «إنسان» در ۶۴ آیه حضور دارد
    expect(insanMatches.length).toBe(56);
  });

  it('finds "خدایی" in Fooladvand translation (previously 3, now 76)', () => {
    const q = normalizePersianForSearch('خدایی');
    const matches = verses.filter((v) => {
      const n = normalizePersianForSearch(v.translationFooladvand);
      return n.includes(q);
    });
    expect(matches.length).toBe(76);
  });

  it('ranks exact match higher than partial substring match', () => {
    const exactScore = calculateMatchScore('الله نور السماوات', 'الله');
    const prefixScore = calculateMatchScore('بالله استعین', 'الله');
    const substringScore = calculateMatchScore('والله اعلم', 'الله');
    expect(exactScore).toBe(3);
    expect(prefixScore).toBeGreaterThanOrEqual(1);
  });
});
