import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consumeDailyQuota,
  dailyLimitFor,
  getDailyQuotaUsage,
  quotaStorageKey,
  refundDailyQuota,
} from '../../server/aiRateLimit';

const originalEnv = { ...process.env };
let n = 0;
const fresh = () => `bucket-test-key-${++n}`;

describe('AI quota buckets (Stage 3b)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.AI_DAILY_LIMIT;
    delete process.env.AI_RECITATION_DAILY_LIMIT;
    delete process.env.AI_HELP_DAILY_LIMIT;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('has separate defaults and env overrides per bucket', () => {
    expect(dailyLimitFor('chat')).toBe(20);
    expect(dailyLimitFor('recitation')).toBe(30);
    expect(dailyLimitFor('help')).toBe(15);
    process.env.AI_HELP_DAILY_LIMIT = '4';
    expect(dailyLimitFor('help')).toBe(4);
    process.env.AI_DAILY_LIMIT = '7';
    process.env.AI_RECITATION_DAILY_LIMIT = '12';
    expect(dailyLimitFor('chat')).toBe(7);
    expect(dailyLimitFor('recitation')).toBe(12);
    process.env.AI_DAILY_LIMIT = 'abc';
    process.env.AI_RECITATION_DAILY_LIMIT = '0';
    expect(dailyLimitFor('chat')).toBe(20);
    expect(dailyLimitFor('recitation')).toBe(1);
  });

  it('keeps the legacy storage key for chat and namespaces the others', () => {
    const d = new Date('2026-10-19T10:00:00Z');
    expect(quotaStorageKey('chat', 'abc', d)).toBe('quran-ai:2026-10-19:abc');
    expect(quotaStorageKey('recitation', 'abc', d)).toBe('quran-ai:recitation:2026-10-19:abc');
    expect(quotaStorageKey('help', 'abc', d)).toBe('quran-ai:help:2026-10-19:abc');
  });

  it('counts chat and recitation independently', async () => {
    const key = fresh();
    await consumeDailyQuota(key);
    await consumeDailyQuota(key, 'chat');
    const r = await consumeDailyQuota(key, 'recitation');
    expect(r).toMatchObject({ allowed: true, used: 1, limit: 30 });
    expect(await getDailyQuotaUsage(key, 'chat')).toBe(2);
    expect(await getDailyQuotaUsage(key, 'recitation')).toBe(1);
  });

  it('exhausting recitation does not block chat (and vice versa)', async () => {
    process.env.AI_RECITATION_DAILY_LIMIT = '2';
    const key = fresh();
    await consumeDailyQuota(key, 'recitation');
    await consumeDailyQuota(key, 'recitation');
    expect((await consumeDailyQuota(key, 'recitation')).allowed).toBe(false);
    expect((await consumeDailyQuota(key, 'chat')).allowed).toBe(true);
  });

  it('refunds one unit per bucket and never goes below zero', async () => {
    const key = fresh();
    await consumeDailyQuota(key, 'recitation');
    await consumeDailyQuota(key, 'chat');
    await refundDailyQuota(key, 'recitation');
    expect(await getDailyQuotaUsage(key, 'recitation')).toBe(0);
    expect(await getDailyQuotaUsage(key, 'chat')).toBe(1);
    await refundDailyQuota(key, 'recitation');
    await refundDailyQuota(key, 'recitation');
    expect(await getDailyQuotaUsage(key, 'recitation')).toBe(0);
    await refundDailyQuota(key); // پیش‌فرض: chat
    expect(await getDailyQuotaUsage(key, 'chat')).toBe(0);
  });
});
