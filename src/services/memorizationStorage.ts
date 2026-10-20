/**
 * سرویس ذخیره‌سازی و پیگیری پیشرفت حفظ قرآن کریم در حافظه محلی کاربر
 */

import { ALL_SURAHS } from '../data/surahs';
import { computeJuzProgress, computeJuzTotals } from './progress/juzMap';
import {
  getAllProgress,
  getMemorizedCount,
  getMemorizedCountsBySurah,
  isMemorized,
  setRangeMemorized,
  setVerseMemorized,
} from './progress/progressStore';

const STORAGE_KEY_SESSIONS = 'mobin_memorization_sessions_v1';
const TOTAL_QURAN_VERSES = 6236;

// تعداد آیه‌های هر جزء ثابت است؛ یک‌بار محاسبه و نگه‌داری می‌شود
let juzTotalsCache: number[] | null = null;
function getJuzTotals(): number[] {
  if (!juzTotalsCache) juzTotalsCache = computeJuzTotals(ALL_SURAHS.map((x) => x.versesCount));
  return juzTotalsCache;
}

export interface MemoSessionRecord {
  id: string;
  timestamp: number;
  surahId: number;
  surahNameArabic?: string;
  range: { start: number; end: number };
  correct: number;
  wrong: number;
  mode: 'review' | 'test';
}

export interface MemorizationStats {
  totalMemorized: number;
  totalVerses: number;
  percentage: number;
  completedSurahsCount: number;
  recentSessions: MemoSessionRecord[];
  juzProgress: { juz: number; memorized: number; total: number }[];
}

// وضعیت «حفظ‌شده» اکنون در ذخیره‌گاه یکپارچهٔ پیشرفت (Dexie) نگهداری می‌شود؛
// این توابع فقط واسط همگام قبلی را برای کامپوننت‌ها حفظ می‌کنند.

export function isVerseMemorized(surahId: number, verseNumber: number): boolean {
  return isMemorized(surahId, verseNumber);
}

export function toggleVerseMemorized(surahId: number, verseNumber: number): boolean {
  const next = !isMemorized(surahId, verseNumber);
  setVerseMemorized(surahId, verseNumber, next);
  return next;
}

export function markRangeMemorized(
  surahId: number,
  startVerse: number,
  endVerse: number,
  memorized = true
): void {
  setRangeMemorized(surahId, startVerse, endVerse, memorized);
}

export function recordMemoSession(record: Omit<MemoSessionRecord, 'id' | 'timestamp'>): void {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    const sessions: MemoSessionRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
    const newEntry: MemoSessionRecord = {
      ...record,
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    sessions.unshift(newEntry);
    // ذخیره تا ۵۰ جلسه اخیر
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions.slice(0, 50)));
    window.dispatchEvent(new CustomEvent('mobin-memorization-updated'));
  } catch (err) {
    console.warn('Failed to save memorization session:', err);
  }
}

export function getRecentSessions(limit = 10): MemoSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const sessions: MemoSessionRecord[] = JSON.parse(raw);
    return Array.isArray(sessions) ? sessions.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export type MemorizationStatus = 'memorized' | 'review_needed' | 'learning' | 'unstarted';
export type MemorizationProgress = MemorizationStats;

export function getMemorizationProgress(): MemorizationStats {
  return getMemorizationStats();
}

export function getSurahMemorizationStats(surahId: number, versesCount: number): {
  memorizedCount: number;
  totalCount: number;
  percentage: number;
} {
  const count = Math.min(versesCount, getMemorizedCountsBySurah().get(surahId) ?? 0);
  return {
    memorizedCount: count,
    totalCount: versesCount,
    percentage: versesCount > 0 ? Math.round((count / versesCount) * 100) : 0,
  };
}

export function setAyahMemorizationStatus(
  surahId: number,
  verseNumber: number,
  status: MemorizationStatus | boolean
): void {
  setVerseMemorized(surahId, verseNumber, status === true || status === 'memorized');
}

export function getMemorizationStats(): MemorizationStats {
  const totalMemorized = getMemorizedCount();
  const percentage = Math.min(100, Math.round((totalMemorized / TOTAL_QURAN_VERSES) * 1000) / 10);
  const recentSessions = getRecentSessions(5);

  const counts = getMemorizedCountsBySurah();
  let completedSurahsCount = 0;
  for (const surah of ALL_SURAHS) {
    if ((counts.get(surah.id) ?? 0) >= surah.versesCount) completedSurahsCount += 1;
  }

  return {
    totalMemorized,
    totalVerses: TOTAL_QURAN_VERSES,
    percentage,
    completedSurahsCount,
    recentSessions,
    juzProgress: computeJuzProgress(
      getAllProgress().filter((r) => r.memorized),
      getJuzTotals()
    ),
  };
}
