/**
 * کار با تاریخ به وقت محلی (نه UTC) — P3-T9
 * مشکل قبلی: `toISOString().split('T')[0]` زمان UTC را برمی‌گرداند و نزدیک نیمه‌شب
 * سبب جابه‌جایی «امروز» می‌شد.
 */

/** کلید YYYY-MM-DD به وقت محلی دستگاه */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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