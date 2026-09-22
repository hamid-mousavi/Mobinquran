import { GoogleGenAI } from '@google/genai';

export type ProviderName = 'gemini' | 'groq' | 'deepseek' | 'openrouter';

export class ProviderError extends Error {
  constructor(readonly provider: ProviderName, readonly status: number, message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ProviderRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

const providerOrder: ProviderName[] = ['gemini', 'groq', 'deepseek', 'openrouter'];
const urls: Record<Exclude<ProviderName, 'gemini'>, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

function env(name: string): string {
  return (process.env[name] || '').trim();
}

function configuredProviders(): ProviderName[] {
  const configured = env('AI_PROVIDER_ORDER')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ProviderName => providerOrder.includes(value as ProviderName));
  const order = configured.length > 0 ? configured : providerOrder;
  return order.filter((provider) => !!env(`${provider.toUpperCase()}_API_KEY`));
}

function modelFor(provider: ProviderName): string {
  return env(`AI_MODEL_${provider.toUpperCase()}`) || {
    gemini: 'gemini-2.5-flash',
    groq: 'openai/gpt-oss-120b',
    deepseek: 'deepseek-chat',
    openrouter: 'deepseek/deepseek-chat-v3-0324',
  }[provider];
}

async function callOpenAiStyle(provider: Exclude<ProviderName, 'gemini'>, key: string, request: ProviderRequest): Promise<string> {
  const response = await fetch(urls[provider], {
    method: 'POST',
    signal: AbortSignal.timeout(Number(env('AI_PROVIDER_TIMEOUT_MS') || 20000)),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(provider === 'openrouter'
        ? { 'HTTP-Referer': env('PUBLIC_APP_URL') || 'https://quran-mobin.app', 'X-Title': 'QuranMobinApp' }
        : {}),
    },
    body: JSON.stringify({
      model: modelFor(provider),
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new ProviderError(provider, response.status, `${provider} returned ${response.status}`);
  }
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new ProviderError(provider, 502, `${provider} returned an empty response`);
  return content;
}

async function callGemini(key: string, request: ProviderRequest): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const response = await ai.models.generateContent({
      model: modelFor('gemini'),
      contents: request.user,
      config: {
        systemInstruction: request.system,
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens,
        responseMimeType: 'application/json',
      },
    });
    const content = response.text?.trim();
    if (!content) throw new ProviderError('gemini', 502, 'gemini returned an empty response');
    return content;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('gemini', 502, 'gemini request failed');
  }
}

async function callProvider(provider: ProviderName, request: ProviderRequest): Promise<string> {
  const key = env(`${provider.toUpperCase()}_API_KEY`);
  if (!key) throw new ProviderError(provider, 503, `${provider} is not configured`);
  return provider === 'gemini' ? callGemini(key, request) : callOpenAiStyle(provider, key, request);
}

export async function generateWithFallback(request: ProviderRequest): Promise<{ content: string; provider: ProviderName }> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new ProviderError('gemini', 503, 'no AI provider is configured');

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return { content: await callProvider(provider, request), provider };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError && error.status !== 408 && error.status !== 429 && error.status < 500) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('all AI providers failed');
}

export function hasConfiguredProvider(): boolean {
  return configuredProviders().length > 0;
}
