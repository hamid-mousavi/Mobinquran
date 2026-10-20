import crypto from 'node:crypto';

interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

const memoryCounters = new Map<string, Counter>();

/**
 * سهمیهٔ جدا برای هر کاربرد: گفتگوی دستیار («chat») و داوری تلاوت («recitation»).
 * پیش از این هر دو یک شمارنده را مصرف می‌کردند و با تمرین حفظ، سهمیهٔ گفتگو زود تمام می‌شد.
 */
export type QuotaBucket = 'chat' | 'recitation' | 'help';

const DEFAULT_LIMITS: Record<QuotaBucket, number> = { chat: 20, recitation: 30, help: 15 };
const LIMIT_ENV: Record<QuotaBucket, string> = {
  chat: 'AI_DAILY_LIMIT',
  recitation: 'AI_RECITATION_DAILY_LIMIT',
  help: 'AI_HELP_DAILY_LIMIT',
};

/** سقف روزانه: AI_DAILY_LIMIT (گفتگو)، AI_RECITATION_DAILY_LIMIT (تلاوت) و AI_HELP_DAILY_LIMIT (کمک حفظ) */
export function dailyLimitFor(bucket: QuotaBucket): number {
  const raw = env(LIMIT_ENV[bucket]);
  const n = Number(raw || DEFAULT_LIMITS[bucket]);
  return Math.max(1, Number.isFinite(n) ? Math.round(n) : DEFAULT_LIMITS[bucket]);
}

/** کلید ذخیره‌سازی؛ کلید «chat» با نسخهٔ قبلی یکسان است تا شمارنده‌های موجود از بین نروند */
export function quotaStorageKey(bucket: QuotaBucket, key: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return bucket === 'chat' ? `quran-ai:${day}:${key}` : `quran-ai:${bucket}:${day}:${key}`;
}

/** زمان بازنشانی سهمیه (نیمه‌شب UTC بعدی) */
export function nextQuotaResetAt(): number {
  return dayWindow().resetAt;
}

function env(name: string): string {
  return (process.env[name] || '').trim();
}

function isProduction(): boolean {
  return env('NODE_ENV') === 'production';
}

function dayWindow(): { start: number; resetAt: number } {
  const now = Date.now();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return { start: start.getTime(), resetAt: start.getTime() + 86_400_000 };
}

export function hashRateLimitKey(ip: string, deviceId: string): string {
  return crypto.createHash('sha256').update(`${ip}|${deviceId}`).digest('hex');
}

export async function getDailyQuotaUsage(key: string, bucket: QuotaBucket = 'chat'): Promise<number> {
  const storageKey = quotaStorageKey(bucket, key);
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (url && token) {
    try {
      const response = await fetch(`${url}/get/${storageKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json() as { result?: string | number };
        return Number(data?.result || 0);
      }
    } catch {}
  }
  const counter = memoryCounters.get(storageKey);
  if (counter && counter.resetAt > Date.now()) {
    return counter.count;
  }
  return 0;
}

async function incrementUpstash(key: string, resetAt: number): Promise<number | null> {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIREAT', key, Math.ceil(resetAt / 1000)],
    ]),
  });
  if (!response.ok) throw new Error('rate-limit store unavailable');
  const result = await response.json() as Array<{ result?: number }>;
  return Number(result?.[0]?.result || 0);
}

export async function consumeDailyQuota(key: string, bucket: QuotaBucket = 'chat'): Promise<RateLimitResult> {
  const limit = dailyLimitFor(bucket);
  const { resetAt } = dayWindow();
  const allowMemoryFallback = env('ALLOW_MEMORY_RATE_LIMIT') === 'true';

  if (isProduction() && (!env('UPSTASH_REDIS_REST_URL') || !env('UPSTASH_REDIS_REST_TOKEN'))) {
    if (!allowMemoryFallback) {
      return { allowed: false, used: 0, limit, resetAt };
    }
  }

  const storageKey = quotaStorageKey(bucket, key);

  let used: number;

  try {
    const persisted = await incrementUpstash(storageKey, resetAt);
    if (persisted !== null) {
      used = persisted;
    } else {
      if (isProduction() && !allowMemoryFallback) {
        return { allowed: false, used: 0, limit, resetAt };
      }
      const existing = memoryCounters.get(storageKey);
      const counter = existing && existing.resetAt > Date.now()
        ? existing
        : { count: 0, resetAt };
      counter.count += 1;
      memoryCounters.set(storageKey, counter);
      used = counter.count;
    }
  } catch {
    if (isProduction() && !allowMemoryFallback) {
      return { allowed: false, used: 0, limit, resetAt };
    }
    const existing = memoryCounters.get(storageKey);
    const counter = existing && existing.resetAt > Date.now()
      ? existing
      : { count: 0, resetAt };
    counter.count += 1;
    memoryCounters.set(storageKey, counter);
    used = counter.count;
  }

  return { allowed: used <= limit, used, limit, resetAt };
}

/**
 * بازگرداندن یک واحد سهمیه وقتی خطا از سمت ما/ارائه‌دهنده بوده است (نه کاربر)؛
 * تا قطعی سرویس از سهمیهٔ روزانهٔ کاربر کم نکند. شکست این عملیات بی‌صدا نادیده گرفته می‌شود.
 */
export async function refundDailyQuota(key: string, bucket: QuotaBucket = 'chat'): Promise<void> {
  const storageKey = quotaStorageKey(bucket, key);
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (url && token) {
    try {
      const response = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['DECR', storageKey]]),
      });
      if (response.ok) return;
    } catch {
      // به شمارندهٔ حافظه برمی‌گردیم
    }
  }
  const counter = memoryCounters.get(storageKey);
  if (counter && counter.count > 0) counter.count -= 1;
}
