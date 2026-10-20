/**
 * ساخت جلسهٔ «تمرین متشابهات» روی داده‌های واقعی برنامه (مرحلهٔ ۴الف).
 * نمایهٔ متن آیه‌ها یک‌بار ساخته و نگه‌داری می‌شود.
 */

import { QuranService } from '../quranService';
import { getAllProgress } from '../progress/progressStore';
import {
  QuizQuestion,
  QuizVerse,
  buildQuiz,
  indexQuizCorpus,
  mulberry32,
  prepareQuizCorpus,
  shuffle,
} from './similarQuiz';
import { prioritizeTargets } from './similarQuizTargets';

export type QuizScope = 'mine' | 'surah';

let corpusPromise: Promise<QuizVerse[]> | null = null;

function loadQuizCorpus(): Promise<QuizVerse[]> {
  if (!corpusPromise) {
    corpusPromise = QuranService.getAllVerseTexts().then((verses) => {
      if (verses.length === 0) corpusPromise = null; // بستهٔ متن آماده نیست؛ بار بعد دوباره تلاش شود
      return prepareQuizCorpus(verses);
    });
  }
  return corpusPromise;
}

export async function buildSessionQuiz(args: {
  scope: QuizScope;
  surahId: number;
  count: number;
}): Promise<QuizQuestion[]> {
  const corpus = await loadQuizCorpus();
  if (corpus.length === 0) return [];
  const rng = mulberry32(Date.now() & 0x7fffffff);
  const index = indexQuizCorpus(corpus);

  let targets: QuizVerse[];
  if (args.scope === 'mine') {
    targets = prioritizeTargets(getAllProgress(), rng)
      .map((r) => index.get(`${r.surahId}:${r.verseNumber}`))
      .filter((v): v is QuizVerse => !!v);
  } else {
    targets = shuffle(
      corpus.filter((v) => v.surahId === args.surahId),
      rng
    );
  }
  return buildQuiz(targets, corpus, args.count, rng);
}
