/**
 * سرویس ذخیره‌سازی و پیگیری پیشرفت حفظ قرآن کریم در حافظه محلی کاربر
 */

const STORAGE_KEY_MEMORIZED_VERSES = 'mobin_memorized_verses_v1';
const STORAGE_KEY_SESSIONS = 'mobin_memorization_sessions_v1';
const TOTAL_QURAN_VERSES = 6236;

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

function getStoredVerseKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMORIZED_VERSES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStoredVerseKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_MEMORIZED_VERSES, JSON.stringify(Array.from(keys)));
    window.dispatchEvent(new CustomEvent('mobin-memorization-updated'));
  } catch (err) {
    console.warn('Failed to save memorized verses to localStorage:', err);
  }
}

export function isVerseMemorized(surahId: number, verseNumber: number): boolean {
  const keys = getStoredVerseKeys();
  return keys.has(`${surahId}:${verseNumber}`);
}

export function toggleVerseMemorized(surahId: number, verseNumber: number): boolean {
  const keys = getStoredVerseKeys();
  const key = `${surahId}:${verseNumber}`;
  let isNowMemorized = false;
  if (keys.has(key)) {
    keys.delete(key);
    isNowMemorized = false;
  } else {
    keys.add(key);
    isNowMemorized = true;
  }
  saveStoredVerseKeys(keys);
  return isNowMemorized;
}

export function markRangeMemorized(
  surahId: number,
  startVerse: number,
  endVerse: number,
  memorized = true
): void {
  const keys = getStoredVerseKeys();
  for (let v = startVerse; v <= endVerse; v++) {
    const key = `${surahId}:${v}`;
    if (memorized) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
  }
  saveStoredVerseKeys(keys);
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
  const keys = getStoredVerseKeys();
  let count = 0;
  for (let v = 1; v <= versesCount; v++) {
    if (keys.has(`${surahId}:${v}`)) {
      count++;
    }
  }
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
  const keys = getStoredVerseKeys();
  const key = `${surahId}:${verseNumber}`;
  const isMemorized = status === true || status === 'memorized';
  if (isMemorized) {
    keys.add(key);
  } else {
    keys.delete(key);
  }
  saveStoredVerseKeys(keys);
}

export function getMemorizationStats(): MemorizationStats {
  const keys = getStoredVerseKeys();
  const totalMemorized = keys.size;
  const percentage = Math.min(100, Math.round((totalMemorized / TOTAL_QURAN_VERSES) * 1000) / 10);
  const recentSessions = getRecentSessions(5);

  return {
    totalMemorized,
    totalVerses: TOTAL_QURAN_VERSES,
    percentage,
    completedSurahsCount: 0,
    recentSessions,
    juzProgress: [],
  };
}
