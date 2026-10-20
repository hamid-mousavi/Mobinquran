/**
 * سازندهٔ «تمرین متشابهات» (مرحلهٔ ۴الف) — خالص، قطعی (با rng تزریقی) و تست‌پذیر.
 *
 * دو نوع پرسش، هر دو بر پایهٔ شباهت‌های واقعی قرآن (نه حدس):
 *   - «ادامه»: آغاز مشترک چند آیه نشان داده می‌شود؛ ادامهٔ درست آیهٔ پرسیده‌شده را پیدا کن.
 *   - «آغاز»: پایان مشترک نشان داده می‌شود؛ آغاز درست آیهٔ پرسیده‌شده را پیدا کن.
 * گزینه‌های غلط فقط از آیه‌های مشابه واقعی می‌آیند و عین‌هم‌ها (که تفکیک‌ناپذیرند) کنار گذاشته می‌شوند.
 */

import { normalizeArabicForSearch } from '../../utils/textNormalization';
import { CorpusVerse, PreparedVerse, findSimilarAyahs } from './similarAyahs';

export interface QuizVerse extends PreparedVerse {
  /** کلمه‌های نمایشی (با اعراب)، هم‌تراز با words */
  display: string[];
}

/** شکستن متن به جفت (نمایشی، نرمال)؛ نشانه‌های وقف که نرمال‌شده‌شان تهی است حذف می‌شوند */
export function pairWords(text: string): Array<{ display: string; norm: string }> {
  const out: Array<{ display: string; norm: string }> = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const norm = normalizeArabicForSearch(token).trim();
    if (norm) out.push({ display: token, norm });
  }
  return out;
}

export function prepareQuizVerse(v: CorpusVerse): QuizVerse {
  const pairs = pairWords(v.text);
  const words = pairs.map((p) => p.norm);
  return {
    surahId: v.surahId,
    verseNumber: v.verseNumber,
    words,
    set: new Set(words),
    display: pairs.map((p) => p.display),
  };
}

export function prepareQuizCorpus(verses: readonly CorpusVerse[]): QuizVerse[] {
  return verses.map(prepareQuizVerse);
}

export type QuizMode = 'continue' | 'begin';

export interface QuizOption {
  text: string;
  ref: string;
  surahId: number;
  verseNumber: number;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  surahId: number;
  verseNumber: number;
  mode: QuizMode;
  /** بخش نشان‌داده‌شده (آغاز یا پایان مشترک) */
  promptText: string;
  options: QuizOption[];
}

const MIN_SHARED = 3;
const MAX_DISTRACTORS = 3;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const refOf = (v: { surahId: number; verseNumber: number }) => `${v.surahId}:${v.verseNumber}`;

export function indexQuizCorpus(corpus: readonly QuizVerse[]): Map<string, QuizVerse> {
  return new Map(corpus.map((v) => [refOf(v), v]));
}

interface Candidate {
  verse: QuizVerse;
  shared: number;
}

interface Piece {
  display: string[];
  norm: string[];
}

const MIN_SHOWN_WORDS = 5;
const HARD_CAP_WORDS = 20;

/**
 * گزینه‌ها را تا «اولین جای تفاوت» کوتاه می‌کند (حداقل ۵ کلمه): روی قرآن واقعی، صدر یک آیهٔ بلند
 * (مثل آیةالکرسی) ده‌ها کلمه است و گزینه‌های بلند نه خوانا هستند و نه چیزی را می‌سنجند.
 * اگر گزینه‌ها تا سقف ۲۰ کلمه هم از هم جدا نشوند، همان ۲۰ کلمه نشان داده می‌شود.
 */
export function truncateDistinct(pieces: readonly Piece[]): number {
  const longest = Math.max(...pieces.map((p) => p.norm.length));
  const cap = Math.min(HARD_CAP_WORDS, longest);
  for (let l = 1; l <= cap; l++) {
    const keys = pieces.map((p) => p.norm.slice(0, l).join(' '));
    if (new Set(keys).size === pieces.length) return Math.min(cap, Math.max(l, MIN_SHOWN_WORDS));
  }
  return cap;
}

function assemble(
  target: QuizVerse,
  mode: QuizMode,
  prompt: string,
  pick: (v: QuizVerse) => Piece | null,
  candidates: Candidate[],
  rng: () => number
): QuizQuestion | null {
  const correctPiece = pick(target);
  if (!correctPiece) return null;
  const seen = new Set<string>([correctPiece.norm.join(' ')]);
  const raw: Array<{ piece: Piece; verse: QuizVerse; correct: boolean }> = [{ piece: correctPiece, verse: target, correct: true }];
  for (const c of candidates) {
    if (raw.length > MAX_DISTRACTORS) break;
    const piece = pick(c.verse);
    if (!piece) continue;
    const key = piece.norm.join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push({ piece, verse: c.verse, correct: false });
  }
  if (raw.length < 2) return null;

  const shown = truncateDistinct(raw.map((r) => r.piece));
  const options: QuizOption[] = raw.map((r) => {
    const cut = r.piece.display.length > shown;
    const words = r.piece.display.slice(0, shown).join(' ');
    // «آغاز»: پس از گزینه پایان مشترک می‌آید؛ «ادامه»: فقط در صورت کوتاه‌شدن نقطه‌چین می‌خواهد
    const text = mode === 'begin' ? `${words} …` : cut ? `${words} …` : words;
    return { text, ref: refOf(r.verse), surahId: r.verse.surahId, verseNumber: r.verse.verseNumber, correct: r.correct };
  });
  return {
    id: `${refOf(target)}:${mode}`,
    surahId: target.surahId,
    verseNumber: target.verseNumber,
    mode,
    promptText: prompt,
    options: shuffle(options, rng),
  };
}

function continueQuestion(target: QuizVerse, sims: ReturnType<typeof findSimilarAyahs>, index: Map<string, QuizVerse>, rng: () => number) {
  const cands: Candidate[] = sims
    .filter((s) => s.sharedPrefixWords >= MIN_SHARED)
    .map((s) => ({ verse: index.get(refOf(s))!, shared: s.sharedPrefixWords }))
    .filter((c) => c.verse)
    .sort((a, b) => b.shared - a.shared);
  if (cands.length === 0) return null;
  const k = cands[0].shared;
  if (target.display.length <= k) return null;
  const pool = cands.filter((c) => c.shared >= k);
  const pick = (v: QuizVerse): Piece | null => {
    const display = v.display.slice(k);
    return display.length > 0 ? { display, norm: v.words.slice(k) } : null;
  };
  return assemble(target, 'continue', `${target.display.slice(0, k).join(' ')} …`, pick, pool, rng);
}

function beginQuestion(target: QuizVerse, sims: ReturnType<typeof findSimilarAyahs>, index: Map<string, QuizVerse>, rng: () => number) {
  const cands: Candidate[] = sims
    .filter((s) => s.sharedSuffixWords >= MIN_SHARED)
    .map((s) => ({ verse: index.get(refOf(s))!, shared: s.sharedSuffixWords }))
    .filter((c) => c.verse)
    .sort((a, b) => b.shared - a.shared);
  if (cands.length === 0) return null;
  const s = cands[0].shared;
  if (target.display.length <= s) return null;
  const pool = cands.filter((c) => c.shared >= s);
  const pick = (v: QuizVerse): Piece | null => {
    const display = v.display.slice(0, v.display.length - s);
    return display.length > 0 ? { display, norm: v.words.slice(0, v.words.length - s) } : null;
  };
  return assemble(target, 'begin', `… ${target.display.slice(target.display.length - s).join(' ')}`, pick, pool, rng);
}

/** یک پرسش برای آیهٔ هدف؛ اگر شباهت قابل‌پرسشی نداشته باشد null */
export function buildQuestion(
  target: QuizVerse,
  corpus: readonly QuizVerse[],
  index: Map<string, QuizVerse>,
  rng: () => number
): QuizQuestion | null {
  const sims = findSimilarAyahs(target, corpus, 12).filter((s) => s.kind !== 'identical');
  if (sims.length === 0) return null;
  const cont = continueQuestion(target, sims, index, rng);
  const begin = beginQuestion(target, sims, index, rng);
  if (cont && begin) return rng() < 0.6 ? cont : begin;
  return cont ?? begin;
}

/** از میان هدف‌های اولویت‌دار، تا `count` پرسش می‌سازد (هر آیه حداکثر یک‌بار) */
export function buildQuiz(
  targets: readonly QuizVerse[],
  corpus: readonly QuizVerse[],
  count: number,
  rng: () => number
): QuizQuestion[] {
  const index = indexQuizCorpus(corpus);
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    if (out.length >= count) break;
    const key = refOf(t);
    if (seen.has(key)) continue;
    seen.add(key);
    const q = buildQuestion(t, corpus, index, rng);
    if (q) out.push(q);
  }
  return out;
}
