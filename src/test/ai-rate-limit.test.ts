import { afterEach, describe, expect, it } from 'vitest';
import { consumeDailyQuota } from '../../server/aiRateLimit';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('AI daily quota', () => {
  it('fails closed in production when Upstash is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(consumeDailyQuota('test-key')).resolves.toMatchObject({
      allowed: false,
      used: 0,
    });
  });
});