/**
 * مدل و تجزیهٔ وضعیت سهمیهٔ هوش مصنوعی (مرحلهٔ ۳ب) — خالص و تحمل‌پذیر نسبت به نسخهٔ سرور.
 * سرور جدید دو سهمیهٔ جدا می‌دهد (chat / recitation)؛ سرور قدیمی فقط فیلدهای dailyLimit/used/remaining.
 */

export type QuotaBucketName = 'chat' | 'recitation' | 'help';

export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
}

export interface AiQuotaStatus {
  enabled: boolean;
  chat: QuotaInfo | null;
  recitation: QuotaInfo | null;
  help: QuotaInfo | null;
  resetAt?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** {limit, used, remaining?} ← QuotaInfo معتبر یا null */
export function parseQuotaInfo(raw: unknown): QuotaInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.limit) || r.limit <= 0) return null;
  const used = isNum(r.used) ? Math.max(0, Math.round(r.used)) : 0;
  const limit = Math.round(r.limit);
  const remaining = isNum(r.remaining) ? Math.max(0, Math.round(r.remaining)) : Math.max(0, limit - used);
  return { limit, used, remaining };
}

export function parseQuotaStatus(raw: unknown): AiQuotaStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let chat = parseQuotaInfo(r.chat);
  if (!chat && isNum(r.dailyLimit)) {
    // سرور قدیمی: فقط سهمیهٔ گفتگو
    chat = parseQuotaInfo({ limit: r.dailyLimit, used: r.used, remaining: r.remaining });
  }
  return {
    enabled: r.enabled === true,
    chat,
    recitation: parseQuotaInfo(r.recitation),
    help: parseQuotaInfo(r.help),
    resetAt: isNum(r.resetAt) ? r.resetAt : undefined,
  };
}

/** جایگزینی یک سهمیه پس از پاسخ سرور (بدون درخواست اضافه به /status) */
export function withBucketUpdate(
  status: AiQuotaStatus | null,
  bucket: QuotaBucketName,
  info: QuotaInfo | null
): AiQuotaStatus | null {
  if (!info) return status;
  const base: AiQuotaStatus = status ?? { enabled: true, chat: null, recitation: null, help: null };
  return { ...base, [bucket]: info };
}

/** سهمیه تمام‌شده: دیگر درخواستی پذیرفته نمی‌شود */
export function isExhausted(info: QuotaInfo | null | undefined): boolean {
  return !!info && info.remaining <= 0;
}

export function exhaustedInfo(info: QuotaInfo | null): QuotaInfo | null {
  return info ? { ...info, used: Math.max(info.used, info.limit), remaining: 0 } : null;
}
