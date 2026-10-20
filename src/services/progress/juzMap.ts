/**
 * نگاشت آیه ← جزء و محاسبهٔ پیشرفت حفظ به تفکیک جزء (مرحلهٔ ۱ب).
 * خالص و همگام است؛ نیازی به خواندن متن آیه‌ها از پایگاه‌داده ندارد.
 *
 * مرز ۳۰ جزء طبق مصحف رایج (روایت حفص): هر جزء از آیهٔ [سوره، آیه] آغاز می‌شود.
 */

export const JUZ_STARTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export interface JuzProgressItem {
  juz: number;
  memorized: number;
  total: number;
}

/** شمارهٔ جزء (۱ تا ۳۰) برای یک آیه */
export function juzOf(surahId: number, verseNumber: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, v] = JUZ_STARTS[i];
    if (surahId > s || (surahId === s && verseNumber >= v)) juz = i + 1;
    else break;
  }
  return juz;
}

/** تعداد کل آیه‌های هر جزء؛ ورودی: تعداد آیه‌های سوره‌ها به ترتیب (اندیس ۰ = سورهٔ ۱) */
export function computeJuzTotals(versesCountBySurah: readonly number[]): number[] {
  const totals = new Array<number>(JUZ_STARTS.length).fill(0);
  for (let s = 1; s <= versesCountBySurah.length; s++) {
    for (let v = 1; v <= versesCountBySurah[s - 1]; v++) totals[juzOf(s, v) - 1] += 1;
  }
  return totals;
}

export function computeJuzProgress(
  memorized: Iterable<{ surahId: number; verseNumber: number }>,
  totals: readonly number[]
): JuzProgressItem[] {
  const counts = new Array<number>(JUZ_STARTS.length).fill(0);
  for (const m of memorized) counts[juzOf(m.surahId, m.verseNumber) - 1] += 1;
  return totals.map((total, i) => ({ juz: i + 1, memorized: Math.min(counts[i], total), total }));
}
