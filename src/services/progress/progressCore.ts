/**
 * هستهٔ خالص «پیشرفت آیه» (مرحلهٔ ۰ — پایهٔ داده).
 *
 * تا پیش از این، وضعیت حفظ (مجموعهٔ آیه‌های حفظ‌شده) و جعبهٔ لایتنر دو ساختار جدا در
 * localStorage بودند. اینجا هر دو در یک رکورد واحد برای هر آیه جمع می‌شوند.
 *
 * همهٔ توابع این فایل خالص‌اند (بدون Dexie، localStorage یا DOM) تا کاملاً تست‌پذیر باشند.
 * رفتار زمان‌بندی لایتنر عمداً با نسخهٔ قبلی یکسان است (۱ ← ۳ ← ۷ ← ۱۴ ← ۳۰ روز)؛
 * بهبود الگوریتم کار مرحلهٔ ۱ است.
 */

export interface AyahProgress {
  /** کلید یکتا: `${surahId}:${verseNumber}` */
  key: string;
  surahId: number;
  verseNumber: number;
  /** آیا کاربر این آیه را «حفظ‌شده» علامت زده است */
  memorized: boolean;
  /** آیا آیه در جعبهٔ مرور (لایتنر) است */
  inReview: boolean;
  surahNameArabic?: string;
  /** جعبهٔ لایتنر ۱ تا ۵ (فقط وقتی inReview) */
  box: number;
  /** YYYY-MM-DD به وقت محلی (فقط وقتی inReview) */
  nextReviewDate?: string;
  addedAt: number;
  lastReviewedAt?: number;
  /** تعداد مرورهای درست */
  reps: number;
  /** تعداد دفعاتی که جواب غلط بوده */
  lapses: number;
  updatedAt: number;
}

export const MAX_BOX = 5;
export const MAX_SURAH_ID = 114;
export const MAX_VERSE_NUMBER = 286;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function makeKey(surahId: number, verseNumber: number): string {
  return `${surahId}:${verseNumber}`;
}

export function parseKey(key: unknown): { surahId: number; verseNumber: number } | null {
  if (typeof key !== 'string') return null;
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(key);
  if (!m) return null;
  const surahId = Number(m[1]);
  const verseNumber = Number(m[2]);
  if (surahId < 1 || surahId > MAX_SURAH_ID) return null;
  if (verseNumber < 1 || verseNumber > MAX_VERSE_NUMBER) return null;
  return { surahId, verseNumber };
}

/** جمع‌کردن روز روی کلید YYYY-MM-DD؛ با محاسبهٔ UTC تا ساعت تابستانی خطا نیندازد */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function createProgress(surahId: number, verseNumber: number, now: number): AyahProgress {
  return {
    key: makeKey(surahId, verseNumber),
    surahId,
    verseNumber,
    memorized: false,
    inReview: false,
    box: 1,
    addedAt: now,
    reps: 0,
    lapses: 0,
    updatedAt: now,
  };
}

/** رکوردی که نه حفظ‌شده است و نه در مرور، نباید ذخیره شود */
export function isEmptyProgress(p: AyahProgress): boolean {
  return !p.memorized && !p.inReview;
}

export function setMemorized(p: AyahProgress, memorized: boolean, now: number): AyahProgress {
  return { ...p, memorized, updatedAt: now };
}

/**
 * افزودن به جعبهٔ مرور — هم‌رفتار با `addAyahToReview` قبلی:
 * اگر آیه از قبل در جعبه بود، به جعبهٔ ۱ برمی‌گردد.
 */
export function addToReview(
  p: AyahProgress,
  surahNameArabic: string | undefined,
  dueImmediately: boolean,
  todayKey: string,
  now: number
): AyahProgress {
  return {
    ...p,
    inReview: true,
    box: 1,
    nextReviewDate: dueImmediately ? todayKey : addDaysToKey(todayKey, 1),
    surahNameArabic: surahNameArabic || p.surahNameArabic,
    updatedAt: now,
  };
}

/** فاصلهٔ مرور بعد از ارتقا به جعبهٔ مقصد (هم‌ارز جدول قبلی) */
export function intervalDaysForBox(box: number): number {
  if (box <= 2) return 3;
  if (box === 3) return 7;
  if (box === 4) return 14;
  return 30;
}

/** درجهٔ پاسخ کاربر در مرور */
export type ReviewGrade = 'again' | 'hard' | 'good';

/** پس از «سخت بود»: همان جعبه می‌ماند و زودتر مرور می‌شود */
const HARD_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 6, 5: 12 };

/** آیه‌ای که بارها فراموش شده باید فاصلهٔ مرور کوتاه‌تری بگیرد */
export function lapseFactor(lapses: number): number {
  if (lapses >= 4) return 0.5;
  if (lapses >= 2) return 0.7;
  return 1;
}

/** آیه‌ای که ≥ ۴ بار فراموش شده «نیازمند توجه ویژه» است */
export const LEECH_LAPSES = 4;
export function isLeech(p: AyahProgress): boolean {
  return p.inReview && p.lapses >= LEECH_LAPSES;
}

export function applyReviewGrade(
  p: AyahProgress,
  grade: ReviewGrade,
  todayKey: string,
  now: number
): AyahProgress {
  if (!p.inReview) return p;
  if (grade === 'again') {
    return {
      ...p,
      box: 1,
      nextReviewDate: addDaysToKey(todayKey, 1),
      lapses: p.lapses + 1,
      lastReviewedAt: now,
      updatedAt: now,
    };
  }
  if (grade === 'hard') {
    const days = HARD_INTERVAL_DAYS[Math.max(1, Math.min(MAX_BOX, p.box))] ?? 1;
    return {
      ...p,
      nextReviewDate: addDaysToKey(todayKey, days),
      lastReviewedAt: now,
      updatedAt: now,
    };
  }
  const box = Math.min(MAX_BOX, p.box + 1);
  const days = Math.max(1, Math.round(intervalDaysForBox(box) * lapseFactor(p.lapses)));
  return {
    ...p,
    box,
    nextReviewDate: addDaysToKey(todayKey, days),
    reps: p.reps + 1,
    lastReviewedAt: now,
    updatedAt: now,
  };
}

/** واسط دودویی قبلی (درست/غلط) — معادل «good» و «again» */
export function applyReviewResult(
  p: AyahProgress,
  correct: boolean,
  todayKey: string,
  now: number
): AyahProgress {
  return applyReviewGrade(p, correct ? 'good' : 'again', todayKey, now);
}

export function removeFromReview(p: AyahProgress, now: number): AyahProgress {
  return {
    ...p,
    inReview: false,
    box: 1,
    nextReviewDate: undefined,
    updatedAt: now,
  };
}

export function isDue(p: AyahProgress, todayKey: string): boolean {
  return p.inReview && !!p.nextReviewDate && p.nextReviewDate <= todayKey;
}

export function memorizedCountsBySurah(records: Iterable<AyahProgress>): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of records) {
    if (!r.memorized) continue;
    out.set(r.surahId, (out.get(r.surahId) ?? 0) + 1);
  }
  return out;
}

// -------------------------------------------------------------
// صف مرور روزانه و ورود تدریجی آیه‌ها
// -------------------------------------------------------------

/** اختلاف روز بین دو کلید YYYY-MM-DD (b - a) */
export function daysBetween(aKey: string, bKey: string): number {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function overdueDays(p: AyahProgress, todayKey: string): number {
  if (!p.nextReviewDate) return 0;
  return Math.max(0, daysBetween(p.nextReviewDate, todayKey));
}

export interface ReviewQueue {
  /** آیه‌های سهمیهٔ امروز، به ترتیب اولویت */
  items: AyahProgress[];
  /** کل آیه‌های سررسیدشده (بدون سقف) */
  totalDue: number;
  /** سررسیدشده‌هایی که به‌خاطر سقف روزانه به بعد موکول شدند */
  deferred: number;
  /** تعداد سررسیدشده‌هایی که دیرتر از موعد هستند */
  overdue: number;
}

export const DEFAULT_DAILY_REVIEW_LIMIT = 20;
export const MIN_DAILY_REVIEW_LIMIT = 5;
export const MAX_DAILY_REVIEW_LIMIT = 100;

export function clampDailyLimit(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : DEFAULT_DAILY_REVIEW_LIMIT;
  return Math.max(MIN_DAILY_REVIEW_LIMIT, Math.min(MAX_DAILY_REVIEW_LIMIT, v));
}

/**
 * اولویت: دیرترین موعد اول (بیشتر فراموش‌شده)، سپس جعبهٔ پایین‌تر، سپس آیه‌های پرخطا،
 * و در نهایت ترتیب مصحف تا خروجی پایدار و قابل‌پیش‌بینی باشد.
 */
export function buildReviewQueue(
  records: Iterable<AyahProgress>,
  todayKey: string,
  dailyLimit: number
): ReviewQueue {
  const due: AyahProgress[] = [];
  for (const r of records) if (isDue(r, todayKey)) due.push(r);

  due.sort((a, b) => {
    const od = overdueDays(b, todayKey) - overdueDays(a, todayKey);
    if (od !== 0) return od;
    if (a.box !== b.box) return a.box - b.box;
    if (a.lapses !== b.lapses) return b.lapses - a.lapses;
    return a.surahId - b.surahId || a.verseNumber - b.verseNumber;
  });

  const limit = clampDailyLimit(dailyLimit);
  const items = due.slice(0, limit);
  return {
    items,
    totalDue: due.length,
    deferred: Math.max(0, due.length - items.length),
    overdue: due.filter((r) => overdueDays(r, todayKey) > 0).length,
  };
}

/** ورود یک آیه به جعبهٔ مرور با موعد مشخص (بدون دست‌زدن به وضعیت حفظ) */
export function enrollForReview(
  p: AyahProgress,
  surahNameArabic: string | undefined,
  dueDateKey: string,
  now: number
): AyahProgress {
  return {
    ...p,
    inReview: true,
    box: 1,
    nextReviewDate: dueDateKey,
    surahNameArabic: surahNameArabic || p.surahNameArabic,
    updatedAt: now,
  };
}

/**
 * موعد ورود هر آیه را روی چند روز پخش می‌کند تا ثبت یک‌جای ده‌ها آیه، فردا
 * صف مرور را منفجر نکند: آیهٔ i‌ام در روز (شروع + ⌊i / perDay⌋).
 */
export function spreadDueDate(todayKey: string, index: number, perDay: number, startOffsetDays = 1): string {
  const per = Math.max(1, Math.round(perDay));
  return addDaysToKey(todayKey, startOffsetDays + Math.floor(index / per));
}

// -------------------------------------------------------------
// پاک‌سازی و مهاجرت
// -------------------------------------------------------------

function toFiniteInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

/**
 * یک رکورد ناشناخته (از فایل پشتیبان یا دادهٔ قدیمی) را به رکورد معتبر تبدیل می‌کند.
 * اگر کلید نامعتبر باشد یا رکورد خالی شود، null برمی‌گرداند.
 */
export function sanitizeProgress(raw: unknown, todayKey: string, now: number): AyahProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const parsed = parseKey(r.key) ?? (
    typeof r.surahId === 'number' && typeof r.verseNumber === 'number'
      ? parseKey(makeKey(r.surahId, r.verseNumber))
      : null
  );
  if (!parsed) return null;

  const inReview = r.inReview === true;
  const memorized = r.memorized === true;
  const rec: AyahProgress = {
    key: makeKey(parsed.surahId, parsed.verseNumber),
    surahId: parsed.surahId,
    verseNumber: parsed.verseNumber,
    memorized,
    inReview,
    surahNameArabic: typeof r.surahNameArabic === 'string' ? r.surahNameArabic.slice(0, 60) : undefined,
    box: Math.max(1, Math.min(MAX_BOX, toFiniteInt(r.box, 1))),
    nextReviewDate:
      inReview && typeof r.nextReviewDate === 'string' && DATE_KEY_RE.test(r.nextReviewDate)
        ? r.nextReviewDate
        : inReview
        ? todayKey
        : undefined,
    addedAt: toFiniteInt(r.addedAt, now),
    lastReviewedAt: typeof r.lastReviewedAt === 'number' ? toFiniteInt(r.lastReviewedAt, now) : undefined,
    reps: Math.max(0, toFiniteInt(r.reps, 0)),
    lapses: Math.max(0, toFiniteInt(r.lapses, 0)),
    updatedAt: toFiniteInt(r.updatedAt, now),
  };
  return isEmptyProgress(rec) ? null : rec;
}

/**
 * ساخت رکوردهای یکپارچه از دو ساختار قدیمی:
 *  - آرایهٔ کلیدهای «surah:verse» (آیه‌های حفظ‌شده)
 *  - آرایهٔ آیتم‌های جعبهٔ لایتنر (ReviewAyahItem)
 * ورودی‌ها ناشناخته‌اند و هر موردِ خراب بی‌سروصدا کنار گذاشته می‌شود.
 */
export function buildFromLegacy(
  memorizedKeys: unknown,
  reviewDeck: unknown,
  now: number,
  todayKey: string
): AyahProgress[] {
  const map = new Map<string, AyahProgress>();

  if (Array.isArray(memorizedKeys)) {
    for (const key of memorizedKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const k = makeKey(parsed.surahId, parsed.verseNumber);
      const base = map.get(k) ?? createProgress(parsed.surahId, parsed.verseNumber, now);
      map.set(k, setMemorized(base, true, now));
    }
  }

  if (Array.isArray(reviewDeck)) {
    for (const item of reviewDeck) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      const parsed =
        parseKey(it.id) ??
        (typeof it.surahId === 'number' && typeof it.verseNumber === 'number'
          ? parseKey(makeKey(it.surahId, it.verseNumber))
          : null);
      if (!parsed) continue;
      const k = makeKey(parsed.surahId, parsed.verseNumber);
      const base = map.get(k) ?? createProgress(parsed.surahId, parsed.verseNumber, now);
      const date =
        typeof it.nextReviewDate === 'string' && DATE_KEY_RE.test(it.nextReviewDate)
          ? it.nextReviewDate
          : todayKey;
      map.set(k, {
        ...base,
        inReview: true,
        surahNameArabic: typeof it.surahNameArabic === 'string' ? it.surahNameArabic.slice(0, 60) : base.surahNameArabic,
        box: Math.max(1, Math.min(MAX_BOX, toFiniteInt(it.box, 1))),
        nextReviewDate: date,
        addedAt: toFiniteInt(it.addedAt, now),
        updatedAt: now,
      });
    }
  }

  return Array.from(map.values());
}

/** ادغام رکوردهای بازیابی‌شده با رکوردهای موجود: رکورد تازه‌تر (updatedAt) برنده است */
export function mergeProgress(existing: AyahProgress | undefined, incoming: AyahProgress): AyahProgress {
  if (!existing) return incoming;
  return incoming.updatedAt > existing.updatedAt ? incoming : existing;
}
