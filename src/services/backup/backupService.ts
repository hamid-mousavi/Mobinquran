/**
 * پشتیبان‌گیری و بازیابی دادهٔ کاربر (مرحلهٔ ۰).
 *
 * بازیابی «غیرمخرب» است: هیچ دادهٔ موجودی حذف یا بازنویسی نمی‌شود.
 *  - پیشرفت آیه‌ها: رکورد تازه‌تر (updatedAt) برنده است
 *  - نشانه‌ها: موارد تکراری (سوره+آیه) اضافه نمی‌شوند
 *  - برنامهٔ ختم و آخرین محل مطالعه: فقط اگر همان شناسه از قبل نبود
 *  - کلیدهای localStorage (استریک، فعالیت، یادداشت‌ها): فقط اگر از قبل نبودند
 * اعتبارسنجی ورودی در backupFormat انجام می‌شود (فایل غیرقابل‌اعتماد است).
 */

import { db } from '../../db/quranDb';
import { localDateKey } from '../../utils/date';
import type { KhatmPlan, KhatmType } from '../../types';
import { flushProgressWrites, getAllProgress, mergeRestoredProgress } from '../progress/progressStore';
import {
  BACKUP_APP_ID,
  BACKUP_LOCAL_KEYS,
  BACKUP_VERSION,
  BackupFile,
  parseBackupText,
} from './backupFormat';

export interface RestoreSummary {
  progressMerged: number;
  bookmarksAdded: number;
  khatmPlansAdded: number;
  readingStateAdded: number;
  localKeysRestored: number;
  localKeysKept: number;
  dropped: number;
}

async function safeArray<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (err) {
    console.warn('backup: table read failed', err);
    return [];
  }
}

export async function createBackup(): Promise<BackupFile> {
  await flushProgressWrites();

  const [bookmarks, khatmPlans, readingState] = await Promise.all([
    safeArray(() => db.bookmarks.toArray()),
    safeArray(() => db.khatmPlans.toArray()),
    safeArray(() => db.readingState.toArray()),
  ]);

  const local: Record<string, string> = {};
  for (const key of BACKUP_LOCAL_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) local[key] = value;
    } catch {
      // دسترسی به localStorage ممکن نیست؛ بقیهٔ بخش‌ها ادامه می‌یابند
    }
  }

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      ayahProgress: getAllProgress(),
      bookmarks: bookmarks.map((b) => ({
        surahId: b.surahId,
        verseNumber: b.verseNumber,
        createdAt: b.createdAt,
        note: b.note,
        folder: b.folder,
      })),
      khatmPlans,
      readingState,
    },
    local,
  };
}

export async function createBackupText(): Promise<string> {
  return JSON.stringify(await createBackup());
}

export async function restoreFromText(text: string): Promise<RestoreSummary> {
  const parsed = parseBackupText(text, localDateKey(), Date.now());
  if (!parsed.ok) throw new Error(parsed.error);
  const { data } = parsed;

  const progressMerged = mergeRestoredProgress(data.tables.ayahProgress);

  // نشانه‌ها: حذف تکراری‌ها بر اساس سوره+آیه
  const existingBookmarks = await safeArray(() => db.bookmarks.toArray());
  const seen = new Set(existingBookmarks.map((b) => `${b.surahId}:${b.verseNumber}`));
  const newBookmarks = data.tables.bookmarks.filter((b) => {
    const k = `${b.surahId}:${b.verseNumber}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (newBookmarks.length > 0) await db.bookmarks.bulkAdd(newBookmarks);

  // برنامه‌های ختم: فقط شناسه‌های جدید؛ حداکثر یک برنامهٔ فعال می‌ماند
  const existingPlans = await safeArray(() => db.khatmPlans.toArray());
  const existingPlanIds = new Set(existingPlans.map((p) => p.id));
  let activeTaken = existingPlans.some((p) => p.isActive);
  const newPlans: KhatmPlan[] = [];
  for (const p of data.tables.khatmPlans) {
    if (existingPlanIds.has(p.id)) continue;
    const isActive = p.isActive && !activeTaken;
    if (isActive) activeTaken = true;
    newPlans.push({ ...p, type: p.type as KhatmType, isActive });
  }
  if (newPlans.length > 0) await db.khatmPlans.bulkPut(newPlans);

  // آخرین محل مطالعه
  const existingReadingIds = new Set((await safeArray(() => db.readingState.toArray())).map((r) => r.id));
  const newReading = data.tables.readingState.filter((r) => !existingReadingIds.has(r.id));
  if (newReading.length > 0) await db.readingState.bulkPut(newReading);

  // کلیدهای localStorage: فقط اگر وجود نداشتند
  let localKeysRestored = 0;
  let localKeysKept = 0;
  for (const [key, value] of Object.entries(data.local)) {
    try {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
        localKeysRestored += 1;
      } else {
        localKeysKept += 1;
      }
    } catch {
      // حافظه پر یا غیرقابل‌دسترس
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mobin-activity-updated'));
    window.dispatchEvent(new CustomEvent('mobin-memorization-updated'));
  }

  return {
    progressMerged,
    bookmarksAdded: newBookmarks.length,
    khatmPlansAdded: newPlans.length,
    readingStateAdded: newReading.length,
    localKeysRestored,
    localKeysKept,
    dropped: parsed.dropped,
  };
}

export function downloadBackupFile(text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quran-mobin-backup-${localDateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ادامه با روش جایگزین
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
