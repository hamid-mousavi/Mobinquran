import { describe, it, expect } from 'vitest';
import { toWords } from '../services/memorization/similarAyahs';
import {
  truncateDistinct,
  buildQuestion,
  buildQuiz,
  indexQuizCorpus,
  mulberry32,
  pairWords,
  prepareQuizCorpus,
  shuffle,
} from '../services/memorization/similarQuiz';

const v = (surahId: number, verseNumber: number, text: string) => ({ surahId, verseNumber, text });
const corpus = prepareQuizCorpus([
  v(4, 17, 'إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا'),
  v(4, 26, 'إِنَّ اللَّهَ كَانَ غَفُورًا رَحِيمًا'),
  v(4, 90, 'إِنَّ اللَّهَ كَانَ سَمِيعًا بَصِيرًا ۚ'),
  v(10, 1, 'قال الله تعالى وكان الله عزيزا حكيما'),
  v(33, 1, 'يا أيها النبي اتق الله وكان الله عزيزا حكيما'),
  v(55, 13, 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'),
  v(55, 16, 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ'),
  v(112, 1, 'قل هو الله أحد'),
]);
const index = indexQuizCorpus(corpus);
const get = (s: number, n: number) => corpus.find((c) => c.surahId === s && c.verseNumber === n)!;
const rng = () => mulberry32(7);

describe('similarQuiz (Stage 4a)', () => {
  it('keeps display words aligned with normalized words and drops stop marks', () => {
    const pairs = pairWords('إِنَّ اللَّهَ كَانَ ۚ عَلِيمًا');
    expect(pairs.map((p) => p.norm)).toEqual(toWords('إِنَّ اللَّهَ كَانَ ۚ عَلِيمًا'));
    expect(pairs.map((p) => p.display)).toEqual(['إِنَّ', 'اللَّهَ', 'كَانَ', 'عَلِيمًا']);
  });

  it('builds a "continue" question from a shared start with real distractors', () => {
    const q = buildQuestion(get(4, 17), corpus, index, rng())!;
    expect(q.mode).toBe('continue');
    expect(q.promptText).toBe('إِنَّ اللَّهَ كَانَ …');
    expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    expect(q.options.find((o) => o.correct)).toMatchObject({ text: 'عَلِيمًا حَكِيمًا', ref: '4:17' });
    expect(q.options.map((o) => o.ref).sort()).toEqual(['4:17', '4:26', '4:90']);
    expect(q.options.find((o) => o.ref === '4:90')?.text).toBe('سَمِيعًا بَصِيرًا'); // نشانهٔ وقف حذف شد
  });

  it('builds a "begin" question from a shared ending', () => {
    const q = buildQuestion(get(10, 1), corpus, index, rng())!;
    expect(q.mode).toBe('begin');
    expect(q.promptText).toBe('… وكان الله عزيزا حكيما');
    expect(q.options.find((o) => o.correct)?.text).toBe('قال الله تعالى …');
    expect(q.options.map((o) => o.ref).sort()).toEqual(['10:1', '33:1']);
  });

  it('returns null for verbatim repeats and for ayahs without real look-alikes', () => {
    expect(buildQuestion(get(55, 13), corpus, index, rng())).toBeNull();
    expect(buildQuestion(get(112, 1), corpus, index, rng())).toBeNull();
  });

  it('never shows duplicated options and always has exactly one correct answer', () => {
    for (const t of [get(4, 17), get(4, 26), get(4, 90), get(10, 1), get(33, 1)]) {
      const q = buildQuestion(t, corpus, index, mulberry32(3));
      if (!q) continue;
      expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
      expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      expect(q.options.find((o) => o.correct)?.ref).toBe(`${t.surahId}:${t.verseNumber}`);
    }
  });

  it('is deterministic for a seed and shuffles differently across seeds', () => {
    const a = buildQuestion(get(4, 17), corpus, index, mulberry32(1))!;
    const b = buildQuestion(get(4, 17), corpus, index, mulberry32(1))!;
    expect(a.options.map((o) => o.ref)).toEqual(b.options.map((o) => o.ref));
    const orders = new Set<string>();
    for (let s = 0; s < 20; s++) orders.add(buildQuestion(get(4, 17), corpus, index, mulberry32(s))!.options.map((o) => o.ref).join());
    expect(orders.size).toBeGreaterThan(1);
    expect(shuffle([1, 2, 3, 4], mulberry32(5)).sort()).toEqual([1, 2, 3, 4]);
  });

  it('builds a quiz up to the requested size without repeating an ayah', () => {
    const targets = [get(112, 1), get(4, 17), get(4, 17), get(55, 13), get(4, 26), get(10, 1), get(33, 1), get(4, 90)];
    const quiz = buildQuiz(targets, corpus, 3, mulberry32(9));
    expect(quiz).toHaveLength(3);
    expect(new Set(quiz.map((q) => q.id)).size).toBe(3);
    expect(buildQuiz(targets, corpus, 50, mulberry32(9)).length).toBeLessThanOrEqual(5);
    expect(buildQuiz([], corpus, 5, mulberry32(1))).toEqual([]);
  });

  it('truncates long options at the first point of difference (at least 5 words)', () => {
    const w = (s: string) => s.split(' ');
    // دو صدر بلند که فقط در کلمهٔ هفتم فرق دارند
    const a = { display: w('الف ب ج د ه و ز ح ط ي ك ل'), norm: w('الف ب ج د ه و ز ح ط ي ك ل') };
    const b = { display: w('الف ب ج د ه و س ح ط ي ك ل'), norm: w('الف ب ج د ه و س ح ط ي ك ل') };
    expect(truncateDistinct([a, b])).toBe(7);
    // فرق از کلمهٔ اول: همچنان حداقل ۵ کلمه نشان داده می‌شود
    const c = { display: w('م ن ص ع ف ق ر'), norm: w('م ن ص ع ف ق ر') };
    expect(truncateDistinct([a, c])).toBe(5);
    // گزینهٔ کوتاه‌تر از حداقل: بیشتر از طول واقعی نمی‌شود
    const d = { display: w('ك ل'), norm: w('ك ل') };
    const e = { display: w('م ن'), norm: w('م ن') };
    expect(truncateDistinct([d, e])).toBe(2);
  });
});
