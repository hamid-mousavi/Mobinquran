/**
 * ردیاب صفحه‌های مطالعه‌شده (مرحلهٔ ۲): لایهٔ نازک روی `pageViewCore` با ذخیرهٔ
 * نامزدها در localStorage تا با بستن برنامه از بین نروند. نامزدهای قدیمی‌تر از ۳ روز
 * خودکار کنار گذاشته می‌شوند.
 */

import { localDateKey } from '../../utils/date';
import { daysBetween } from '../progress/progressCore';
import {
  PageViewState,
  initialPageViewState,
  leavePage,
  viewPage,
} from './pageViewCore';

const STORAGE_KEY = 'mobin_khatm_candidates_v1';
const EXPIRY_DAYS = 3;
export const EVENT_KHATM_CANDIDATES = 'mobin-khatm-candidates-updated';

let state: PageViewState | null = null;

function load(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { updatedDate?: unknown; pages?: unknown };
    if (typeof parsed.updatedDate !== 'string' || !Array.isArray(parsed.pages)) return [];
    if (daysBetween(parsed.updatedDate, localDateKey()) > EXPIRY_DAYS) return [];
    return parsed.pages.filter((p): p is number => typeof p === 'number' && Number.isInteger(p));
  } catch {
    return [];
  }
}

function save(candidates: number[]): void {
  try {
    if (candidates.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ updatedDate: localDateKey(), pages: candidates }));
  } catch {
    // حافظه پر/غیرقابل‌دسترس: پیشنهاد فقط برای همین نشست می‌ماند
  }
}

function ensure(): PageViewState {
  if (!state) state = initialPageViewState(load());
  return state;
}

function apply(next: PageViewState): void {
  const prev = ensure();
  state = next;
  if (next.candidates !== prev.candidates) {
    save(next.candidates);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_KHATM_CANDIDATES));
  }
}

/** کاربر اکنون روی این صفحهٔ مصحف است */
export function trackPageView(page: number): void {
  apply(viewPage(ensure(), page, Date.now()));
}

/** پایان یک دورهٔ مطالعه (پس‌زمینه رفتن، باز کردن پنجرهٔ ختم) */
export function flushPageView(): void {
  apply(leavePage(ensure(), Date.now()));
}

export function getKhatmCandidates(): number[] {
  return [...ensure().candidates];
}

export function clearKhatmCandidates(): void {
  const cur = ensure();
  apply({ ...cur, candidates: [] });
}
