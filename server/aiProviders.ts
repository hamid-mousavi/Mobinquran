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
  enableWebSearch?: boolean;
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

function getProviderKey(provider: ProviderName): string {
  if (provider === 'gemini') {
    return env('GEMINI_API_KEY') || env('API_KEY');
  }
  return env(`${provider.toUpperCase()}_API_KEY`);
}

function configuredProviders(): ProviderName[] {
  const configured = env('AI_PROVIDER_ORDER')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ProviderName => providerOrder.includes(value as ProviderName));
  const order = configured.length > 0 ? configured : providerOrder;
  return order.filter((provider) => !!getProviderKey(provider));
}

function modelFor(provider: ProviderName): string {
  return env(`AI_MODEL_${provider.toUpperCase()}`) || {
    gemini: 'gemini-3.8-flash',
    groq: 'qwen/qwen3.8-27b',
    deepseek: 'deepseek-chat',
    openrouter: 'deepseek/deepseek-chat-v3-0324',
  }[provider];
}

async function callOpenAiStyle(provider: Exclude<ProviderName, 'gemini'>, key: string, request: ProviderRequest): Promise<{ content: string; webChunks?: Array<{ title: string; uri: string }> }> {
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
    const errText = await response.text().catch(() => '');
    throw new ProviderError(provider, response.status, `${provider} returned ${response.status}: ${errText.slice(0, 100)}`);
  }
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new ProviderError(provider, 502, `${provider} returned an empty response`);
  return { content };
}

async function callGemini(key: string, request: ProviderRequest): Promise<{ content: string; webChunks?: Array<{ title: string; uri: string }> }> {
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  try {
    const config: any = {
      systemInstruction: request.system,
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxTokens,
      responseMimeType: 'application/json',
    };
    if (request.enableWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: modelFor('gemini'),
      contents: request.user,
      config,
    });
    const content = response.text?.trim();
    if (!content) throw new ProviderError('gemini', 502, 'gemini returned an empty response');

    const webChunks: Array<{ title: string; uri: string }> = [];
    const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingChunks)) {
      for (const ch of groundingChunks) {
        if (ch?.web?.uri) {
          webChunks.push({
            title: ch.web.title || ch.web.uri,
            uri: ch.web.uri,
          });
        }
      }
    }

    return { content, webChunks };
  } catch (error: any) {
    if (error instanceof ProviderError) throw error;
    const status = typeof error?.status === 'number' ? error.status : typeof error?.statusCode === 'number' ? error.statusCode : 502;
    throw new ProviderError('gemini', status, error?.message || 'gemini request failed');
  }
}

async function callProvider(provider: ProviderName, request: ProviderRequest): Promise<{ content: string; webChunks?: Array<{ title: string; uri: string }> }> {
  const key = getProviderKey(provider);
  if (!key) throw new ProviderError(provider, 503, `${provider} is not configured`);
  return provider === 'gemini' ? callGemini(key, request) : callOpenAiStyle(provider, key, request);
}

export async function generateWithFallback(request: ProviderRequest): Promise<{ content: string; provider: ProviderName; webChunks?: Array<{ title: string; uri: string }> }> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new ProviderError('gemini', 503, 'no AI provider is configured');

  let lastError: unknown;
  for (const provider of providers) {
    try {
      const res = await callProvider(provider, request);
      return { content: res.content, provider, webChunks: res.webChunks };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError && error.status !== 404 && error.status !== 408 && error.status !== 429 && error.status < 500) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('all AI providers failed');
}

export function hasConfiguredProvider(): boolean {
  return configuredProviders().length > 0;
}
