import { AISettings, AIProvider } from '../types';

const STORAGE_KEY = 'quran_ai_settings';

export const DEFAULT_AI_MODEL = 'deepseek/deepseek-chat-v3-0324';

export const OPENROUTER_MODELS: string[] = [
  'deepseek/deepseek-chat-v3-0324',
  'deepseek/deepseek-r1',
  'meta-llama/llama-3.3-70b-instruct',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'qwen/qwen-2.5-72b-instruct',
  'openrouter/auto',
];

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'groq',
  openrouterKey: '',
  deepseekKey: '',
  groqKey: '',
  model: DEFAULT_AI_MODEL,
};

export function getAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_AI_SETTINGS;
}

export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save AI settings', e);
  }
}

export function hasPersonalKey(settings: AISettings, provider: AIProvider): boolean {
  const key = provider === 'deepseek'
    ? settings.deepseekKey
    : provider === 'groq'
    ? settings.groqKey
    : settings.openrouterKey;
  return typeof key === 'string' && key.trim().length > 0;
}