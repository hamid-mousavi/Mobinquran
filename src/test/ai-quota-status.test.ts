import { describe, it, expect } from 'vitest';
import {
  exhaustedInfo,
  isExhausted,
  parseQuotaInfo,
  parseQuotaStatus,
  withBucketUpdate,
} from '../utils/aiQuotaStatus';

describe('aiQuotaStatus (Stage 3b)', () => {
  it('parses the new two-bucket server response', () => {
    const s = parseQuotaStatus({
      enabled: true,
      chat: { limit: 20, used: 5, remaining: 15 },
      recitation: { limit: 30, used: 1, remaining: 29 },
      help: { limit: 15, used: 0, remaining: 15 },
      resetAt: 123,
    });
    expect(s).toEqual({
      enabled: true,
      chat: { limit: 20, used: 5, remaining: 15 },
      recitation: { limit: 30, used: 1, remaining: 29 },
      help: { limit: 15, used: 0, remaining: 15 },
      resetAt: 123,
    });
  });

  it('understands the legacy single-quota response as chat only', () => {
    const s = parseQuotaStatus({ enabled: true, dailyLimit: 20, used: 4, remaining: 16 });
    expect(s?.chat).toEqual({ limit: 20, used: 4, remaining: 16 });
    expect(s?.recitation).toBeNull();
  });

  it('is tolerant to junk and fills in missing fields', () => {
    expect(parseQuotaStatus(null)).toBeNull();
    expect(parseQuotaStatus('x')).toBeNull();
    expect(parseQuotaStatus({ enabled: false })).toEqual({ enabled: false, chat: null, recitation: null, help: null, resetAt: undefined });
    expect(parseQuotaInfo({ limit: 10 })).toEqual({ limit: 10, used: 0, remaining: 10 });
    expect(parseQuotaInfo({ limit: 10, used: 15 })).toEqual({ limit: 10, used: 15, remaining: 0 });
    expect(parseQuotaInfo({ limit: 0 })).toBeNull();
    expect(parseQuotaInfo({ limit: 'a' })).toBeNull();
  });

  it('updates one bucket without touching the other', () => {
    const base = parseQuotaStatus({
      enabled: true,
      chat: { limit: 20, used: 5, remaining: 15 },
      recitation: { limit: 30, used: 1, remaining: 29 },
    });
    const next = withBucketUpdate(base, 'recitation', { limit: 30, used: 2, remaining: 28 });
    expect(next?.recitation?.remaining).toBe(28);
    expect(next?.chat?.remaining).toBe(15);
    expect(withBucketUpdate(base, 'chat', null)).toBe(base);
    expect(withBucketUpdate(null, 'chat', { limit: 20, used: 1, remaining: 19 })?.chat?.used).toBe(1);
  });

  it('detects and forces an exhausted quota', () => {
    expect(isExhausted(null)).toBe(false);
    expect(isExhausted({ limit: 20, used: 19, remaining: 1 })).toBe(false);
    expect(isExhausted({ limit: 20, used: 20, remaining: 0 })).toBe(true);
    expect(exhaustedInfo({ limit: 20, used: 3, remaining: 17 })).toEqual({ limit: 20, used: 20, remaining: 0 });
    expect(exhaustedInfo(null)).toBeNull();
  });
});
