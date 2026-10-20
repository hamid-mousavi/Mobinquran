/**
 * وضعیت پیشرفت ختم و «بازتوزیع» روزهای عقب‌افتاده (مرحلهٔ ۲) — خالص و تست‌پذیر.
 *
 * برنامهٔ ختم بر اساس تقویم است: اگر چند روز نخوانید، سهم آن روزها گم می‌شد و فقط
 * درصد پیشرفت پایین می‌ماند. اینجا عقب‌افتادگی صریح محاسبه و سهم امروز با بازتوزیع
 * صفحه‌های خوانده‌نشده روی روزهای باقی‌مانده پیشنهاد می‌شود.
 */

import type { KhatmSegment } from './khatmMath';

export interface KhatmCatchUp {
  /** سهم روزانه با بازتوزیع (صفحه) */
  quotaPerDay: number;
  /** سهم روزانهٔ برنامهٔ اصلی (صفحه) */
  originalPerDay: number;
  /** صفحه‌هایی که امروز با جبران باید خوانده شوند (اولین خوانده‌نشده‌ها، صعودی) */
  todayPages: number[];
}

export interface KhatmStatus {
  totalPages: number;
  completedCount: number;
  remainingPages: number;
  currentDay: number;
  totalDays: number;
  /** روزهای باقی‌مانده از جمله امروز (حداقل ۱) */
  daysLeft: number;
  /** صفحه‌های خوانده‌نشدهٔ روزهای قبل از امروز، صعودی */
  behindPages: number[];
  isBehind: boolean;
  isComplete: boolean;
  firstUnreadPage: number | null;
  /** فقط وقتی عقب‌افتاده‌اید */
  catchUp: KhatmCatchUp | null;
}

export function computeKhatmStatus(
  completedPages: readonly number[],
  segments: readonly KhatmSegment[],
  currentDay: number,
  targetDays: number,
  totalPages = 604
): KhatmStatus {
  const done = new Set(completedPages.filter((p) => p >= 1 && p <= totalPages));
  const totalDays = Math.max(1, segments.length || targetDays);
  const day = Math.max(1, Math.min(currentDay, totalDays));

  const behind: number[] = [];
  for (let d = 0; d < day - 1; d++) {
    const seg = segments[d];
    if (!seg) continue;
    for (let p = seg.startPage; p <= seg.endPage; p++) if (!done.has(p)) behind.push(p);
  }
  behind.sort((a, b) => a - b);

  const remainingPages = totalPages - done.size;
  const daysLeft = Math.max(1, totalDays - day + 1);

  const unread: number[] = [];
  for (let p = 1; p <= totalPages; p++) if (!done.has(p)) unread.push(p);

  let catchUp: KhatmCatchUp | null = null;
  if (behind.length > 0 && remainingPages > 0) {
    const quota = Math.ceil(remainingPages / daysLeft);
    catchUp = {
      quotaPerDay: quota,
      originalPerDay: Math.ceil(totalPages / totalDays),
      todayPages: unread.slice(0, quota),
    };
  }

  return {
    totalPages,
    completedCount: done.size,
    remainingPages,
    currentDay: day,
    totalDays,
    daysLeft,
    behindPages: behind,
    isBehind: behind.length > 0,
    isComplete: remainingPages === 0,
    firstUnreadPage: unread.length > 0 ? unread[0] : null,
    catchUp,
  };
}

/** افزودن صفحه‌ها به فهرست انجام‌شده‌ها (یکتا، مرتب، فقط بازهٔ معتبر) */
export function withPagesCompleted(
  completedPages: readonly number[],
  pages: readonly number[],
  totalPages = 604
): number[] {
  const set = new Set(completedPages);
  for (const p of pages) if (Number.isInteger(p) && p >= 1 && p <= totalPages) set.add(p);
  return Array.from(set).sort((a, b) => a - b);
}
