import React, { useEffect, useState } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { ALL_SURAHS } from '../data/surahs';
import { useAiQuota } from '../hooks/useAiQuota';
import { isExhausted } from '../utils/aiQuotaStatus';
import { toPersianDigits } from '../utils/textNormalization';
import { HelpResult, splitDisplayWords } from '../services/memorization/helpTypes';
import {
  LocalSimilar,
  getAyahText,
  getLocalSimilar,
  readCachedHelp,
  requestMemorizationHelp,
} from '../services/memorization/memorizationHelpClient';
import type { SimilarityKind } from '../services/memorization/similarAyahs';

interface MemorizationHelpCardProps {
  surahId: number;
  verseNumber: number;
  surahName: string;
  lapses: number;
  arabicFontFamily: string;
}

const KIND_LABEL: Record<SimilarityKind, string> = {
  identical: 'عین همین عبارت',
  same_start: 'آغاز یکسان',
  same_ending: 'پایان یکسان',
  overlap: 'کلمات مشترک زیاد',
};

const surahNameOf = (id: number) => ALL_SURAHS.find((s) => s.id === id)?.nameArabic ?? `سوره ${id}`;

/** کمک حفظ برای یک آیهٔ پرخطا: شباهت‌های محلی (رایگان) + نکته‌های هوشمند (با سهمیهٔ جدا) */
export const MemorizationHelpCard: React.FC<MemorizationHelpCardProps> = ({
  surahId,
  verseNumber,
  surahName,
  lapses,
  arabicFontFamily,
}) => {
  const [similar, setSimilar] = useState<LocalSimilar[] | null>(null);
  const [targetText, setTargetText] = useState<string | null>(null);
  const [result, setResult] = useState<HelpResult | null>(() => readCachedHelp(surahId, verseNumber));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quota = useAiQuota()?.help ?? null;
  const exhausted = isExhausted(quota);

  useEffect(() => {
    let cancelled = false;
    setSimilar(null);
    setError(null);
    setResult(readCachedHelp(surahId, verseNumber));
    (async () => {
      const [sim, text] = await Promise.all([
        getLocalSimilar(surahId, verseNumber).catch(() => []),
        getAyahText(surahId, verseNumber).catch(() => null),
      ]);
      if (!cancelled) {
        setSimilar(sim);
        setTargetText(text);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surahId, verseNumber]);

  const ask = async () => {
    setLoading(true);
    setError(null);
    const out = await requestMemorizationHelp({ surahId, verseNumber, surahName, lapses });
    if (out.ok) setResult(out.result);
    else setError(out.message);
    setLoading(false);
  };

  const words = targetText ? splitDisplayWords(targetText) : [];
  const tipFor = (ref: string) => result?.confusions.find((c) => c.ref === ref)?.tip;

  return (
    <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3 text-right" dir="rtl">
      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
        <Lightbulb className="w-4 h-4" />
        <span>کمک برای حفظ این آیه</span>
      </div>

      {/* شباهت‌های محلی: رایگان و از متن واقعی قرآن */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">آیه‌های مشابه (احتمال اشتباه)</div>
        {similar === null ? (
          <p className="text-[11px] text-slate-400">در حال بررسی…</p>
        ) : similar.length === 0 ? (
          <p className="text-[11px] text-slate-400">آیهٔ بسیار مشابهی پیدا نشد.</p>
        ) : (
          <ul className="space-y-1.5">
            {similar.map((s) => {
              const ref = `${s.surahId}:${s.verseNumber}`;
              const tip = tipFor(ref);
              return (
                <li key={ref} className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-stone-200/70 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold">
                      سورهٔ {surahNameOf(s.surahId)}، آیهٔ {toPersianDigits(s.verseNumber)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold shrink-0">
                      {KIND_LABEL[s.kind]}
                    </span>
                  </div>
                  {s.text && (
                    <div className="text-base leading-loose text-slate-800 dark:text-slate-100" style={{ fontFamily: arabicFontFamily }} dir="rtl">
                      {s.text}
                    </div>
                  )}
                  {tip && <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">💡 {tip}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* نکته‌های هوشمند */}
      {result ? (
        <div className="space-y-2 pt-2 border-t border-amber-500/20 text-xs leading-relaxed">
          {result.keywordIndexes.length > 0 && words.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-600 dark:text-slate-300">کلمات کلیدی:</span>
              {result.keywordIndexes
                .filter((i) => i >= 1 && i <= words.length)
                .map((i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-800 dark:text-teal-200 text-base"
                    style={{ fontFamily: arabicFontFamily }}
                  >
                    {words[i - 1]}
                  </span>
                ))}
            </div>
          )}
          {result.linkToPrevious && (
            <p>
              <span className="font-bold">پیوند با آیهٔ قبل: </span>
              {result.linkToPrevious}
            </p>
          )}
          <p>
            <span className="font-bold">نکتهٔ حافظه: </span>
            {result.memoryTip}
          </p>
          {result.practicePlan && (
            <p>
              <span className="font-bold">تمرین پیشنهادی: </span>
              {result.practicePlan}
            </p>
          )}
          <p className="text-[10px] text-slate-400">توضیحات را هوش مصنوعی نوشته است؛ متن آیه‌ها همیشه از بستهٔ محلی نمایش داده می‌شود.</p>
        </div>
      ) : (
        <div className="space-y-1.5 pt-2 border-t border-amber-500/20">
          <button
            type="button"
            onClick={ask}
            disabled={loading || exhausted}
            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] transition-all"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'در حال تهیهٔ نکته‌ها…' : exhausted ? 'سهمیهٔ امروز تمام شد' : 'نکته‌های هوشمند حفظ'}</span>
          </button>
          {quota && (
            <p className={`text-[11px] text-center ${exhausted ? 'text-rose-500' : 'text-slate-400'}`}>
              {exhausted
                ? 'فردا دوباره فعال می‌شود؛ شباهت‌های بالا همچنان در دسترس‌اند.'
                : `${toPersianDigits(quota.remaining)} از ${toPersianDigits(quota.limit)} درخواست امروز باقی‌مانده است.`}
            </p>
          )}
          {error && <p className="text-[11px] text-rose-500 text-center">{error}</p>}
        </div>
      )}
    </div>
  );
};
