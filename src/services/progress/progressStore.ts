/**
 * ذخیره‌گاه یکپارچهٔ پیشرفت آیه (مرحلهٔ ۰).
 *
 * طراحی:
 *  - منبع حقیقت دائمی: جدول Dexie «ayahProgress».
 *  - برای اینکه API همگام قبلی (getDueReviewAyahs، isVerseMemorized و ...) بدون تغییر در
 *    کامپوننت‌ها کار کند، یک کش درون‌حافظه‌ای نگه می‌داریم؛ خواندن همگام از کش و نوشتن
 *    «کش فوری + ذخیرهٔ ناهمگام و ترتیبی در Dexie».
 *  - مهاجرت یک‌بارهٔ داده از دو کلید قدیمی localStorage. کلیدهای قدیمی حذف نمی‌شوند
 *    (برای بازگشت امن)؛ پاک‌سازی‌شان کار نسخهٔ بعد است.
 *  - اگر IndexedDB در دسترس نبود (حالت خصوصی، خطای مرورگر)، به‌صورت «degraded» روی
 *    همان فرمت قدیمی localStorage ادامه می‌دهد تا اپ از کار نیفتد.
 *
 * پیش از `initProgressStore()` نباید خواند/نوشت (App.tsx تا آماده‌شدن صبر می‌کند).
 */

import { db } from '../../db/quranDb';
import { ALL_SURAHS } from '../../data/surahs';
import { localDateKey } from '../../utils/date';
import {
  AyahProgress,
  DEFAULT_DAILY_REVIEW_LIMIT,
  ReviewGrade,
  ReviewQueue,
  addDaysToKey,
  addToReview,
  applyReviewGrade,
  buildFromLegacy,
  buildReviewQueue,
  clampDailyLimit,
  createProgress,
  enrollForReview,
  isDue,
  isEmptyProgress,
  makeKey,
  memorizedCountsBySurah,
  mergeProgress,
  removeFromReview,
  setMemorized,
  spreadDueDate,
} from './progressCore';

const LEGACY_MEMORIZED_KEY = 'mobin_memorized_verses_v1';
const LEGACY_REVIEW_KEY = 'mobin_review_deck_v1';
const MIGRATION_MARKER = 'ayah_progress_migration_v1';
const REVIEW_SETTINGS_KEY = 'mobin_review_settings_v1';

export const EVENT_MEMORIZATION = 'mobin-memorization-updated';
export const EVENT_REVIEW_DECK = 'mobin-review-deck-updated';

const cache = new Map<string, AyahProgress>();
let ready = false;
let degraded = false;
let initPromise: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

type ChangeKind = 'memo' | 'review';

function emit(kinds: ChangeKind[]): void {
  if (typeof window === 'undefined') return;
  if (kinds.includes('memo')) window.dispatchEvent(new CustomEvent(EVENT_MEMORIZATION));
  if (kinds.includes('review')) window.dispatchEvent(new CustomEvent(EVENT_REVIEW_DECK));
}

function readLegacyJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** حالت degraded: ذخیرهٔ دوباره روی همان فرمت قدیمی تا هیچ دادهای از دست نرود */
function persistLegacyFormat(): void {
  try {
    const all = Array.from(cache.values());
    const memorized = all.filter((p) => p.memorized).map((p) => p.key);
    const deck = all
      .filter((p) => p.inReview)
      .map((p) => ({
        id: p.key,
        surahId: p.surahId,
        surahNameArabic: p.surahNameArabic ?? '',
        verseNumber: p.verseNumber,
        addedAt: p.addedAt,
        box: p.box,
        nextReviewDate: p.nextReviewDate ?? localDateKey(),
      }));
    localStorage.setItem(LEGACY_MEMORIZED_KEY, JSON.stringify(memorized));
    localStorage.setItem(LEGACY_REVIEW_KEY, JSON.stringify(deck));
  } catch (err) {
    console.warn('progressStore: legacy persist failed', err);
  }
}

function hydrateFromLegacy(): void {
  cache.clear();
  const records = buildFromLegacy(
    readLegacyJson(LEGACY_MEMORIZED_KEY),
    readLegacyJson(LEGACY_REVIEW_KEY),
    Date.now(),
    localDateKey()
  );
  for (const r of records) cache.set(r.key, r);
}

async function runInit(): Promise<void> {
  try {
    const marker = await db.appSettings.get(MIGRATION_MARKER);
    if (!marker) {
      const records = buildFromLegacy(
        readLegacyJson(LEGACY_MEMORIZED_KEY),
        readLegacyJson(LEGACY_REVIEW_KEY),
        Date.now(),
        localDateKey()
      );
      await db.transaction('rw', db.ayahProgress, db.appSettings, async () => {
        // اگر رکوردی از قبل در Dexie بود (مثلاً بازیابی پشتیبان)، رکورد موجود برنده است
        const existing = await db.ayahProgress.bulkGet(records.map((r) => r.key));
        const fresh = records.filter((_, i) => !existing[i]);
        if (fresh.length > 0) await db.ayahProgress.bulkPut(fresh);
        await db.appSettings.put({
          key: MIGRATION_MARKER,
          version: 1,
          data: { migratedAt: Date.now(), count: records.length },
          updatedAt: new Date().toISOString(),
        });
      });
    }
    const all = await db.ayahProgress.toArray();
    cache.clear();
    for (const r of all) cache.set(r.key, r);
    degraded = false;
  } catch (err) {
    console.warn('progressStore: IndexedDB unavailable, falling back to localStorage', err);
    degraded = true;
    hydrateFromLegacy();
  }
  ready = true;
  emit(['memo', 'review']);
}

/** یک‌بار فراخوانی می‌شود؛ فراخوانی‌های بعدی همان Promise را برمی‌گردانند. هرگز reject نمی‌شود. */
export function initProgressStore(): Promise<void> {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      console.warn('progressStore: init failed', err);
      degraded = true;
      hydrateFromLegacy();
      ready = true;
    });
  }
  return initPromise;
}

export function isProgressStoreReady(): boolean {
  return ready;
}

export function isProgressStoreDegraded(): boolean {
  return degraded;
}

function persist(changed: AyahProgress[], removedKeys: string[]): void {
  if (degraded) {
    persistLegacyFormat();
    return;
  }
  writeChain = writeChain
    .then(async () => {
      if (changed.length > 0) await db.ayahProgress.bulkPut(changed);
      if (removedKeys.length > 0) await db.ayahProgress.bulkDelete(removedKeys);
    })
    .catch((err) => {
      console.warn('progressStore: persist failed', err);
    });
}

function commit(updates: AyahProgress[], kinds: ChangeKind[]): void {
  if (!ready) console.warn('progressStore: write before init — data may be overwritten');
  const changed: AyahProgress[] = [];
  const removed: string[] = [];
  for (const u of updates) {
    if (isEmptyProgress(u)) {
      if (cache.delete(u.key)) removed.push(u.key);
    } else {
      cache.set(u.key, u);
      changed.push(u);
    }
  }
  if (changed.length > 0 || removed.length > 0) {
    persist(changed, removed);
    emit(kinds);
  }
}

// -------------------------------------------------------------
// خواندن (همگام، از کش)
// -------------------------------------------------------------

export function getProgress(surahId: number, verseNumber: number): AyahProgress | undefined {
  return cache.get(makeKey(surahId, verseNumber));
}

export function getAllProgress(): AyahProgress[] {
  return Array.from(cache.values());
}

export function isMemorized(surahId: number, verseNumber: number): boolean {
  return cache.get(makeKey(surahId, verseNumber))?.memorized === true;
}

export function getMemorizedCount(): number {
  let n = 0;
  for (const r of cache.values()) if (r.memorized) n += 1;
  return n;
}

export function getMemorizedCountsBySurah(): Map<number, number> {
  return memorizedCountsBySurah(cache.values());
}

export function getReviewItems(): AyahProgress[] {
  return Array.from(cache.values()).filter((p) => p.inReview);
}

export function getDueItems(todayKey: string = localDateKey()): AyahProgress[] {
  return Array.from(cache.values()).filter((p) => isDue(p, todayKey));
}

/** صف مرور امروز با سقف روزانه و اولویت‌بندی */
export function getReviewQueue(todayKey: string = localDateKey()): ReviewQueue {
  return buildReviewQueue(cache.values(), todayKey, getReviewDailyLimit());
}

/** آیه‌های حفظ‌شده‌ای که در جعبهٔ مرور نیستند (مثلاً علامت‌خورده پیش از این نسخه) */
export function countMemorizedNotInReview(): number {
  let n = 0;
  for (const r of cache.values()) if (r.memorized && !r.inReview) n += 1;
  return n;
}

/**
 * ورود تدریجی آیه‌های حفظ‌شده‌ی خارج از مرور: به ترتیب مصحف و با پخش روزانه
 * (به اندازهٔ سقف روزانه) تا صف فردا منفجر نشود. تعداد آیهٔ واردشده را برمی‌گرداند.
 */
export function enrollMemorizedIntoReview(): number {
  const now = Date.now();
  const today = localDateKey();
  const perDay = getReviewDailyLimit();
  const candidates = Array.from(cache.values())
    .filter((r) => r.memorized && !r.inReview)
    .sort((a, b) => a.surahId - b.surahId || a.verseNumber - b.verseNumber);
  const updates = candidates.map((r, i) =>
    enrollForReview(r, surahNameOf(r.surahId), spreadDueDate(today, i, perDay), now)
  );
  if (updates.length > 0) commit(updates, ['review']);
  return updates.length;
}

// -------------------------------------------------------------
// نوشتن
// -------------------------------------------------------------

function surahNameOf(surahId: number): string | undefined {
  return ALL_SURAHS.find((x) => x.id === surahId)?.nameArabic;
}

// -------------------------------------------------------------
// تنظیمات مرور (سقف روزانه)
// -------------------------------------------------------------

export function getReviewDailyLimit(): number {
  const raw = readLegacyJson(REVIEW_SETTINGS_KEY) as { dailyLimit?: unknown } | null;
  return raw && typeof raw === 'object' && 'dailyLimit' in raw
    ? clampDailyLimit(raw.dailyLimit)
    : DEFAULT_DAILY_REVIEW_LIMIT;
}

export function setReviewDailyLimit(limit: number): void {
  try {
    localStorage.setItem(REVIEW_SETTINGS_KEY, JSON.stringify({ dailyLimit: clampDailyLimit(limit) }));
  } catch (err) {
    console.warn('progressStore: review settings save failed', err);
  }
  emit(['review']);
}

// -------------------------------------------------------------
// حفظ: علامت‌گذاری + ورود خودکار به مرور
// -------------------------------------------------------------

/**
 * علامت «حفظ‌شده» زدن، آیه را خودکار وارد جعبهٔ مرور می‌کند (موعد: فردا)؛
 * پیش‌تر آیهٔ حفظ‌شده تا کاربر دستی اضافه نمی‌کرد هیچ‌وقت مرور نمی‌شد.
 */
export function setVerseMemorized(surahId: number, verseNumber: number, memorized: boolean): void {
  const now = Date.now();
  const base = getProgress(surahId, verseNumber) ?? createProgress(surahId, verseNumber, now);
  if (base.memorized === memorized) return;
  let next = setMemorized(base, memorized, now);
  if (memorized && !next.inReview) {
    next = enrollForReview(next, surahNameOf(surahId), addDaysToKey(localDateKey(), 1), now);
    commit([next], ['memo', 'review']);
    return;
  }
  commit([next], ['memo']);
}

export function setRangeMemorized(surahId: number, start: number, end: number, memorized: boolean): void {
  const now = Date.now();
  const today = localDateKey();
  const perDay = getReviewDailyLimit();
  const name = surahNameOf(surahId);
  const updates: AyahProgress[] = [];
  let enrolled = 0;
  const last = Math.min(end, start + 300); // سقف ایمنی (بلندترین سوره ۲۸۶ آیه)
  for (let v = Math.max(1, start); v <= last; v++) {
    const base = getProgress(surahId, v) ?? createProgress(surahId, v, now);
    if (base.memorized === memorized) continue;
    let next = setMemorized(base, memorized, now);
    if (memorized && !next.inReview) {
      // ثبت یک‌جای چندین آیه: موعد مرور روی چند روز پخش می‌شود
      next = enrollForReview(next, name, spreadDueDate(today, enrolled, perDay), now);
      enrolled += 1;
    }
    updates.push(next);
  }
  if (updates.length > 0) commit(updates, enrolled > 0 ? ['memo', 'review'] : ['memo']);
}

export function addVerseToReview(
  surahId: number,
  surahNameArabic: string,
  verseNumber: number,
  dueImmediately: boolean
): void {
  const now = Date.now();
  const base = getProgress(surahId, verseNumber) ?? createProgress(surahId, verseNumber, now);
  commit([addToReview(base, surahNameArabic, dueImmediately, localDateKey(), now)], ['review']);
}

export function gradeReview(key: string, grade: ReviewGrade): void {
  const item = cache.get(key);
  if (!item || !item.inReview) return;
  commit([applyReviewGrade(item, grade, localDateKey(), Date.now())], ['review']);
}

/** واسط دودویی قبلی (درست/غلط) */
export function answerReview(key: string, correct: boolean): void {
  gradeReview(key, correct ? 'good' : 'again');
}

export function removeVerseFromReview(key: string): void {
  const item = cache.get(key);
  if (!item || !item.inReview) return;
  commit([removeFromReview(item, Date.now())], ['review']);
}

/**
 * بازیابی از پشتیبان: ادغام غیرمخرب (رکورد تازه‌تر برنده است).
 * تعداد رکوردهای واقعاً تغییرکرده را برمی‌گرداند.
 */
export function mergeRestoredProgress(records: AyahProgress[]): number {
  const updates: AyahProgress[] = [];
  for (const incoming of records) {
    const existing = cache.get(incoming.key);
    const winner = mergeProgress(existing, incoming);
    if (winner !== existing) updates.push(winner);
  }
  if (updates.length > 0) commit(updates, ['memo', 'review']);
  return updates.length;
}

/** صبر تا تمام نوشتن‌های در صف روی Dexie تمام شود (برای پشتیبان‌گیری دقیق) */
export function flushProgressWrites(): Promise<unknown> {
  return writeChain;
}
