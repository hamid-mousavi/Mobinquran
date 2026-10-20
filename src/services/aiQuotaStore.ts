/**
 * حافظهٔ مشترک وضعیت سهمیهٔ هوش مصنوعی (مرحلهٔ ۳ب): یک منبع برای صفحهٔ گفتگو و پنل داوری تلاوت.
 * - وضعیت یک‌بار از /ai/status خوانده و تا ۶۰ ثانیه کش می‌شود
 * - پاسخ‌های موفق سرور (فیلد quota) کش را فوری و بدون درخواست اضافه به‌روز می‌کنند
 */

import { apiFetch } from './apiClient';
import { getOrCreateDeviceId } from '../utils/deviceId';
import {
  AiQuotaStatus,
  QuotaBucketName,
  exhaustedInfo,
  parseQuotaInfo,
  parseQuotaStatus,
  withBucketUpdate,
} from '../utils/aiQuotaStatus';

export const EVENT_AI_QUOTA = 'mobin-ai-quota-updated';
const TTL_MS = 60_000;

let cache: { status: AiQuotaStatus; at: number } | null = null;
let inflight: Promise<AiQuotaStatus | null> | null = null;

function publish(status: AiQuotaStatus): void {
  cache = { status, at: Date.now() };
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_AI_QUOTA));
}

export function getCachedQuota(): AiQuotaStatus | null {
  return cache?.status ?? null;
}

export function refreshAiQuota(force = false): Promise<AiQuotaStatus | null> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.status);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await apiFetch(`/api/ai/status?deviceId=${encodeURIComponent(deviceId)}`, {
        headers: { 'X-Device-ID': deviceId },
      });
      if (!res.ok) return cache?.status ?? null;
      const parsed = parseQuotaStatus(await res.json());
      if (parsed) publish(parsed);
      return parsed ?? cache?.status ?? null;
    } catch {
      return cache?.status ?? null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** پس از پاسخ موفق: {used, limit, remaining} سرور را در کش می‌نشاند */
export function applyQuotaUpdate(bucket: QuotaBucketName, rawQuota: unknown): void {
  const next = withBucketUpdate(cache?.status ?? null, bucket, parseQuotaInfo(rawQuota));
  if (next) publish(next);
}

/** پس از خطای «سهمیهٔ روزانه تمام شد» */
export function markQuotaExhausted(bucket: QuotaBucketName): void {
  const cur = cache?.status ?? null;
  const info = cur?.[bucket] ?? null;
  if (cur && info) publish({ ...cur, [bucket]: exhaustedInfo(info) });
}
