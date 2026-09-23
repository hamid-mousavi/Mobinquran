import { describe, expect, it } from 'vitest';
import { parseJuzQuery, parsePageQuery } from '../utils/textNormalization';
import { getJuzStartInfo } from '../data/surahs';

describe('Search Precision - Juz and Page Detection', () => {
  it('detects Persian digits for pages', () => {
    expect(parsePageQuery('۴۵')).toBe(45);
    expect(parsePageQuery('صفحه ۴۵')).toBe(45);
    expect(parsePageQuery('ص ۴۵')).toBe(45);
    expect(parsePageQuery('صفحه45')).toBe(45);
    expect(parsePageQuery('604')).toBe(604);
    expect(parsePageQuery('صفحه ۱')).toBe(1);
    expect(parsePageQuery('605')).toBeNull(); // Out of bounds
  });

  it('detects Persian and English digits and prefixes for Juz', () => {
    expect(parseJuzQuery('جزء ۴')).toBe(4);
    expect(parseJuzQuery('جزء 4')).toBe(4);
    expect(parseJuzQuery('ج ۴')).toBe(4);
    expect(parseJuzQuery('جزء۴')).toBe(4);
    expect(parseJuzQuery('جزء ۳۰')).toBe(30);
    expect(parseJuzQuery('جزء 30')).toBe(30);
    expect(parseJuzQuery('۳۱')).toBeNull(); // Juz is 1-30
  });

  it('detects Persian ordinal names for Juz', () => {
    expect(parseJuzQuery('جزء اول')).toBe(1);
    expect(parseJuzQuery('جزء دوم')).toBe(2);
    expect(parseJuzQuery('جزء سوم')).toBe(3);
    expect(parseJuzQuery('جزء چهارم')).toBe(4);
    expect(parseJuzQuery('جزء پانزدهم')).toBe(15);
    expect(parseJuzQuery('جزء سی‌ام')).toBe(30);
    expect(parseJuzQuery('جزء سی')).toBe(30);
  });

  it('returns valid start info for Juz', () => {
    const juz4 = getJuzStartInfo(4);
    expect(juz4.surahId).toBe(3); // Aal-Imran
    expect(juz4.ayah).toBe(92);
    expect(juz4.page).toBe(62);

    const juz15 = getJuzStartInfo(15);
    expect(juz15.surahId).toBe(17); // Al-Isra
    expect(juz15.ayah).toBe(1);
    expect(juz15.page).toBe(282);

    const juz30 = getJuzStartInfo(30);
    expect(juz30.surahId).toBe(78); // An-Naba
    expect(juz30.ayah).toBe(1);
    expect(juz30.page).toBe(582);
  });
});
