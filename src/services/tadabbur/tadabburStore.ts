/**
 * ذخیرهٔ دفتر «تدبر روزانه» (مرحلهٔ ۴ب) روی localStorage؛ یادداشت هر آیه در aiReflectionStorage
 * نگهداری می‌شود و این‌جا فقط «کدام روز، تدبر در کدام آیه» ثبت می‌شود.
 */

import { localDateKey } from '../../utils/date';
import { recordUserActivity } from '../activityTracker';
import { TadabburEntry, parseLog, upsertEntry } from './tadabburCore';

const STORAGE_KEY = 'mobin_tadabbur_log_v1';
export const EVENT_TADABBUR = 'mobin-tadabbur-updated';

export function getTadabburLog(): TadabburEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseLog(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** ثبت تدبر امروز (جایگزین ثبت قبلی همان روز) + احتساب در استمرار روزانه */
export function markTadabburDone(surahId: number, verseNumber: number): boolean {
  try {
    const log = upsertEntry(getTadabburLog(), { date: localDateKey(), surahId, verseNumber });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch (err) {
    console.warn('tadabburStore: save failed', err);
    return false;
  }
  recordUserActivity('read');
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_TADABBUR));
  return true;
}
