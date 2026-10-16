import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateWithFallback } from '../../server/aiProviders';

const request = { system: 's', user: 'u', maxTokens: 1200 };
const okBody = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('AI provider layer (Groq-first deployments)', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.AI_MODEL_GROQ;
    process.env.GROQ_API_KEY = 'test-groq';
    process.env.DEEPSEEK_API_KEY = 'test-deepseek';
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('turns thinking off for the default Groq Qwen model so max_tokens is not consumed by reasoning', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await generateWithFallback(request);

    expect(res.provider).toBe('groq');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('qwen/qwen3.8-27b');
    expect(body.reasoning_effort).toBe('none');
    expect(body.max_tokens).toBe(1200);
  });

  it('uses minimal hidden reasoning for GPT-OSS models on Groq', async () => {
    process.env.AI_MODEL_GROQ = 'openai/gpt-oss-120b';
    const fetchMock = vi.fn().mockResolvedValue(okBody('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await generateWithFallback(request);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe('low');
    expect(body.include_reasoning).toBe(false);
  });

  it('falls through to the next provider even when the first one answers 400', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }))
      .mockResolvedValueOnce(okBody('{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await generateWithFallback(request);

    expect(res.provider).toBe('deepseek');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
