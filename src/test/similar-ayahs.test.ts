import { describe, it, expect } from 'vitest';
import { findSimilarAyahs, prepareCorpus, prepareVerse, toWords } from '../services/memorization/similarAyahs';

const v = (surahId: number, verseNumber: number, text: string) => ({ surahId, verseNumber, text });

const corpus = prepareCorpus([
  v(4, 17, 'إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا'),
  v(4, 26, 'إِنَّ اللَّهَ كَانَ غَفُورًا رَحِيمًا'),
  v(4, 90, 'وَكَانَ اللَّهُ عَزِيزًا حَكِيمًا'),
  v(33, 1, 'يا أيها النبي اتق الله ولا تطع الكافرين وكان الله عزيزا حكيما'),
  v(55, 13, 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'),
  v(55, 16, 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'),
  v(55, 18, 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'),
  v(112, 1, 'قل هو الله أحد'),
  v(1, 3, 'الرحمن الرحيم'),
  v(2, 163, 'الرحمن الرحيم'),
  v(9, 5, 'كلمة مختلفة تماما عن الباقي هنا اليوم'),
]);
const get = (s: number, n: number) => corpus.find((c) => c.surahId === s && c.verseNumber === n)!;

describe('similarAyahs (Stage 3c)', () => {
  it('normalizes diacritics when splitting words', () => {
    expect(toWords('إِنَّ اللَّهَ كَانَ')).toEqual(toWords('ان الله كان'));
    expect(prepareVerse(v(1, 1, 'بسم الله')).set.size).toBe(2);
  });

  it('finds ayahs that start the same way', () => {
    const r = findSimilarAyahs(get(4, 17), corpus);
    expect(r[0]).toMatchObject({ surahId: 4, verseNumber: 26, kind: 'same_start' });
    expect(r[0].sharedPrefixWords).toBe(3);
  });

  it('finds ayahs that end the same way', () => {
    const r = findSimilarAyahs(get(4, 90), corpus);
    const hit = r.find((x) => x.surahId === 33);
    expect(hit?.kind).toBe('same_ending');
    expect(hit?.sharedSuffixWords).toBeGreaterThanOrEqual(3);
  });

  it('flags verbatim repeats and prefers the nearest ayahs of the same surah', () => {
    const r = findSimilarAyahs(get(55, 13), corpus, 2);
    expect(r.map((x) => x.kind)).toEqual(['identical', 'identical']);
    expect(r.map((x) => x.verseNumber)).toEqual([16, 18]);
  });

  it('never returns the ayah itself or unrelated ayahs', () => {
    const r = findSimilarAyahs(get(112, 1), corpus);
    expect(r).toEqual([]);
    const self = findSimilarAyahs(get(4, 17), corpus);
    expect(self.some((x) => x.surahId === 4 && x.verseNumber === 17)).toBe(false);
  });

  it('does not match two-word ayahs by their edges, but still reports identical ones', () => {
    const r = findSimilarAyahs(get(1, 3), corpus);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ surahId: 2, verseNumber: 163, kind: 'identical' });
  });

  it('respects the limit and handles empty targets', () => {
    expect(findSimilarAyahs(get(55, 13), corpus, 1)).toHaveLength(1);
    expect(findSimilarAyahs(prepareVerse(v(1, 1, '')), corpus)).toEqual([]);
  });
});
