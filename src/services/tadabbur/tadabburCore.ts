/**
 * منطق خالص «تدبر روزانه» (مرحلهٔ ۴ب): انتخاب ثابت آیهٔ روز، پرسش تفکر و دفتر روزهای انجام‌شده.
 * بدون DOM/localStorage تا کاملاً تست‌پذیر باشد.
 */

import { addDaysToKey } from '../progress/progressCore';
import { mulberry32, shuffle } from '../memorization/similarQuiz';

// ---------------------------------------------------------------- آیهٔ روز

const DAY_MS = 86_400_000;

/** شمارهٔ روز از مبدأ (بر پایهٔ تاریخ محلی YYYY-MM-DD؛ مستقل از ساعت تابستانی) */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * نمایهٔ آیهٔ روز: همه‌روز ثابت، در هر روز متفاوت، و بدون تکرار تا پایان یک دور کامل مجموعه.
 * ترتیب دور با یک بذر ثابت درهم می‌شود تا پشت‌سرهم موضوع‌های هم‌خانواده نیایند.
 */
export function dailyPoolIndex(dateKey: string, poolSize: number): number {
  if (poolSize <= 0) return 0;
  const order = shuffle(
    Array.from({ length: poolSize }, (_, i) => i),
    mulberry32(0x7ad4b0b)
  );
  const n = dayNumber(dateKey);
  return order[((n % poolSize) + poolSize) % poolSize];
}

// ---------------------------------------------------------------- پرسش تفکر

export const REFLECTION_QUESTIONS: readonly string[] = [
  'کدام کلمه یا عبارت این آیه بیشتر توجه‌تان را جلب کرد؟ چرا؟',
  'این آیه دربارهٔ خدا چه چیزی به شما می‌گوید؟',
  'اگر امروز بخواهید به این آیه عمل کنید، اولین قدم عملی‌تان چیست؟',
  'این آیه با کدام تجربهٔ اخیر زندگی شما ارتباط دارد؟',
  'این آیه شما را به شکر، امید، توبه یا تلاش می‌خواند؟ کدام؟',
  'اگر بخواهید این آیه را برای یک دوست توضیح دهید، چه می‌گویید؟',
  'چه نکته‌ای از این آیه را می‌خواهید تا فردا به یاد داشته باشید؟',
  'کدام پرسش دربارهٔ این آیه برای شما بی‌پاسخ مانده است؟',
];

/** پرسش ثابت برای یک روز و یک آیه (با تغییر روز یا آیه عوض می‌شود) */
export function questionFor(dateKey: string, surahId: number, verseNumber: number): string {
  const h = (dayNumber(dateKey) * 31 + surahId * 7 + verseNumber) % REFLECTION_QUESTIONS.length;
  return REFLECTION_QUESTIONS[((h % REFLECTION_QUESTIONS.length) + REFLECTION_QUESTIONS.length) % REFLECTION_QUESTIONS.length];
}

// ---------------------------------------------------------------- دفتر تدبر

export interface TadabburEntry {
  /** YYYY-MM-DD */
  date: string;
  surahId: number;
  verseNumber: number;
}

export const MAX_LOG_ENTRIES = 400;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** هر روز حداکثر یک ثبت؛ تازه‌ترین بالا؛ سقف اندازه */
export function upsertEntry(log: readonly TadabburEntry[], entry: TadabburEntry, max = MAX_LOG_ENTRIES): TadabburEntry[] {
  const rest = log.filter((e) => e.date !== entry.date);
  return [entry, ...rest].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, max);
}

export function parseLog(raw: unknown): TadabburEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TadabburEntry[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    if (typeof r.date !== 'string' || !DATE_RE.test(r.date) || seen.has(r.date)) continue;
    if (!Number.isInteger(r.surahId) || !Number.isInteger(r.verseNumber)) continue;
    const surahId = r.surahId as number;
    const verseNumber = r.verseNumber as number;
    if (surahId < 1 || surahId > 114 || verseNumber < 1 || verseNumber > 286) continue;
    seen.add(r.date);
    out.push({ date: r.date, surahId, verseNumber });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, MAX_LOG_ENTRIES);
}

export function isDoneOn(log: readonly TadabburEntry[], dateKey: string): boolean {
  return log.some((e) => e.date === dateKey);
}

/**
 * روزهای پیاپی تدبر. اگر امروز هنوز انجام نشده، رشته تا دیروز شمرده می‌شود
 * (کاربر هنوز فرصت دارد و رشته‌اش نشکسته است).
 */
export function consecutiveDays(log: readonly TadabburEntry[], todayKey: string): number {
  const dates = new Set(log.map((e) => e.date));
  let cursor = dates.has(todayKey) ? todayKey : addDaysToKey(todayKey, -1);
  let n = 0;
  while (dates.has(cursor)) {
    n += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return n;
}
