/**
 * یافتن آیه‌های «مشابه» برای کمک به حفظ (مرحلهٔ ۳ج) — خالص و بدون هوش مصنوعی.
 *
 * چرا محلی؟ سیاست پروژه: متن و ارجاع آیه نباید از مدل بیاید (احتمال توهم). شباهت‌ها اینجا
 * از متن واقعی قرآن در بستهٔ محلی محاسبه می‌شود و مدل فقط روی همین مرجع‌های واقعی توضیح می‌نویسد.
 *
 * سه نوع شباهت که حافظان را گیج می‌کند:
 *   - شروع یکسان (۳ کلمهٔ اول)       - پایان یکسان (۳ کلمهٔ آخر، فاصله‌ها)
 *   - هم‌پوشانی بالای کلمات (جاکارد)  - عین همان عبارت (مثل تکرار آیات سورهٔ الرحمن)
 */

import { normalizeArabicForSearch } from '../../utils/textNormalization';

export interface CorpusVerse {
  surahId: number;
  verseNumber: number;
  text: string;
}

export interface PreparedVerse {
  surahId: number;
  verseNumber: number;
  words: string[];
  set: Set<string>;
}

export type SimilarityKind = 'identical' | 'same_start' | 'same_ending' | 'overlap';

export interface SimilarAyah {
  surahId: number;
  verseNumber: number;
  kind: SimilarityKind;
  score: number;
  sharedPrefixWords: number;
  sharedSuffixWords: number;
}

const MIN_WORDS_FOR_EDGE_RULES = 3;
const MIN_WORDS_FOR_OVERLAP = 4;
const EDGE_WORDS = 3;
const OVERLAP_THRESHOLD = 0.6;

export function toWords(text: string): string[] {
  return normalizeArabicForSearch(text).split(/\s+/).filter(Boolean);
}

export function prepareVerse(v: CorpusVerse): PreparedVerse {
  const words = toWords(v.text);
  return { surahId: v.surahId, verseNumber: v.verseNumber, words, set: new Set(words) };
}

export function prepareCorpus(verses: readonly CorpusVerse[]): PreparedVerse[] {
  return verses.map(prepareVerse);
}

function commonPrefix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

function commonSuffix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** مشابه‌ترین آیه‌ها به target؛ خود آیه هرگز در نتیجه نیست */
export function findSimilarAyahs(
  target: PreparedVerse,
  corpus: readonly PreparedVerse[],
  limit = 4
): SimilarAyah[] {
  if (target.words.length === 0) return [];
  const out: SimilarAyah[] = [];

  for (const c of corpus) {
    if (c.surahId === target.surahId && c.verseNumber === target.verseNumber) continue;
    if (c.words.length === 0) continue;

    const shorter = Math.min(target.words.length, c.words.length);
    const identical = target.words.length === c.words.length && target.words.every((w, i) => w === c.words[i]);
    if (identical) {
      out.push({ surahId: c.surahId, verseNumber: c.verseNumber, kind: 'identical', score: 1, sharedPrefixWords: shorter, sharedSuffixWords: shorter });
      continue;
    }

    const prefix = commonPrefix(target.words, c.words);
    const suffix = commonSuffix(target.words, c.words);
    const edgeOk = shorter >= MIN_WORDS_FOR_EDGE_RULES;
    const startHit = edgeOk && prefix >= EDGE_WORDS;
    const endHit = edgeOk && suffix >= EDGE_WORDS;
    const overlap =
      target.words.length >= MIN_WORDS_FOR_OVERLAP && c.words.length >= MIN_WORDS_FOR_OVERLAP ? jaccard(target.set, c.set) : 0;
    const overlapHit = overlap >= OVERLAP_THRESHOLD;
    if (!startHit && !endHit && !overlapHit) continue;

    const score = Math.max(startHit ? prefix / shorter : 0, endHit ? (suffix / shorter) * 0.9 : 0, overlapHit ? overlap : 0);
    const kind: SimilarityKind = startHit && (!endHit || prefix >= suffix) ? 'same_start' : endHit ? 'same_ending' : 'overlap';
    out.push({ surahId: c.surahId, verseNumber: c.verseNumber, kind, score, sharedPrefixWords: prefix, sharedSuffixWords: suffix });
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // هم‌امتیاز: آیه‌های همان سوره و نزدیک‌تر، چون بیشتر با هم قاطی می‌شوند
    const sameA = a.surahId === target.surahId ? 0 : 1;
    const sameB = b.surahId === target.surahId ? 0 : 1;
    if (sameA !== sameB) return sameA - sameB;
    if (sameA === 0) return Math.abs(a.verseNumber - target.verseNumber) - Math.abs(b.verseNumber - target.verseNumber);
    return a.surahId - b.surahId || a.verseNumber - b.verseNumber;
  });
  return out.slice(0, Math.max(1, limit));
}
