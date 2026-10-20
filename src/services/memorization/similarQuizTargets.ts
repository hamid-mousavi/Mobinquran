/**
 * اولویت‌بندی آیه‌های پرسش برای «تمرین متشابهات» (مرحلهٔ ۴الف) — خالص.
 * اول آیه‌های پرخطا، بعد آیه‌های در مرور، بعد حفظ‌شده‌های دیگر؛ درون هر گروه تصادفی.
 */

import { shuffle } from './similarQuiz';

export interface TargetRecord {
  surahId: number;
  verseNumber: number;
  memorized: boolean;
  inReview: boolean;
  lapses: number;
}

export interface TargetRef {
  surahId: number;
  verseNumber: number;
}

export function prioritizeTargets(records: Iterable<TargetRecord>, rng: () => number): TargetRef[] {
  const leech: TargetRef[] = [];
  const review: TargetRef[] = [];
  const memorized: TargetRef[] = [];
  for (const r of records) {
    const ref = { surahId: r.surahId, verseNumber: r.verseNumber };
    if (r.inReview && r.lapses >= 2) leech.push(ref);
    else if (r.inReview) review.push(ref);
    else if (r.memorized) memorized.push(ref);
  }
  return [...shuffle(leech, rng), ...shuffle(review, rng), ...shuffle(memorized, rng)];
}
