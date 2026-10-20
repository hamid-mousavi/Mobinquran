/**
 * منطق خالص مدیریت چند برنامهٔ ختم (CRUD) و خلاصهٔ یک‌نگاه هر برنامه.
 * بدون Dexie/DOM تا کاملاً تست‌پذیر باشد؛ ذخیره‌سازی در QuranService انجام می‌شود.
 *
 * قرارداد: دقیقاً یک برنامه «اصلی» (isActive=true) است که در صفحهٔ خانه نمایش داده می‌شود.
 */

import type { KhatmPlan, KhatmType } from '../types';
import type { KhatmSegment } from './khatmMath';
import { computeKhatmStatus } from './khatmProgress';
import { currentKhatmDay } from './date';

export const MIN_CUSTOM_DAYS = 10;
export const MAX_CUSTOM_DAYS = 365;
export const MAX_TITLE_LENGTH = 80;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface KhatmTemplate {
  type: Exclude<KhatmType, 'custom'>;
  days: number;
  title: string;
  shortTitle: string;
  perDay: string;
  description: string;
}

export const KHATM_TEMPLATES: readonly KhatmTemplate[] = [
  {
    type: 'ramadan_30',
    days: 30,
    title: 'ختم ۳۰ روزه ماه مبارک رمضان',
    shortTitle: 'ختم ۳۰ روزه',
    perDay: 'روزانه ۱ جزء',
    description: 'هر روز دقیقاً یک جزء، با مرز واقعی اجزاء در مصحف.',
  },
  {
    type: 'arbaeen_40',
    days: 40,
    title: 'چله قرآنی (۴۰ روزه)',
    shortTitle: 'چله قرآنی',
    perDay: 'روزانه ~۱۵ صفحه',
    description: 'انس با قرآن در ۴۰ روز، هم‌گام با مرزهای حزب.',
  },
  {
    type: 'hizb_120',
    days: 120,
    title: 'ختم تدبّری ۱۲۰ روزه',
    shortTitle: 'ختم تدبّری',
    perDay: 'روزانه ۲ ربع حزب',
    description: 'آرام و با تدبّر: روزانه حدود ۵ صفحه.',
  },
];

export function daysForType(type: KhatmType, customDays?: number): number {
  const t = KHATM_TEMPLATES.find((x) => x.type === type);
  if (t) return t.days;
  const n = typeof customDays === 'number' && Number.isFinite(customDays) ? Math.round(customDays) : 60;
  return Math.max(MIN_CUSTOM_DAYS, Math.min(MAX_CUSTOM_DAYS, n));
}

export function defaultTitle(type: KhatmType, days: number): string {
  const t = KHATM_TEMPLATES.find((x) => x.type === type);
  return t ? t.title : `ختم سفارشی ${days} روزه`;
}

/** عنوان: فاصله‌های اضافی حذف، حداکثر ۸۰ نویسه؛ خالی ← مقدار پیش‌فرض */
export function normalizeTitle(raw: unknown, fallback: string): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) : '';
  return t || fallback;
}

/** تاریخ شروع معتبر و حداکثر امروز؛ در غیر این‌صورت امروز */
export function sanitizeStartDate(raw: unknown, todayKey: string): string {
  if (typeof raw !== 'string' || !DATE_KEY_RE.test(raw)) return todayKey;
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const valid = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!valid || raw > todayKey) return todayKey;
  return raw;
}

export interface NewPlanInput {
  type: KhatmType;
  customDays?: number;
  title?: string;
  startDate?: string;
}

export function buildPlan(input: NewPlanInput, todayKey: string, nowMs: number): KhatmPlan {
  const days = daysForType(input.type, input.customDays);
  return {
    id: `plan_${nowMs}`,
    title: normalizeTitle(input.title, defaultTitle(input.type, days)),
    type: input.type,
    startDate: sanitizeStartDate(input.startDate, todayKey),
    targetDays: days,
    totalPages: 604,
    completedPages: [],
    currentDay: 1,
    isActive: false,
  };
}

export interface PlanEdit {
  title?: string;
  startDate?: string;
  /** فقط برای ختم سفارشی اعمال می‌شود */
  targetDays?: number;
}

export function applyPlanEdit(plan: KhatmPlan, edit: PlanEdit, todayKey: string): KhatmPlan {
  const next: KhatmPlan = { ...plan };
  if (edit.title !== undefined) next.title = normalizeTitle(edit.title, plan.title);
  if (edit.startDate !== undefined) next.startDate = sanitizeStartDate(edit.startDate, todayKey);
  if (edit.targetDays !== undefined && plan.type === 'custom') {
    next.targetDays = daysForType('custom', edit.targetDays);
  }
  return next;
}

/** فقط برنامهٔ primaryId «اصلی» می‌ماند */
export function ensureSinglePrimary(plans: readonly KhatmPlan[], primaryId: string | null): KhatmPlan[] {
  return plans.map((p) => ({ ...p, isActive: primaryId !== null && p.id === primaryId }));
}

/** شناسهٔ برنامهٔ اصلی: برنامهٔ فعال، وگرنه اولین برنامه */
export function pickPrimaryId(plans: readonly KhatmPlan[]): string | null {
  return (plans.find((p) => p.isActive) ?? plans[0])?.id ?? null;
}

export type DayState = 'done' | 'partial' | 'missed' | 'today' | 'future';

/** وضعیت هر روز برنامه برای نوار «یک‌نگاه» */
export function dayStates(
  completedPages: readonly number[],
  segments: readonly KhatmSegment[],
  currentDay: number
): DayState[] {
  const done = new Set(completedPages);
  return segments.map((seg, i) => {
    const day = i + 1;
    let have = 0;
    const total = seg.endPage - seg.startPage + 1;
    for (let p = seg.startPage; p <= seg.endPage; p++) if (done.has(p)) have += 1;
    if (total > 0 && have === total) return 'done';
    if (day === currentDay) return 'today';
    if (day > currentDay) return have > 0 ? 'partial' : 'future';
    return have > 0 ? 'partial' : 'missed';
  });
}

export interface PlanGlance {
  currentDay: number;
  totalDays: number;
  percent: number;
  completedCount: number;
  remainingPages: number;
  daysLeft: number;
  todayRange: { start: number; end: number } | null;
  todayDone: boolean;
  behindCount: number;
  isComplete: boolean;
}

export function planGlance(plan: KhatmPlan, segments: readonly KhatmSegment[], now: Date = new Date()): PlanGlance {
  const totalPages = plan.totalPages || 604;
  const totalDays = Math.max(1, segments.length || plan.targetDays);
  const currentDay = Math.min(currentKhatmDay(plan.startDate, plan.targetDays, now), totalDays);
  const status = computeKhatmStatus(plan.completedPages, segments, currentDay, plan.targetDays, totalPages);
  const seg = segments[currentDay - 1] ?? null;
  let todayDone = false;
  if (seg) {
    const done = new Set(plan.completedPages);
    todayDone = true;
    for (let p = seg.startPage; p <= seg.endPage; p++) {
      if (!done.has(p)) {
        todayDone = false;
        break;
      }
    }
  }
  return {
    currentDay,
    totalDays,
    percent: Math.min(100, Math.round((status.completedCount / totalPages) * 100)),
    completedCount: status.completedCount,
    remainingPages: status.remainingPages,
    daysLeft: status.daysLeft,
    todayRange: seg ? { start: seg.startPage, end: seg.endPage } : null,
    todayDone,
    behindCount: status.behindPages.length,
    isComplete: status.isComplete,
  };
}
