import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// فقط لایهٔ شبکهٔ ارائه‌دهندگان جایگزین می‌شود؛ ProviderError و بقیه واقعی می‌مانند
// vi.mock به بالای فایل منتقل (hoist) می‌شود؛ پس mock باید با vi.hoisted ساخته شود
const generateMock = vi.hoisted(() => vi.fn());
vi.mock('../../server/aiProviders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/aiProviders')>();
  return { ...actual, generateWithFallback: generateMock, hasConfiguredProvider: () => true };
});

import { createApp } from '../../app';
import { ProviderError } from '../../server/aiProviders';

const originalEnv = { ...process.env };
const good = JSON.stringify({ isPass: true, accuracy: 96, verdictMessage: 'احسنت', matchedWords: ['بسم'], missedWords: [] });
let device = 0;
const body = (spoken = 'بسم الله الرحمن الرحیم') => ({ targetText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', spokenText: spoken });
const post = (app: ReturnType<typeof createApp>, id: string, payload: object) =>
  request(app).post('/api/ai/verify-recitation').set('X-Device-ID', id).send(payload);

describe('POST /api/ai/verify-recitation (Stage 3a)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_MEMORY_RATE_LIMIT = 'true';
    process.env.AI_RECITATION_DAILY_LIMIT = '5';
    process.env.AI_DAILY_LIMIT = '3';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    generateMock.mockReset();
    device += 1;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses the shared provider chain and reports provider, quota and requestId', async () => {
    generateMock.mockResolvedValue({ content: good, provider: 'groq' });
    const res = await post(createApp(), `device-aaaa-${device}`, body());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isPass: true, accuracy: 96, provider: 'groq', cached: false });
    expect(res.body.quota).toEqual({ used: 1, limit: 5, remaining: 4 });
    expect(typeof res.body.requestId).toBe('string');
  });

  it('serves an identical recitation from cache without a provider call or quota use', async () => {
    generateMock.mockResolvedValue({ content: good, provider: 'gemini' });
    const app = createApp();
    const id = `device-bbbb-${device}`;
    await post(app, id, body('بسم الله الرحمن الرحیم زیاد'));
    const again = await post(app, id, body('بسم الله الرحمن الرحیم زیاد'));
    expect(again.status).toBe(200);
    expect(again.body.cached).toBe(true);
    expect(generateMock).toHaveBeenCalledTimes(1);
    const next = await post(app, id, body('متن دیگری'));
    expect(next.body.quota.used).toBe(2); // درخواست کش‌شده سهمیه مصرف نکرد
  });

  it('refunds the quota and returns a stable code when providers fail', async () => {
    const app = createApp();
    const id = `device-cccc-${device}`;
    generateMock.mockRejectedValueOnce(new ProviderError('groq', 429, 'rate limited'));
    const failed = await post(app, id, body('الف'));
    expect(failed.status).toBe(429);
    expect(failed.body.code).toBe('provider_rate_limited');

    generateMock.mockResolvedValue({ content: good, provider: 'groq' });
    const ok = await post(app, id, body('ب'));
    expect(ok.body.quota.used).toBe(1); // شکست قبلی برگردانده شد
  });

  it('rejects garbage model output (e.g. "{}") instead of recording a fake 0% result, and refunds', async () => {
    const app = createApp();
    const id = `device-dddd-${device}`;
    generateMock.mockResolvedValue({ content: '{}', provider: 'groq' });
    const res = await post(app, id, body('ج'));
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('invalid_model_output');
    expect(generateMock).toHaveBeenCalledTimes(2); // یک بار تلاش مجدد با یادآوری قرارداد

    generateMock.mockResolvedValue({ content: good, provider: 'groq' });
    const ok = await post(app, id, body('د'));
    expect(ok.body.quota.used).toBe(1);
  });

  it('blocks with 429 once the daily limit is used up', async () => {
    generateMock.mockResolvedValue({ content: good, provider: 'groq' });
    const app = createApp();
    const id = `device-eeee-${device}`;
    for (let i = 0; i < 5; i++) await post(app, id, body(`متن ${i}`));
    const blocked = await post(app, id, body('متن جدید'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('daily_limit_reached');
  });

  it('keeps the chat quota untouched and reports both buckets in /ai/status', async () => {
    generateMock.mockResolvedValue({ content: good, provider: 'groq' });
    const app = createApp();
    const id = `device-ffff-${device}`;
    await post(app, id, body('وضعیت'));
    const status = await request(app).get('/api/ai/status').set('X-Device-ID', id);
    expect(status.status).toBe(200);
    expect(status.body.recitation).toEqual({ limit: 5, used: 1, remaining: 4 });
    expect(status.body.chat).toEqual({ limit: 3, used: 0, remaining: 3 });
    // فیلدهای قدیمی همان سهمیهٔ گفتگو هستند
    expect([status.body.dailyLimit, status.body.used, status.body.remaining]).toEqual([3, 0, 3]);
    expect(typeof status.body.resetAt).toBe('number');
  });

});

describe('POST /api/ai/memorization-help (Stage 3c)', () => {
  const helpBody = {
    surahId: 4,
    verseNumber: 17,
    surahName: 'النساء',
    lapses: 3,
    targetText: 'إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا',
    previousText: 'سابقة',
    similar: [{ ref: '4:26', text: 'إِنَّ اللَّهَ كَانَ غَفُورًا رَحِيمًا', kind: 'same_start' }],
  };
  const goodHelp = JSON.stringify({
    link_to_previous: 'پیوند',
    keyword_indexes: [4, 1, 99],
    memory_tip: 'به پایان آیه توجه کن',
    confusions: [{ ref: '4:26', tip: 'پایان‌ها فرق دارد' }, { ref: '1:1', tip: 'ساختگی' }],
    practice_plan: 'سه بار تکرار',
  });
  const postHelp = (app: ReturnType<typeof createApp>, id: string, payload: object) =>
    request(app).post('/api/ai/memorization-help').set('X-Device-ID', id).send(payload);

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AI_HELP_DAILY_LIMIT = '2';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    generateMock.mockReset();
    device += 1;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns validated advice (only real keyword numbers and provided refs) with its own quota', async () => {
    generateMock.mockResolvedValue({ content: goodHelp, provider: 'groq' });
    const res = await postHelp(createApp(), `device-help-${device}`, helpBody);
    expect(res.status).toBe(200);
    expect(res.body.keywordIndexes).toEqual([1, 4]);
    expect(res.body.confusions).toEqual([{ ref: '4:26', tip: 'پایان‌ها فرق دارد' }]);
    expect(res.body.quota).toEqual({ used: 1, limit: 2, remaining: 1 });
  });

  it('rejects malformed requests and missing device ids before any provider call', async () => {
    const app = createApp();
    expect((await postHelp(app, `device-help-${device}`, { ...helpBody, surahId: 0 })).status).toBe(400);
    expect((await request(app).post('/api/ai/memorization-help').send(helpBody)).status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('serves repeats from cache, refunds on provider failure and stops at the limit', async () => {
    const app = createApp();
    const id = `device-help-${device}`;
    generateMock.mockRejectedValueOnce(new ProviderError('groq', 503, 'down'));
    expect((await postHelp(app, id, helpBody)).status).toBe(503);

    generateMock.mockResolvedValue({ content: goodHelp, provider: 'groq' });
    const first = await postHelp(app, id, helpBody);
    expect(first.body.quota.used).toBe(1); // شکست قبلی برگردانده شد
    const again = await postHelp(app, id, helpBody);
    expect(again.body.cached).toBe(true);

    await postHelp(app, id, { ...helpBody, verseNumber: 18 });
    const blocked = await postHelp(app, id, { ...helpBody, verseNumber: 19 });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('daily_limit_reached');
  });
});
