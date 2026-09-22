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

function env(name: string): string {
  return (process.env[name] || '').trim();
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

export async function consumeDailyQuota(key: string): Promise<RateLimitResult> {
  const limit = Math.max(1, Number(env('AI_DAILY_LIMIT') || 20));
  const { resetAt } = dayWindow();
  const storageKey = `quran-ai:${new Date().toISOString().slice(0, 10)}:${key}`;
  let used: number;

  try {
    const persisted = await incrementUpstash(storageKey, resetAt);
    if (persisted !== null) {
      used = persisted;
    } else {
      if (process.env.NODE_ENV === 'production') {
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
    return { allowed: false, used: 0, limit, resetAt };
  }

  return { allowed: used <= limit, used, limit, resetAt };
}
