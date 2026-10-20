import { describe, it, expect } from 'vitest';
import { aiErrorMessage, formatResetTime, isBorderlineAccuracy } from '../utils/aiFeedback';

describe('aiFeedback (Stage 3a)', () => {
  it('explains an exhausted daily quota and tells the user what to do', () => {
    const m = aiErrorMessage(429, { code: 'daily_limit_reached', resetAt: Date.UTC(2026, 9, 19, 0, 0) });
    expect(m).toContain('سهمیهٔ روزانه');
    expect(m).toContain('ارزیابی سریع');
    expect(aiErrorMessage(429, { code: 'daily_limit_reached' })).not.toContain('ساعت');
  });

  it('separates provider overload from quota exhaustion', () => {
    expect(aiErrorMessage(429, { code: 'provider_rate_limited' })).toContain('شلوغ');
    expect(aiErrorMessage(429, null)).toContain('سهمیهٔ روزانه');
  });

  it('covers unavailable, invalid, upstream and offline cases', () => {
    expect(aiErrorMessage(503, { code: 'ai_unavailable' })).toContain('در دسترس نیست');
    expect(aiErrorMessage(503, { code: 'quota_unavailable' })).toContain('سهمیه');
    expect(aiErrorMessage(400, { code: 'invalid_device' })).toContain('معتبر نبود');
    expect(aiErrorMessage(502, { code: 'upstream_error' })).toContain('دریافت نشد');
    expect(aiErrorMessage(502, { code: 'invalid_model_output' })).toContain('دریافت نشد');
    expect(aiErrorMessage(0, null)).toContain('اتصال');
    expect(aiErrorMessage(500, undefined)).toContain('دریافت نشد');
  });

  it('formats reset time defensively', () => {
    expect(formatResetTime('x')).toBeNull();
    expect(formatResetTime(NaN)).toBeNull();
    expect(typeof formatResetTime(Date.UTC(2026, 9, 19, 5, 30))).toBe('string');
  });

  it('flags borderline local results as worth a closer AI look', () => {
    expect([30, 49, 50, 75, 89, 90, 100].map(isBorderlineAccuracy)).toEqual([false, false, true, true, true, false, false]);
  });
});
