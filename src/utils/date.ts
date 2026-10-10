/**
 * کار با تاریخ به وقت محلی (نه UTC) — P3-T9
 * مشکل قبلی: `toISOString().split('T')[0]` زمان UTC را برمی‌گرداند و نزدیک نیمه‌شب
 * سبب جابه‌جایی «امروز» می‌شد.
 */

/** نام ماه‌های هجری شمسی */
export const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
] as const;

/** نام روزهای هفته در تقویم فارسی (شروع از شنبه) */
export const PERSIAN_WEEKDAY_NAMES = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
] as const;

/** نام مخفف روزهای هفته در تقویم */
export const PERSIAN_WEEKDAY_SHORT = [
  'ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'
] as const;

/** کلید YYYY-MM-DD به وقت محلی دستگاه */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** دریافت مشخصات تاریخ هجری شمسی بر اساس تاریخ میلادی */
export function getPersianDateParts(date: Date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '1405', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
    const weekdayIndex = (date.getDay() + 1) % 7;
    return {
      year,
      month,
      day,
      monthName: PERSIAN_MONTH_NAMES[month - 1] || '',
      weekdayName: PERSIAN_WEEKDAY_NAMES[weekdayIndex] || '',
      weekdayIndex,
    };
  } catch {
    return {
      year: 1405,
      month: 1,
      day: 1,
      monthName: PERSIAN_MONTH_NAMES[0],
      weekdayName: PERSIAN_WEEKDAY_NAMES[0],
      weekdayIndex: 0,
    };
  }
}

/** دریافت روزهای کامل یک ماه هجری شمسی برای رندر تقویم */
export function getPersianMonthData(targetYear: number, targetMonth: number) {
  const approxDay = (targetMonth - 1) * 30 + 15;
  let probe = new Date(targetYear + 621, 2, 19 + approxDay, 12, 0, 0);

  const getP = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(d);
    return {
      year: parseInt(parts.find((p) => p.type === 'year')?.value || '1405', 10),
      month: parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10),
      day: parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10),
    };
  };

  let p = getP(probe);
  while (
    p.year > targetYear ||
    (p.year === targetYear && p.month > targetMonth) ||
    (p.year === targetYear && p.month === targetMonth && p.day > 1)
  ) {
    probe = new Date(probe.getTime() - 86400000);
    p = getP(probe);
  }
  while (p.year < targetYear || (p.year === targetYear && p.month < targetMonth)) {
    probe = new Date(probe.getTime() + 86400000);
    p = getP(probe);
  }

  const days: Array<{
    persianDay: number;
    date: Date;
    dateKey: string;
    persianWeekday: number;
  }> = [];

  while (true) {
    p = getP(probe);
    if (p.year !== targetYear || p.month !== targetMonth) break;
    days.push({
      persianDay: p.day,
      date: new Date(probe),
      dateKey: localDateKey(probe),
      persianWeekday: (probe.getDay() + 1) % 7,
    });
    probe = new Date(probe.getTime() + 86400000);
  }

  return {
    days,
    monthName: PERSIAN_MONTH_NAMES[targetMonth - 1] || '',
    year: targetYear,
    month: targetMonth,
    firstDayWeekday: days.length > 0 ? days[0].persianWeekday : 0,
  };
}

/** نیمه‌شب محلی یک کلید تاریخ */
function localMidnight(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * فاصلهٔ روزهای کامل بین تاریخ شروع و «امروز» (محلی).
 * اگر startKey در آینده باشد، منفی برمی‌گرداند.
 */
export function daysSinceStart(startKey: string, now: Date = new Date()): number {
  const start = localMidnight(startKey);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((today - start) / 86_400_000);
}

/** روز جاریِ برنامه (۱ مبنا) محدود به سقف روزهای هدف */
export function currentKhatmDay(startKey: string, targetDays: number, now: Date = new Date()): number {
  const raw = daysSinceStart(startKey, now) + 1;
  if (raw < 1) return 1;
  return Math.min(raw, Math.max(1, targetDays));
}