/**
 * پیام‌های خطای هوش مصنوعی و راهنمای «داوری دقیق‌تر» برای کلاینت (مرحلهٔ ۳الف).
 * خالص و بدون وابستگی به DOM/شبکه.
 */

export interface AiErrorBody {
  code?: string;
  error?: string;
  resetAt?: number;
}

/** ساعت بازنشانی سهمیه (فقط ساعت و دقیقه، به وقت محلی) */
export function formatResetTime(resetAt: unknown): string | null {
  if (typeof resetAt !== 'number' || !Number.isFinite(resetAt)) return null;
  try {
    return new Date(resetAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

/** پیام فارسی و قابل‌اقدام برای هر خطای پایدار سرور؛ status=0 یعنی قطع ارتباط */
export function aiErrorMessage(status: number, body: AiErrorBody | null | undefined): string {
  const code = body?.code;
  if (code === 'daily_limit_reached' || (status === 429 && code !== 'provider_rate_limited')) {
    const t = formatResetTime(body?.resetAt);
    return `سهمیهٔ روزانهٔ هوش مصنوعی تمام شد${t ? ` (حدود ساعت ${t} دوباره فعال می‌شود)` : ''}؛ فعلاً از ارزیابی سریع استفاده کنید.`;
  }
  if (code === 'provider_rate_limited' || status === 429) {
    return 'سرویس هوش مصنوعی موقتاً شلوغ است؛ کمی بعد دوباره تلاش کنید.';
  }
  if (code === 'quota_unavailable') return 'سرویس سهمیه در دسترس نیست؛ کمی بعد دوباره تلاش کنید.';
  if (code === 'ai_unavailable' || status === 503) {
    return 'هوش مصنوعی فعلاً در دسترس نیست؛ از ارزیابی سریع استفاده کنید.';
  }
  if (code === 'invalid_device' || code === 'invalid_request' || status === 400) {
    return 'درخواست معتبر نبود؛ دوباره تلاش کنید.';
  }
  if (status === 0) return 'اتصال برقرار نشد؛ اینترنت خود را بررسی کنید.';
  return 'پاسخ هوش مصنوعی دریافت نشد؛ دوباره تلاش کنید یا از ارزیابی سریع استفاده کنید.';
}

/** نتیجهٔ محلی «مرزی» است؛ ارزش دارد کاربر داوری دقیق‌تر را بخواهد (فراخوانی خودکار انجام نمی‌شود) */
export function isBorderlineAccuracy(accuracy: number): boolean {
  return accuracy >= 50 && accuracy < 90;
}
