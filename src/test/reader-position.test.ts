import { describe, expect, it } from 'vitest';
import { pickReadingVerse, VerseCandidate } from '../components/QuranReader';

/**
 * آزمون منطق «انتخاب آیهٔ در حال مطالعه» (P3-T1).
 * برخلاف نسخهٔ قبلی که با نگهداری ratio بین دسته‌ها، آیهٔ بالای صفحه
 * (آیهٔ ۱ با نسبت یک) را برای همیشه برنده نگه می‌داشت، انتخاب جدید
 * باید بر اساس «پوشش روی خط مطالعه» در همین لحظه باشد.
 */

function candidate(name: number, top: number, bottom: number): VerseCandidate {
  return {
    verse: {
      id: name,
      surahId: 1,
      verseNumber: name,
      textArabic: '',
      translationMakarem: '',
      translationFooladvand: '',
      translationAnsarian: '',
      juzNumber: 1,
      pageNumber: 1,
      hizbQuarter: 1,
    },
    top,
    bottom,
  };
}

describe('pickReadingVerse (P3-T1)', () => {
  it('آیه‌ای که خط مطالعه را می‌پوشاند انتخاب می‌شود', () => {
    // پرچم مطالعه روی 300px؛ مرکز آیه ۲ (200 تا 350) یعنی 275 به خط مطالعه نزدیک‌تر است
    const picked = pickReadingVerse(
      [
        candidate(1, 0, 200),
        candidate(2, 200, 350),
        candidate(3, 350, 500),
      ],
      300
    );
    expect(picked?.verseNumber).toBe(2);
  });

  it('آیهٔ بالای صفحه (آیه ۱) در بازهٔ معمولی انتخاب قبلی برنده نمی‌ماند', () => {
    // پس از اسکرول، مرکز آیهٔ ۱ خیلی فاصله دارد و آیهٔ ۷ برنده است
    const picked = pickReadingVerse([candidate(1, -1200, -1000), candidate(7, 100, 400)], 300);
    expect(picked?.verseNumber).toBe(7);
  });

  it('اگر هیچ نامزدی وجود داشته باشد، نزدیک‌ترین انتخاب می‌شود', () => {
    const picked = pickReadingVerse([candidate(1, 500, 700), candidate(2, 800, 900)], 300);
    expect(picked?.verseNumber).toBe(1);
  });

  it('خروجی بدون نامزد برابر null است', () => {
    expect(pickReadingVerse([], 300)).toBeNull();
  });

  it('خط مطالعه بیرون از همهٔ آیه‌ها: نزدیک‌ترین آیه انتخاب می‌شود', () => {
    const picked = pickReadingVerse([candidate(1, 10, 20), candidate(2, 30, 40)], 5000);
    expect(picked?.verseNumber).toBe(2);
  });
});