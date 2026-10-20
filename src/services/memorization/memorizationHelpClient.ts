/**
 * کلاینت «کمک هوشمند حفظ» (مرحلهٔ ۳ج):
 *  - شباهت‌ها را محلی و از متن واقعی قرآن محاسبه می‌کند (رایگان، بدون هوش مصنوعی)
 *  - توضیح هوشمند را از سرور می‌گیرد، با کش محلی ۳۰ روزه تا سهمیه دوباره مصرف نشود
 *  - در شکست شبکه/سهمیه، فقط همان شباهت‌های محلی می‌مانند؛ متن جعلی جایگزین نمی‌شود
 */

import { QuranService } from '../quranService';
import { apiFetch } from '../apiClient';
import { getOrCreateDeviceId } from '../../utils/deviceId';
import { aiErrorMessage } from '../../utils/aiFeedback';
import { applyQuotaUpdate, markQuotaExhausted } from '../aiQuotaStore';
import { HelpRequest, HelpResult } from './helpTypes';
import { HelpCacheMap, parseHelpCache, pruneHelpCache } from './helpCache';
import { PreparedVerse, SimilarAyah, findSimilarAyahs, prepareCorpus } from './similarAyahs';

const CACHE_KEY = 'mobin_memo_help_v1';

interface Corpus {
  prepared: PreparedVerse[];
  textByKey: Map<string, string>;
}

let corpusPromise: Promise<Corpus> | null = null;

const keyOf = (surahId: number, verseNumber: number) => `${surahId}:${verseNumber}`;

function loadCorpus(): Promise<Corpus> {
  if (!corpusPromise) {
    corpusPromise = QuranService.getAllVerseTexts().then((verses) => {
      if (verses.length === 0) corpusPromise = null; // بستهٔ متن هنوز آماده نیست؛ بار بعد دوباره تلاش شود
      return {
        prepared: prepareCorpus(verses),
        textByKey: new Map(verses.map((v) => [keyOf(v.surahId, v.verseNumber), v.text])),
      };
    });
  }
  return corpusPromise;
}

export interface LocalSimilar extends SimilarAyah {
  text: string;
}

export async function getAyahText(surahId: number, verseNumber: number): Promise<string | null> {
  return (await loadCorpus()).textByKey.get(keyOf(surahId, verseNumber)) ?? null;
}

/** آیه‌های مشابه (محلی و رایگان) همراه با متن واقعی برای نمایش */
export async function getLocalSimilar(surahId: number, verseNumber: number, limit = 4): Promise<LocalSimilar[]> {
  const corpus = await loadCorpus();
  const target = corpus.prepared.find((p) => p.surahId === surahId && p.verseNumber === verseNumber);
  if (!target) return [];
  return findSimilarAyahs(target, corpus.prepared, limit).map((s) => ({
    ...s,
    text: corpus.textByKey.get(keyOf(s.surahId, s.verseNumber)) ?? '',
  }));
}

// ---------------- کش محلی ----------------

function readCache(): HelpCacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseHelpCache(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function readCachedHelp(surahId: number, verseNumber: number): HelpResult | null {
  return readCache()[keyOf(surahId, verseNumber)]?.result ?? null;
}

function writeCached(surahId: number, verseNumber: number, result: HelpResult): void {
  try {
    const next = pruneHelpCache({ ...readCache(), [keyOf(surahId, verseNumber)]: { at: Date.now(), result } }, Date.now());
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // حافظه پر است؛ فقط کش محلی ذخیره نمی‌شود
  }
}

// ---------------- درخواست ----------------

export type HelpOutcome =
  | { ok: true; result: HelpResult; cached: boolean }
  | { ok: false; message: string };

function isHelpResult(v: unknown): v is HelpResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.memoryTip === 'string' &&
    typeof r.linkToPrevious === 'string' &&
    typeof r.practicePlan === 'string' &&
    Array.isArray(r.keywordIndexes) &&
    Array.isArray(r.confusions)
  );
}

export async function requestMemorizationHelp(args: {
  surahId: number;
  verseNumber: number;
  surahName?: string;
  lapses: number;
}): Promise<HelpOutcome> {
  const local = readCachedHelp(args.surahId, args.verseNumber);
  if (local) return { ok: true, result: local, cached: true };

  const corpus = await loadCorpus();
  const targetText = corpus.textByKey.get(keyOf(args.surahId, args.verseNumber));
  if (!targetText) return { ok: false, message: 'متن آیه در دسترس نیست؛ بستهٔ متن قرآن را بررسی کنید.' };

  const similar = await getLocalSimilar(args.surahId, args.verseNumber);
  const body: HelpRequest = {
    surahId: args.surahId,
    verseNumber: args.verseNumber,
    surahName: args.surahName,
    lapses: Math.max(0, Math.min(99, Math.round(args.lapses))),
    targetText,
    previousText: corpus.textByKey.get(keyOf(args.surahId, args.verseNumber - 1)),
    nextText: corpus.textByKey.get(keyOf(args.surahId, args.verseNumber + 1)),
    similar: similar
      .filter((s) => s.text)
      .map((s) => ({ ref: keyOf(s.surahId, s.verseNumber), text: s.text, kind: s.kind })),
  };

  try {
    const deviceId = getOrCreateDeviceId();
    const res = await apiFetch('/api/ai/memorization-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      if (errBody?.code === 'daily_limit_reached') markQuotaExhausted('help');
      return { ok: false, message: aiErrorMessage(res.status, errBody) };
    }
    const json: unknown = await res.json();
    const meta = (json && typeof json === 'object' ? json : {}) as { quota?: unknown; cached?: unknown };
    applyQuotaUpdate('help', meta.quota); // پاسخ کش‌شدهٔ سرور quota ندارد و سهمیه مصرف نکرده است
    if (!isHelpResult(json)) return { ok: false, message: aiErrorMessage(502, null) };
    const result: HelpResult = {
      linkToPrevious: json.linkToPrevious,
      keywordIndexes: json.keywordIndexes,
      memoryTip: json.memoryTip,
      confusions: json.confusions,
      practicePlan: json.practicePlan,
    };
    writeCached(args.surahId, args.verseNumber, result);
    return { ok: true, result, cached: meta.cached === true };
  } catch {
    return { ok: false, message: aiErrorMessage(0, null) };
  }
}
