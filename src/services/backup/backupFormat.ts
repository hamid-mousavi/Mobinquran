/**
 * قالب و اعتبارسنجی فایل پشتیبان (مرحلهٔ ۰).
 * این فایل خالص است؛ خواندن/نوشتن Dexie در backupService انجام می‌شود.
 *
 * اصل ایمنی: فایل ورودی غیرقابل‌اعتماد است. فقط کلیدهای فهرست سفید و فقط شکل‌های
 * شناخته‌شده پذیرفته می‌شوند و هر مورد خراب کنار گذاشته می‌شود (به‌جای شکست کل بازیابی).
 */

import { AyahProgress, sanitizeProgress } from '../progress/progressCore';

export const BACKUP_APP_ID = 'quran-mobin';
export const BACKUP_VERSION = 1;

/** حداکثر اندازهٔ متن پشتیبان قابل بازیابی (کاراکتر) */
export const MAX_BACKUP_TEXT_LENGTH = 8_000_000;
const MAX_LOCAL_VALUE_LENGTH = 2_000_000;
const MAX_ITEMS_PER_TABLE = 20_000;

/** کلیدهای localStorage که هنوز به Dexie منتقل نشده‌اند و در پشتیبان گرفته می‌شوند */
export const BACKUP_LOCAL_KEYS = [
  'mobin_memorization_sessions_v1',
  'mobin_daily_activity_v1',
  'mobin_streak_data_v1',
  'mobin_ai_reflections_v1',
  'mobin_review_settings_v1',
  'mobin_tadabbur_log_v1',
  'quran_bookmarked_stories',
  'quran_read_stories',
  'quran_last_read',
] as const;

export interface BackupBookmark {
  surahId: number;
  verseNumber: number;
  createdAt: number;
  note?: string;
  folder?: string;
}

export interface BackupKhatmPlan {
  id: string;
  title: string;
  type: string;
  startDate: string;
  targetDays: number;
  totalPages: number;
  completedPages: number[];
  currentDay: number;
  lastReadDate?: string;
  isActive: boolean;
}

export interface BackupReadingState {
  id: string;
  surahId: number;
  verseNumber: number;
  pageNumber: number;
  updatedAt: number;
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  tables: {
    ayahProgress: AyahProgress[];
    bookmarks: BackupBookmark[];
    khatmPlans: BackupKhatmPlan[];
    readingState: BackupReadingState[];
  };
  local: Record<string, string>;
}

export type BackupValidation =
  | { ok: true; data: BackupFile; dropped: number }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function sanitizeBookmark(raw: unknown): BackupBookmark | null {
  if (!isObj(raw)) return null;
  if (!isNum(raw.surahId) || !isNum(raw.verseNumber)) return null;
  if (raw.surahId < 1 || raw.surahId > 114 || raw.verseNumber < 1 || raw.verseNumber > 286) return null;
  return {
    surahId: raw.surahId,
    verseNumber: raw.verseNumber,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : Date.now(),
    note: isStr(raw.note) ? raw.note.slice(0, 5000) : undefined,
    folder: isStr(raw.folder) ? raw.folder.slice(0, 100) : undefined,
  };
}

function sanitizeKhatmPlan(raw: unknown): BackupKhatmPlan | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !raw.id || raw.id.length > 100) return null;
  if (!isStr(raw.type) || !isNum(raw.targetDays) || raw.targetDays < 1 || raw.targetDays > 1000) return null;
  const pages = Array.isArray(raw.completedPages)
    ? raw.completedPages.filter((p): p is number => isNum(p) && Number.isInteger(p) && p >= 1 && p <= 604)
    : [];
  return {
    id: raw.id,
    title: isStr(raw.title) ? raw.title.slice(0, 120) : 'ختم قرآن',
    type: raw.type.slice(0, 30),
    startDate: isStr(raw.startDate) ? raw.startDate.slice(0, 40) : new Date().toISOString(),
    targetDays: Math.round(raw.targetDays),
    totalPages: 604,
    completedPages: Array.from(new Set(pages)).sort((a, b) => a - b),
    currentDay: isNum(raw.currentDay) ? Math.max(1, Math.round(raw.currentDay)) : 1,
    lastReadDate: isStr(raw.lastReadDate) ? raw.lastReadDate.slice(0, 40) : undefined,
    isActive: raw.isActive === true,
  };
}

function sanitizeReadingState(raw: unknown): BackupReadingState | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !raw.id || raw.id.length > 50) return null;
  if (!isNum(raw.surahId) || !isNum(raw.verseNumber) || !isNum(raw.pageNumber)) return null;
  return {
    id: raw.id,
    surahId: raw.surahId,
    verseNumber: raw.verseNumber,
    pageNumber: raw.pageNumber,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : Date.now(),
  };
}

function sanitizeList<T>(raw: unknown, fn: (item: unknown) => T | null, counter: { dropped: number }): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  const limited = raw.slice(0, MAX_ITEMS_PER_TABLE);
  counter.dropped += raw.length - limited.length;
  for (const item of limited) {
    const v = fn(item);
    if (v) out.push(v);
    else counter.dropped += 1;
  }
  return out;
}

/** تبدیل متن (JSON) پشتیبان به ساختار معتبر، یا پیام خطای فارسی */
export function parseBackupText(text: string, todayKey: string, now: number): BackupValidation {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'متن پشتیبان خالی است.' };
  }
  if (text.length > MAX_BACKUP_TEXT_LENGTH) {
    return { ok: false, error: 'فایل پشتیبان بیش از حد بزرگ است.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'فایل پشتیبان معتبر نیست (JSON خراب).' };
  }
  return validateBackup(parsed, todayKey, now);
}

export function validateBackup(raw: unknown, todayKey: string, now: number): BackupValidation {
  if (!isObj(raw)) return { ok: false, error: 'ساختار فایل پشتیبان معتبر نیست.' };
  if (raw.app !== BACKUP_APP_ID) return { ok: false, error: 'این فایل پشتیبان قرآن مبین نیست.' };
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: 'نسخهٔ این فایل پشتیبان پشتیبانی نمی‌شود.' };
  }
  if (!isObj(raw.tables)) return { ok: false, error: 'بخش داده‌ها در فایل پشتیبان نیست.' };

  const counter = { dropped: 0 };
  const t = raw.tables;

  const local: Record<string, string> = {};
  if (isObj(raw.local)) {
    for (const key of BACKUP_LOCAL_KEYS) {
      const v = (raw.local as Record<string, unknown>)[key];
      if (isStr(v) && v.length <= MAX_LOCAL_VALUE_LENGTH) local[key] = v;
      else if (v !== undefined) counter.dropped += 1;
    }
  }

  // ترتیب مهم است: ابتدا همهٔ جدول‌ها پاک‌سازی می‌شوند تا شمارندهٔ موارد حذف‌شده کامل شود
  const tables = {
    ayahProgress: sanitizeList(t.ayahProgress, (i) => sanitizeProgress(i, todayKey, now), counter),
    bookmarks: sanitizeList(t.bookmarks, sanitizeBookmark, counter),
    khatmPlans: sanitizeList(t.khatmPlans, sanitizeKhatmPlan, counter),
    readingState: sanitizeList(t.readingState, sanitizeReadingState, counter),
  };

  return {
    ok: true,
    dropped: counter.dropped,
    data: {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      exportedAt: isStr(raw.exportedAt) ? raw.exportedAt.slice(0, 40) : new Date(now).toISOString(),
      tables,
      local,
    },
  };
}
